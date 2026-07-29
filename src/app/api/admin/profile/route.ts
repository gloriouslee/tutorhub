import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { isNonEmptyString, normalizeContactPhone } from "@/lib/validation";
import { logEvent } from "@/lib/logger";

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
  const [profileResult, userResult] = await Promise.all([
    admin
      .from("profiles")
      .select("full_name,email,phone,role,created_at")
      .eq("id", actor.userId)
      .maybeSingle(),
    admin.auth.admin.getUserById(actor.userId),
  ]);
  if (profileResult.error || !profileResult.data || userResult.error) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    full_name: profileResult.data.full_name ?? actor.displayName,
    email: userResult.data.user.email ?? profileResult.data.email ?? actor.email ?? "",
    phone: profileResult.data.phone ?? "",
    role: "admin",
    created_at: profileResult.data.created_at,
    last_sign_in_at: userResult.data.user.last_sign_in_at ?? null,
  });
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

  if (!isNonEmptyString(body.full_name, 120)) {
    return NextResponse.json({ error: "invalid_full_name" }, { status: 400 });
  }
  const fullName = body.full_name.trim();
  const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
  const phone = rawPhone ? normalizeContactPhone(rawPhone) : null;
  if (rawPhone && !phone) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: fullName, phone })
    .eq("id", actor.userId);
  if (profileError) {
    return NextResponse.json({ error: "profile_update_failed" }, { status: 500 });
  }

  const { error: metadataError } = await admin.auth.admin.updateUserById(
    actor.userId,
    { user_metadata: { full_name: fullName } },
  );
  if (metadataError) {
    return NextResponse.json({ error: "profile_update_failed" }, { status: 500 });
  }

  logEvent("info", "admin.profile_updated", {
    actor_id: actor.userId,
    fields: ["full_name", "phone"],
  });
  return NextResponse.json({
    full_name: fullName,
    phone: phone ?? "",
  });
}

export async function POST(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "admin" || !actor.email) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await createAdminClient().auth.resetPasswordForEmail(
    actor.email,
    { redirectTo: `${appUrl(req)}/auth/callback?next=/update-password` },
  );
  if (error) {
    return NextResponse.json({ error: "reset_email_failed" }, { status: 500 });
  }
  logEvent("info", "admin.password_reset_requested", {
    actor_id: actor.userId,
  });
  return NextResponse.json({ success: true });
}
