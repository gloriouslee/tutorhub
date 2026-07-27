import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, type UserRole } from "@/lib/api-auth";
import { logEvent } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmail, isNonEmptyString, validatePassword } from "@/lib/validation";
import { hasValidMutationOrigin } from "@/lib/request-security";

const ALLOWED_ROLES = new Set<UserRole>(["student", "teacher", "parent"]);

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

  const { email, password, full_name, role, record_id } = body;
  if (!isEmail(email) || !isNonEmptyString(full_name, 120)) {
    return NextResponse.json({ error: "invalid_account_data" }, { status: 400 });
  }
  if (typeof role !== "string" || !ALLOWED_ROLES.has(role as UserRole)) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }
  if (record_id !== undefined && !isNonEmptyString(record_id, 100)) {
    return NextResponse.json({ error: "invalid_record_id" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = full_name.trim();
  const normalizedRole = role as UserRole;
  const validatedPassword = password as string;
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: validatedPassword,
    email_confirm: true,
    app_metadata: { role: normalizedRole },
    user_metadata: { full_name: normalizedName },
  });

  if (error) {
    logEvent("warn", "admin.account.create_failed", {
      actor_id: actor.userId,
      email: normalizedEmail,
      role: normalizedRole,
      error: error.message,
    });
    const duplicate = error.message.toLowerCase().includes("already");
    return NextResponse.json(
      { error: duplicate ? "account_already_exists" : "account_create_failed" },
      { status: duplicate ? 409 : 500 },
    );
  }

  const userId = data.user.id;
  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    email: normalizedEmail,
    full_name: normalizedName,
    role: normalizedRole,
    must_reset_password: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    logEvent("error", "admin.account.profile_failed", {
      actor_id: actor.userId,
      user_id: userId,
      role: normalizedRole,
      error: profileError.message,
    });
    return NextResponse.json({ error: "account_profile_create_failed" }, { status: 500 });
  }

  if (typeof record_id === "string") {
    const table =
      normalizedRole === "student"
        ? "students"
        : normalizedRole === "teacher"
          ? "teachers"
          : "parents";
    const { error: linkError } = await admin
      .from(table)
      .update({ user_id: userId })
      .eq("id", record_id);
    if (linkError) {
      logEvent("warn", "admin.account.record_link_failed", {
        actor_id: actor.userId,
        user_id: userId,
        record_id,
        role: normalizedRole,
        error: linkError.message,
      });
    }
  }

  logEvent("info", "admin.account.created", {
    actor_id: actor.userId,
    user_id: userId,
    role: normalizedRole,
  });
  return NextResponse.json({ user_id: userId, must_reset_password: true }, { status: 201 });
}
