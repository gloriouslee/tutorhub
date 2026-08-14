import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, type RequestIdentity } from "@/lib/api-auth";
import { teacherCanManageStudent } from "@/lib/guardian-server";
import type {
  GuardianLinkStatus,
  GuardianRelationship,
} from "@/lib/guardian-types";
import { logEvent } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmail, isNonEmptyString } from "@/lib/validation";

export const dynamic = "force-dynamic";

const RELATIONSHIPS = new Set<GuardianRelationship>([
  "mother",
  "father",
  "guardian",
  "other",
]);
const STATUSES = new Set<GuardianLinkStatus>([
  "pending",
  "active",
  "rejected",
  "revoked",
]);
const LINK_SELECT = `
  id,student_id,parent_id,relationship,status,invited_email,
  accepted_at,rejected_at,revoked_at,created_at,updated_at,
  student:students(id,full_name,grade,school),
  parent:parents(id,full_name,email,phone)
`;

function applicationUrl(req: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      const url = new URL(configured);
      if (process.env.NODE_ENV !== "production" || url.protocol === "https:") {
        return url.origin;
      }
      logEvent("warn", "guardian.application_url_insecure", {
        protocol: url.protocol,
      });
    } catch {
      logEvent("warn", "guardian.application_url_invalid");
    }
  }

  // The invitation must still be actionable when the optional public URL is
  // missing or was accidentally configured with a local/non-HTTPS value.
  return req.nextUrl.origin;
}

function callbackUrl(req: NextRequest, next: string) {
  const callback = new URL("/auth/callback", applicationUrl(req));
  callback.searchParams.set("next", next);
  return callback.toString();
}

async function canManageStudent(
  actor: RequestIdentity | null,
  studentId: string,
) {
  if (!actor) return { actor: null, allowed: false };
  if (actor.role === "admin") return { actor, allowed: true };
  if (actor.role !== "teacher" || !actor.teacherId) {
    return { actor, allowed: false };
  }
  const admin = createAdminClient();
  return {
    actor,
    allowed: await teacherCanManageStudent(admin, actor.teacherId, studentId),
  };
}

