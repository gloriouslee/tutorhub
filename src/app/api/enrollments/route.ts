import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { logEvent } from "@/lib/logger";
import { consumeRateLimit, getHashedClientAddress } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmail, isNonEmptyString } from "@/lib/validation";
import { hasValidMutationOrigin } from "@/lib/request-security";

const TEXT_LIMITS = {
  full_name: 120,
  email: 254,
  dob: 10,
  school: 160,
  grade: 30,
  requested_class_id: 100,
  parent_phone: 30,
  student_phone: 30,
  note: 1000,
} as const;
const PACKAGES = new Set(["online", "advanced", "offline"]);

export async function GET(req: NextRequest) {
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await createAdminClient()
    .from("enrollment_requests")
    .select(
      "id,full_name,email,dob,school,grade,requested_class_id,parent_phone,student_phone,package,note,status,assigned_class_id,account_username,reject_reason,supabase_user_id,created_at,reviewed_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    logEvent("error", "enrollment.list_failed", {
      actor_id: actor.userId,
      error: error.message,
    });
    return NextResponse.json({ error: "enrollment_list_failed" }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  let allowed: boolean;
  try {
    allowed = await consumeRateLimit({
      scope: "public_enrollment",
      key: getHashedClientAddress(req),
      limit: 5,
      windowSeconds: 60 * 60,
    });
  } catch (error) {
    logEvent("error", "enrollment.rate_limit_unavailable", {
      error: error instanceof Error ? error.message : "unknown",
    });
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

  const enrollment: Record<string, string> = {};
  for (const [field, maxLength] of Object.entries(TEXT_LIMITS)) {
    const value = body[field];
    if (value !== undefined) {
      if (typeof value !== "string" || value.length > maxLength) {
        return NextResponse.json({ error: `invalid_${field}` }, { status: 400 });
      }
      enrollment[field] = value.trim();
    }
  }

  if (
    !isNonEmptyString(enrollment.full_name, TEXT_LIMITS.full_name) ||
    !isEmail(enrollment.email) ||
    !isNonEmptyString(enrollment.dob, TEXT_LIMITS.dob) ||
    !isNonEmptyString(enrollment.parent_phone, TEXT_LIMITS.parent_phone)
  ) {
    return NextResponse.json({ error: "invalid_required_fields" }, { status: 400 });
  }
  const packageName = body.package;
  if (packageName !== undefined) {
    if (typeof packageName !== "string" || !PACKAGES.has(packageName)) {
      return NextResponse.json({ error: "invalid_package" }, { status: 400 });
    }
    enrollment.package = packageName;
  }

  const { data, error } = await createAdminClient()
    .from("enrollment_requests")
    .insert({
      ...enrollment,
      email: enrollment.email.toLowerCase(),
      status: "pending",
    })
    .select("id,status,created_at")
    .single();

  if (error) {
    logEvent("error", "enrollment.create_failed", { error: error.message });
    return NextResponse.json({ error: "enrollment_create_failed" }, { status: 500 });
  }
  logEvent("info", "enrollment.created", { enrollment_id: data.id });
  return NextResponse.json(data, { status: 201 });
}
