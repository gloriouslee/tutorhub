import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { validatePassword } from "@/lib/validation";
import { logEvent } from "@/lib/logger";
import { hasValidMutationOrigin } from "@/lib/request-security";

export async function POST(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const identity = await getRequestIdentity(req);
  if (!identity) {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  }

  let body: { new_password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const passwordError = validatePassword(body.new_password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(
    identity.userId,
    { password: body.new_password as string },
  );
  if (authError) {
    logEvent("error", "password_reset_failed", {
      userId: identity.userId,
      reason: authError.message,
    });
    return NextResponse.json(
      { error: "password_update_failed" },
      { status: 500 },
    );
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ must_reset_password: false })
    .eq("id", identity.userId);
  if (profileError) {
    logEvent("error", "password_reset_profile_failed", {
      userId: identity.userId,
      reason: profileError.message,
    });
    return NextResponse.json(
      { error: "profile_update_failed" },
      { status: 500 },
    );
  }

  logEvent("info", "password_reset_completed", {
    userId: identity.userId,
    role: identity.role,
  });
  return NextResponse.json({ ok: true });
}
