import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { logEvent } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNonEmptyString } from "@/lib/validation";
import { hasValidMutationOrigin } from "@/lib/request-security";

export async function GET(req: NextRequest) {
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "student" || !actor.studentId) {
    return NextResponse.json({ error: "student_authorization_required" }, { status: 403 });
  }
  const admin = createAdminClient();
  const { data: student, error } = await admin
    .from("students")
    .select("id,full_name,email,dob,school,grade,created_at")
    .eq("id", actor.studentId)
    .maybeSingle();
  if (error || !student) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }
  const { data: enrollment } = await admin
    .from("enrollment_requests")
    .select("parent_phone,assigned_class_id,account_username")
    .eq("supabase_user_id", actor.userId)
    .maybeSingle();
  return NextResponse.json({
    student_id: student.id,
    full_name: student.full_name,
    email: student.email ?? actor.email ?? "",
    dob: student.dob ?? "",
    school: student.school ?? "",
    grade: student.grade ?? "",
    parent_phone: enrollment?.parent_phone ?? "",
    assigned_class_id: enrollment?.assigned_class_id ?? "",
    username: enrollment?.account_username ?? actor.email ?? "",
    created_at: student.created_at,
  });
}

export async function PATCH(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "student" || !actor.studentId) {
    return NextResponse.json({ error: "student_authorization_required" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const limits = { full_name: 120, dob: 10, school: 160, grade: 30 } as const;
  const patch: Record<string, string> = {};
  for (const [field, limit] of Object.entries(limits)) {
    const value = body[field];
    if (value !== undefined) {
      if (typeof value !== "string" || value.length > limit) {
        return NextResponse.json({ error: `invalid_${field}` }, { status: 400 });
      }
      patch[field] = value.trim();
    }
  }
  if (patch.full_name !== undefined && !isNonEmptyString(patch.full_name, 120)) {
    return NextResponse.json({ error: "invalid_full_name" }, { status: 400 });
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "empty_update" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin.from("students").update(patch).eq("id", actor.studentId);
  if (error) return NextResponse.json({ error: "profile_update_failed" }, { status: 500 });
  if (patch.full_name) {
    await admin.from("profiles").update({ full_name: patch.full_name }).eq("id", actor.userId);
    await admin.auth.admin.updateUserById(actor.userId, {
      user_metadata: { full_name: patch.full_name },
    });
  }
  logEvent("info", "account.profile_updated", {
    actor_id: actor.userId,
    fields: Object.keys(patch),
  });
  return NextResponse.json({ success: true });
}