export async function GET(req: NextRequest) {
  const actor = await getRequestIdentity(req);
  if (!actor) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }

  const admin = createAdminClient();
  let query = admin.from("student_guardians").select(LINK_SELECT);
  const status = req.nextUrl.searchParams.get("status");
  if (status && STATUSES.has(status as GuardianLinkStatus)) {
    query = query.eq("status", status);
  }

  if (actor.role === "parent") {
    if (!actor.parentId) {
      return NextResponse.json({ error: "parent_profile_required" }, { status: 403 });
    }
    query = query.eq("parent_id", actor.parentId);
  } else {
    const studentId = req.nextUrl.searchParams.get("student_id") ?? "";
    if (!studentId || studentId.length > 120) {
      return NextResponse.json({ error: "student_required" }, { status: 400 });
    }
    const access = await canManageStudent(actor, studentId);
    if (!access.allowed) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    query = query.eq("student_id", studentId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "guardian_links_unavailable" }, { status: 500 });
  }
  return NextResponse.json(data ?? [], {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const actor = await getRequestIdentity(req);
  if (!actor) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const studentId = typeof body.student_id === "string" ? body.student_id : "";
  const relationship = typeof body.relationship === "string"
    ? body.relationship as GuardianRelationship
    : "guardian";
  if (
    !studentId
    || studentId.length > 120
    || !isEmail(body.email)
    || !isNonEmptyString(body.full_name, 120)
    || !RELATIONSHIPS.has(relationship)
  ) {
    return NextResponse.json({ error: "invalid_guardian_invite" }, { status: 400 });
  }

  const access = await canManageStudent(actor, studentId);
  if (!access.allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const allowed = await consumeRateLimit({
    scope: "guardian_invite",
    key: actor.userId,
    limit: 30,
    windowSeconds: 60 * 60,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "invite_rate_limited" },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  const admin = createAdminClient();
  const { data: student } = await admin
    .from("students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) {
    return NextResponse.json({ error: "student_not_found" }, { status: 404 });
  }

  const email = body.email.trim().toLowerCase();
  const fullName = body.full_name.trim();
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id,role,full_name,must_reset_password")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (existingProfile && existingProfile.role !== "parent") {
    return NextResponse.json({ error: "email_used_by_another_role" }, { status: 409 });
  }

  let userId = existingProfile?.id ?? "";
  let parentId = "";
  let createdUser = false;
  let emailAlreadySent = false;

  if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: callbackUrl(
        req,
        "/reset-password?next=/parent/invitations",
      ),
    });
    if (error || !data.user) {
      const message = error?.message.toLowerCase() ?? "";
      logEvent("warn", "guardian.account_invite_failed", {
        actor_id: actor.userId,
        student_id: studentId,
        reason: error?.message ?? "missing_invited_user",
      });
      return NextResponse.json(
        {
          error: message.includes("already")
            ? "account_already_exists_without_profile"
            : "guardian_invite_email_failed",
        },
        { status: message.includes("already") ? 409 : 502 },
      );
    }
    userId = data.user.id;
    createdUser = true;
    emailAlreadySent = true;

    const [metadataResult, profileResult] = await Promise.all([
      admin.auth.admin.updateUserById(userId, {
        app_metadata: { role: "parent" },
        user_metadata: { full_name: fullName },
      }),
      admin.from("profiles").upsert({
        id: userId,
        email,
        full_name: fullName,
        role: "parent",
        must_reset_password: true,
      }),
    ]);
    if (metadataResult.error || profileResult.error) {
      logEvent("error", "guardian.account_setup_failed", {
        actor_id: actor.userId,
        student_id: studentId,
        metadata_error: metadataResult.error?.message,
        profile_error: profileResult.error?.message,
      });
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "guardian_account_create_failed" }, { status: 500 });
    }
  }

  const { data: parentRows, error: parentLookupError } = await admin
    .from("parents")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (parentLookupError) {
    logEvent("error", "guardian.parent_lookup_failed", {
      actor_id: actor.userId,
      student_id: studentId,
      reason: parentLookupError.message,
    });
    if (createdUser) await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "guardian_profile_lookup_failed" }, { status: 500 });
  }
  const existingParent = parentRows?.[0];
  parentId = String(existingParent?.id ?? `par_${crypto.randomUUID()}`);
  if (!existingParent) {
    const { error } = await admin.from("parents").insert({
      id: parentId,
      user_id: userId,
      full_name: fullName,
      email,
      phone: "",
    });
    if (error) {
      logEvent("error", "guardian.parent_create_failed", {
        actor_id: actor.userId,
        student_id: studentId,
        reason: error.message,
      });
      if (createdUser) await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "guardian_profile_create_failed" }, { status: 500 });
    }
  }

  const { data: currentLink } = await admin
    .from("student_guardians")
    .select("id,status")
    .eq("student_id", studentId)
    .eq("parent_id", parentId)
    .maybeSingle();
  if (currentLink?.status === "active") {
    return NextResponse.json({ error: "guardian_already_linked" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { data: link, error: linkError } = await admin
    .from("student_guardians")
    .upsert({
      ...(currentLink?.id ? { id: currentLink.id } : {}),
      student_id: studentId,
      parent_id: parentId,
      relationship,
      status: "pending",
      invited_email: email,
      invited_by_user_id: actor.userId,
      invited_by_role: actor.role,
      accepted_at: null,
      rejected_at: null,
      revoked_at: null,
      updated_at: now,
    }, { onConflict: "student_id,parent_id" })
    .select("id")
    .single();
  if (linkError || !link) {
    logEvent("error", "guardian.link_create_failed", {
      actor_id: actor.userId,
      student_id: studentId,
      parent_id: parentId,
      reason: linkError?.message ?? "missing_guardian_link",
    });
    if (createdUser) {
      await admin.from("parents").delete().eq("id", parentId);
      await admin.auth.admin.deleteUser(userId);
    }
    return NextResponse.json({ error: "guardian_link_create_failed" }, { status: 500 });
  }

  if (!emailAlreadySent) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      logEvent("warn", "guardian.invite_email_configuration_missing", {
        actor_id: actor.userId,
        guardian_link_id: link.id,
      });
      return NextResponse.json(
        { id: link.id, warning: "email_not_sent" },
        { status: 202 },
      );
    }
    const publicAuth = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await publicAuth.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: callbackUrl(
          req,
          existingProfile?.must_reset_password
            ? "/reset-password?next=/parent/invitations"
            : "/parent/invitations",
        ),
      },
    });
    if (error) {
      logEvent("warn", "guardian.invite_email_failed", {
        actor_id: actor.userId,
        guardian_link_id: link.id,
        detail: error.message,
      });
      return NextResponse.json(
        { id: link.id, warning: "email_not_sent" },
        { status: 202 },
      );
    }
  }

  logEvent("info", "guardian.invited", {
    actor_id: actor.userId,
    guardian_link_id: link.id,
    student_id: studentId,
    parent_id: parentId,
  });
  return NextResponse.json({ id: link.id }, { status: 201 });
}
