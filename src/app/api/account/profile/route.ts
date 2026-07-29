import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { logEvent } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isCompleteStudentProfile,
  isNonEmptyString,
  isValidDateOfBirth,
  normalizeContactPhone,
  normalizeStudentGrade,
} from "@/lib/validation";
import { hasValidMutationOrigin } from "@/lib/request-security";

export async function GET(req: NextRequest) {
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "student" || !actor.studentId) {
    return NextResponse.json({ error: "student_authorization_required" }, { status: 403 });
  }
  const admin = createAdminClient();
  const [studentResult, profileResult, enrollmentResult] = await Promise.all([
    admin
      .from("students")
      .select("id,full_name,email,dob,school,grade,created_at")
      .eq("id", actor.studentId)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("phone")
      .eq("id", actor.userId)
      .maybeSingle(),
    admin
      .from("enrollment_requests")
      .select("parent_phone,assigned_class_id,account_username")
      .eq("supabase_user_id", actor.userId)
      .maybeSingle(),
  ]);
  const student = studentResult.data;
  const error = studentResult.error;
  if (error || !student) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }
  const phone = profileResult.data?.phone ?? "";
  const enrollment = enrollmentResult.data;
  return NextResponse.json({
    student_id: student.id,
    full_name: student.full_name,
    email: student.email ?? actor.email ?? "",
    dob: student.dob ?? "",
    school: student.school ?? "",
    grade: student.grade ?? "",
    phone,
    parent_phone: enrollment?.parent_phone ?? "",
    assigned_class_id: enrollment?.assigned_class_id ?? "",
    username: enrollment?.account_username ?? actor.email ?? "",
    from_enrollment: Boolean(enrollment),
    profile_complete: isCompleteStudentProfile({
      full_name: student.full_name,
      dob: student.dob,
      school: student.school,
      grade: student.grade,
      phone,
    }),
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
  const studentPatch: Record<string, string> = {};
  for (const [field, limit] of Object.entries(limits)) {
    const value = body[field];
    if (value !== undefined) {
      if (typeof value !== "string" || value.length > limit) {
        return NextResponse.json({ error: `invalid_${field}` }, { status: 400 });
      }
      studentPatch[field] = value.trim();
    }
  }
  if (
    studentPatch.full_name !== undefined &&
    !isNonEmptyString(studentPatch.full_name, 120)
  ) {
    return NextResponse.json({ error: "invalid_full_name" }, { status: 400 });
  }
  if (
    studentPatch.dob !== undefined &&
    !isValidDateOfBirth(studentPatch.dob)
  ) {
    return NextResponse.json({ error: "invalid_dob" }, { status: 400 });
  }
  if (
    studentPatch.school !== undefined &&
    !isNonEmptyString(studentPatch.school, 160)
  ) {
    return NextResponse.json({ error: "invalid_school" }, { status: 400 });
  }
  if (studentPatch.grade !== undefined) {
    const normalizedGrade = normalizeStudentGrade(studentPatch.grade);
    if (!normalizedGrade) {
      return NextResponse.json({ error: "invalid_grade" }, { status: 400 });
    }
    studentPatch.grade = normalizedGrade;
  }

  let phone: string | undefined;
  if (body.phone !== undefined) {
    phone = normalizeContactPhone(body.phone) ?? undefined;
    if (!phone) {
      return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
    }
  }

  if (Object.keys(studentPatch).length === 0 && phone === undefined) {
    return NextResponse.json({ error: "empty_update" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (Object.keys(studentPatch).length > 0) {
    const { error } = await admin
      .from("students")
      .update(studentPatch)
      .eq("id", actor.studentId);
    if (error) {
      return NextResponse.json({ error: "profile_update_failed" }, { status: 500 });
    }
  }

  const profilePatch: Record<string, string> = {};
  if (studentPatch.full_name) profilePatch.full_name = studentPatch.full_name;
  if (phone) profilePatch.phone = phone;
  if (Object.keys(profilePatch).length > 0) {
    const { error } = await admin
      .from("profiles")
      .update(profilePatch)
      .eq("id", actor.userId);
    if (error) {
      return NextResponse.json({ error: "profile_update_failed" }, { status: 500 });
    }
  }

  if (studentPatch.full_name) {
    await admin.auth.admin.updateUserById(actor.userId, {
      user_metadata: { full_name: studentPatch.full_name },
    });
  }

  const [updatedStudentResult, updatedProfileResult] = await Promise.all([
    admin
      .from("students")
      .select("full_name,dob,school,grade")
      .eq("id", actor.studentId)
      .single(),
    admin
      .from("profiles")
      .select("phone")
      .eq("id", actor.userId)
      .single(),
  ]);
  if (updatedStudentResult.error || updatedProfileResult.error) {
    return NextResponse.json({ error: "profile_update_failed" }, { status: 500 });
  }
  const profileComplete = isCompleteStudentProfile({
    ...updatedStudentResult.data,
    phone: updatedProfileResult.data.phone,
  });

  logEvent("info", "account.profile_updated", {
    actor_id: actor.userId,
    fields: [...Object.keys(studentPatch), ...(phone ? ["phone"] : [])],
    profile_complete: profileComplete,
  });
  return NextResponse.json({
    success: true,
    profile_complete: profileComplete,
  });
}
