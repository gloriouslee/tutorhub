import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, type UserRole } from "@/lib/api-auth";
import { logEvent } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmail, isNonEmptyString } from "@/lib/validation";
import { hasValidMutationOrigin } from "@/lib/request-security";

const ROLES = new Set<UserRole>(["student", "parent", "teacher", "admin"]);

function appUrl(req: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL is required in production");
  }
  return req.nextUrl.origin;
}

export async function GET(req: NextRequest) {
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = createAdminClient();
  const page = Math.max(1, Number.parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(
    100,
    Math.max(10, Number.parseInt(req.nextUrl.searchParams.get("per_page") ?? "50", 10) || 50),
  );
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
  if (error) {
    return NextResponse.json({ error: "user_list_failed" }, { status: 500 });
  }
  const users = data.users;

  const ids = users.map((user) => user.id);
  const { data: profiles, error: profileError } =
    ids.length === 0
      ? { data: [], error: null }
      : await admin
          .from("profiles")
          .select("id,full_name,role,must_reset_password")
          .in("id", ids);
  if (profileError) {
    return NextResponse.json({ error: "profile_list_failed" }, { status: 500 });
  }
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return NextResponse.json({
    items: users.map((user) => {
      const profile = profileById.get(user.id);
      return {
        id: user.id,
        email: user.email ?? "",
        full_name: profile?.full_name ?? user.user_metadata?.full_name ?? "",
        role: profile?.role ?? user.app_metadata?.role ?? null,
        must_reset_password: profile?.must_reset_password === true,
        disabled: Boolean(user.banned_until && new Date(user.banned_until) > new Date()),
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
      };
    }),
    page,
    per_page: perPage,
    total: data.total,
    has_more: page * perPage < data.total,
  });
}

export async function POST(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    !isEmail(body.email) ||
    !isNonEmptyString(body.full_name, 120) ||
    typeof body.role !== "string" ||
    !ROLES.has(body.role as UserRole)
  ) {
    return NextResponse.json({ error: "invalid_user" }, { status: 400 });
  }
  const email = body.email.trim().toLowerCase();
  const fullName = body.full_name.trim();
  const role = body.role as UserRole;
  const domain =
    body.domain && typeof body.domain === "object" && !Array.isArray(body.domain)
      ? body.domain as Record<string, unknown>
      : {};
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${appUrl(req)}/auth/callback?next=/reset-password`,
  });
  if (error || !data.user) {
    const duplicate = error?.message.toLowerCase().includes("already");
    return NextResponse.json(
      { error: duplicate ? "account_already_exists" : "invite_failed" },
      { status: duplicate ? 409 : 500 },
    );
  }

  const userId = data.user.id;
  const { error: metadataError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role },
    user_metadata: { full_name: fullName },
  });
  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    email,
    full_name: fullName,
    role,
    must_reset_password: true,
  });
  if (metadataError || profileError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "user_provision_failed" }, { status: 500 });
  }

  let record: Record<string, unknown> | null = null;
  if (role !== "admin") {
    const table =
      role === "student" ? "students" : role === "teacher" ? "teachers" : "parents";
    const prefix = role === "student" ? "stu" : role === "teacher" ? "tch" : "par";
    const recordId =
      typeof domain.id === "string" && domain.id.length <= 100
        ? domain.id
        : `${prefix}_${crypto.randomUUID()}`;
    record =
      role === "student"
        ? {
            id: recordId,
            user_id: userId,
            full_name: fullName,
            email,
            dob: typeof domain.dob === "string" ? domain.dob.slice(0, 10) : "",
            school: typeof domain.school === "string" ? domain.school.slice(0, 160) : "",
            grade: typeof domain.grade === "string" ? domain.grade.slice(0, 30) : "",
            learning_type: ["online", "offline", "hybrid"].includes(String(domain.learning_type))
              ? domain.learning_type
              : "hybrid",
          }
        : role === "teacher"
          ? {
              id: recordId,
              user_id: userId,
              full_name: fullName,
              email,
              specialization:
                typeof domain.specialization === "string"
                  ? domain.specialization.slice(0, 160)
                  : "",
              bio: typeof domain.bio === "string" ? domain.bio.slice(0, 5_000) : "",
            }
          : {
              id: recordId,
              user_id: userId,
              full_name: fullName,
              email,
              phone: typeof domain.phone === "string" ? domain.phone.slice(0, 30) : "",
            };
    const { data: inserted, error: domainError } = await admin
      .from(table)
      .insert(record)
      .select("*")
      .single();
    if (domainError) {
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "domain_profile_create_failed" }, { status: 500 });
    }
    record = inserted;
  }
  logEvent("info", "admin.user_invited", {
    actor_id: actor.userId,
    user_id: userId,
    role,
  });
  return NextResponse.json({ id: userId, record }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isNonEmptyString(body.user_id, 100) || !isNonEmptyString(body.action, 30)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const admin = createAdminClient();
  const userId = body.user_id;

  if (body.action === "send_reset") {
    const { data, error: lookupError } = await admin.auth.admin.getUserById(userId);
    if (lookupError || !data.user.email) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }
    const { error } = await admin.auth.resetPasswordForEmail(data.user.email, {
      redirectTo: `${appUrl(req)}/auth/callback?next=/reset-password`,
    });
    if (error) return NextResponse.json({ error: "reset_email_failed" }, { status: 500 });
    await admin.from("profiles").update({ must_reset_password: true }).eq("id", userId);
  } else if (body.action === "disable" || body.action === "enable") {
    if (userId === actor.userId) {
      return NextResponse.json({ error: "cannot_disable_self" }, { status: 409 });
    }
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: body.action === "disable" ? "876000h" : "none",
    });
    if (error) return NextResponse.json({ error: "user_status_failed" }, { status: 500 });
  } else {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  logEvent("info", "admin.user_action", {
    actor_id: actor.userId,
    user_id: userId,
    action: body.action,
  });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const userId = req.nextUrl.searchParams.get("id");
  if (!userId || userId.length > 100) {
    return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
  }
  if (userId === actor.userId) {
    return NextResponse.json({ error: "cannot_delete_self" }, { status: 409 });
  }
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role === "student" || profile?.role === "teacher") {
    const table = profile.role === "student" ? "students" : "teachers";
    const { data: record } = await admin
      .from(table)
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (record?.id) {
      const { error: domainError } = await admin.rpc(
        "delete_admin_domain_identity_secure",
        {
          p_entity: table,
          p_record_id: record.id,
          p_actor_id: actor.userId,
        },
      );
      if (domainError) {
        const conflict = domainError.message.includes("_has_classes");
        return NextResponse.json(
          { error: conflict ? domainError.message : "domain_profile_delete_failed" },
          { status: conflict ? 409 : 500 },
        );
      }
    }
  } else if (profile?.role === "parent") {
    const { error: parentDeleteError } = await admin
      .from("parents")
      .delete()
      .eq("user_id", userId);
    if (parentDeleteError) {
      return NextResponse.json(
        { error: "domain_profile_delete_failed" },
        { status: 500 },
      );
    }
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: "user_delete_failed" }, { status: 500 });
  logEvent("info", "admin.user_deleted", {
    actor_id: actor.userId,
    user_id: userId,
  });
  return NextResponse.json({ success: true });
}
