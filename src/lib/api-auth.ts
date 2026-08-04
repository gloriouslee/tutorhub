import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { isCompleteStudentProfile } from "@/lib/validation";

export type UserRole = "student" | "parent" | "teacher" | "admin";

export type RequestIdentity = {
  userId: string;
  email: string | null;
  role: UserRole;
  displayName: string;
  studentId?: string;
  teacherId?: string;
  parentId?: string;
  mustResetPassword: boolean;
  profileComplete: boolean;
};

const VALID_ROLES = new Set<UserRole>([
  "student",
  "parent",
  "teacher",
  "admin",
]);

function isRole(value: unknown): value is UserRole {
  return typeof value === "string" && VALID_ROLES.has(value as UserRole);
}

function createRequestClient(req: NextRequest, response?: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookies) {
        // Honour the "remember me" preference: when off (th_remember=0), rewrite
        // refreshed auth cookies as session cookies so they clear on browser close.
        const sessionOnly = req.cookies.get("th_remember")?.value === "0";
        cookies.forEach(({ name, value, options }) => {
          const opts = sessionOnly
            ? { ...options, maxAge: undefined, expires: undefined }
            : options;
          req.cookies.set(name, value);
          response?.cookies.set(name, value, opts);
        });
      },
    },
  });
}

/**
 * Resolve the authenticated caller from a verified Supabase session.
 *
 * Authorization data comes from profiles first and app_metadata second.
 * user_metadata and caller-supplied IDs are never trusted for permissions.
 */
export async function getRequestIdentity(
  req: NextRequest,
  response?: NextResponse,
): Promise<RequestIdentity | null> {
  const supabase = createRequestClient(req, response);
  if (!supabase) return null;

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) return null;

  const claims = claimsData.claims;
  const userId = claims.sub;
  const email = typeof claims.email === "string" ? claims.email : null;
  const metadataRole = claims.app_metadata?.role;

  type RoleEntity = {
    id: string;
    fullName: string;
    dob?: unknown;
    school?: unknown;
    grade?: unknown;
  };

  const loadRoleEntity = async (role: UserRole): Promise<RoleEntity | null> => {
    if (role === "admin") return null;
    // limit(1) instead of maybeSingle(): maybeSingle() *errors* when more than
    // one row matches, and only `data` is read here, so a duplicated row would
    // silently resolve to no entity — leaving the caller with no studentId and
    // no way to use the app.
    if (role === "student") {
      const { data: rows } = await supabase
        .from("students")
        .select("id, full_name, dob, school, grade")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1);
      const data = rows?.[0];
      return data
        ? {
            id: String(data.id),
            fullName: String(
              data.full_name ?? email?.split("@")[0] ?? "User",
            ),
            dob: data.dob,
            school: data.school,
            grade: data.grade,
          }
        : null;
    }

    const table =
      role === "teacher"
        ? "teachers"
        : "parents";
    const { data: rows } = await supabase
      .from(table)
      .select("id, full_name")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);
    const data = rows?.[0];
    return data
      ? {
          id: String(data.id),
          fullName: String(data.full_name ?? email?.split("@")[0] ?? "User"),
        }
      : null;
  };

  // New accounts carry a verified role in app_metadata. Start the matching
  // entity lookup in parallel with the profile lookup to avoid a second RTT.
  const metadataEntityPromise = isRole(metadataRole)
    ? loadRoleEntity(metadataRole)
    : Promise.resolve(null);
  const [profileResult, metadataEntity] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, must_reset_password, phone, disabled")
      .eq("id", userId)
      .maybeSingle(),
    metadataEntityPromise,
  ]);

  let profile: {
    role?: unknown;
    must_reset_password?: unknown;
    phone?: unknown;
    disabled?: unknown;
  } | null = null;
  if (!profileResult.error) {
    profile = profileResult.data;
  } else {
    // Compatibility before the security migration adds must_reset_password.
    const legacyProfile = await supabase
      .from("profiles")
      .select("role, phone")
      .eq("id", userId)
      .maybeSingle();
    profile = legacyProfile.data;
  }

  // Deleting an account cascades its profiles row away, but the browser still
  // holds a signed access token whose app_metadata carries the old role. Falling
  // back to that role let a deleted user keep using the app until the token
  // expired, so require the row to exist. handle_new_user() creates it in the
  // same transaction as the auth user, so a live account always has one.
  if (!profile) return null;
  // A lock (ban_duration in auth.users) is invisible to local token validation.
  // The mirrored flag makes it take effect on the very next request.
  if (profile.disabled === true) return null;

  const roleCandidate = profile.role ?? metadataRole;
  if (!isRole(roleCandidate)) return null;

  const roleEntity =
    roleCandidate === metadataRole
      ? metadataEntity
      : await loadRoleEntity(roleCandidate);
  const identity: RequestIdentity = {
    userId,
    email,
    role: roleCandidate,
    displayName: roleEntity?.fullName ?? email?.split("@")[0] ?? "User",
    mustResetPassword: profile?.must_reset_password === true,
    profileComplete:
      roleCandidate !== "student" ||
      isCompleteStudentProfile({
        full_name: roleEntity?.fullName,
        dob: roleEntity?.dob,
        school: roleEntity?.school,
        grade: roleEntity?.grade,
        phone: profile?.phone,
      }),
  };

  if (identity.role === "student") {
    identity.studentId = roleEntity?.id;
  } else if (identity.role === "teacher") {
    identity.teacherId = roleEntity?.id;
  } else if (identity.role === "parent") {
    identity.parentId = roleEntity?.id;
  }

  return identity;
}

export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  return (await getRequestIdentity(req))?.role === "admin";
}

export async function hasRole(
  req: NextRequest,
  allowed: readonly UserRole[],
): Promise<RequestIdentity | null> {
  const identity = await getRequestIdentity(req);
  return identity && allowed.includes(identity.role) ? identity : null;
}
