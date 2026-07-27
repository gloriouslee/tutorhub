import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

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
        cookies.forEach(({ name, value, options }) => {
          req.cookies.set(name, value);
          response?.cookies.set(name, value, options);
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

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return null;

  let profile: { role?: unknown; must_reset_password?: unknown } | null = null;
  const profileResult = await supabase
    .from("profiles")
    .select("role, must_reset_password")
    .eq("id", user.id)
    .maybeSingle();

  if (!profileResult.error) {
    profile = profileResult.data;
  } else {
    // Compatibility before the security migration adds must_reset_password.
    const legacyProfile = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    profile = legacyProfile.data;
  }

  const roleCandidate = profile?.role ?? user.app_metadata?.role;
  if (!isRole(roleCandidate)) return null;

  const identity: RequestIdentity = {
    userId: user.id,
    email: user.email ?? null,
    role: roleCandidate,
    displayName: user.email?.split("@")[0] ?? "User",
    mustResetPassword: profile?.must_reset_password === true,
  };

  if (identity.role === "student") {
    const { data } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data?.id) {
      identity.studentId = String(data.id);
      identity.displayName = String(data.full_name ?? identity.displayName);
    }
  } else if (identity.role === "teacher") {
    const { data } = await supabase
      .from("teachers")
      .select("id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data?.id) {
      identity.teacherId = String(data.id);
      identity.displayName = String(data.full_name ?? identity.displayName);
    }
  } else if (identity.role === "parent") {
    const { data } = await supabase
      .from("parents")
      .select("id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data?.id) {
      identity.parentId = String(data.id);
      identity.displayName = String(data.full_name ?? identity.displayName);
    }
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
