import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/logger";
import { consumeRateLimit, getHashedClientAddress } from "@/lib/rate-limit";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { isEmail, isNonEmptyString, validatePassword } from "@/lib/validation";

export async function POST(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  let allowed: boolean;
  try {
    allowed = await consumeRateLimit({
      scope: "public_student_signup",
      key: getHashedClientAddress(req),
      limit: 5,
      windowSeconds: 60 * 60,
    });
  } catch {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json(
      { error: "rate_limit_exceeded" },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isNonEmptyString(body.full_name, 120) || !isEmail(body.email)) {
    return NextResponse.json({ error: "invalid_account_data" }, { status: 400 });
  }
  const passwordError = validatePassword(body.password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  const email = body.email.trim().toLowerCase();
  const fullName = body.full_name.trim();
  const publicAuth = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "")
    ?? req.nextUrl.origin;
  const { data, error: signupError } = await publicAuth.auth.signUp({
    email,
    password: body.password as string,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback?next=/student`,
      data: {
        full_name: fullName,
        self_service_signup: true,
      },
    },
  });

  if (signupError) {
    logEvent("warn", "student_signup.auth_failed", {
      error: signupError.message,
    });
    return NextResponse.json({ error: "account_create_failed" }, { status: 400 });
  }

  // Supabase deliberately obscures whether an email already exists. Preserve
  // that behaviour and never relink an existing auth user from this endpoint.
  if (!data.user || data.user.identities?.length === 0) {
    return NextResponse.json({ confirmation_required: true }, { status: 202 });
  }

  const userId = data.user.id;
  const studentId = `stu_${userId}`;
  const admin = createAdminClient();
  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    email,
    full_name: fullName,
    role: "student",
    must_reset_password: false,
  });
  const { error: studentError } = await admin.from("students").upsert({
    id: studentId,
    user_id: userId,
    full_name: fullName,
    email,
    dob: "",
    school: "",
    grade: "",
    learning_type: "hybrid",
  });

  if (profileError || studentError) {
    await admin.auth.admin.deleteUser(userId);
    logEvent("error", "student_signup.profile_failed", {
      user_id: userId,
      error: profileError?.message ?? studentError?.message ?? "unknown",
    });
    return NextResponse.json({ error: "account_profile_create_failed" }, { status: 500 });
  }

  logEvent("info", "student_signup.created", { user_id: userId });
  return NextResponse.json(
    { confirmation_required: data.session === null },
    { status: 201 },
  );
}
