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

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Resolve the caller's students row, creating it when it is missing.
 *
 * An account can hold a profiles row with role='student' and no students row at
 * all — handle_new_user() only provisions one for self-service and OAuth
 * signups, so a user added straight from the Supabase dashboard has none. That
 * left the account unusable: the route guard pins it on /student/onboarding
 * because the profile can never be complete, while this endpoint answered 403,
 * so there was no way to fill the profile in. Provision instead of dead-ending.
 */
async function resolveStudentId(
  admin: Admin,
  actor: { userId: string; studentId?: string; email: string | null; displayName: string },
): Promise<string | null> {
  if (actor.studentId) return actor.studentId;

  // limit(1) rather than maybeSingle(): duplicated rows must not read as "none".
  const { data: existing } = await admin
    .from("students")
    .select("id")
    .eq("user_id", actor.userId)
    // Same ordering as getRequestIdentity, tiebreaker included, so both always
    // resolve to the same row when an account has more than one.
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1);
  const found = existing?.[0]?.id;
  if (found) return String(found);

  const studentId = `stu_${actor.userId}`;
  const { error } = await admin.from("students").upsert({
    id: studentId,
    user_id: actor.userId,
    full_name: actor.displayName,
    email: actor.email ?? "",
    dob: "",
    school: "",
    grade: "",
    learning_type: "hybrid",
  });
  if (error) {
    logEvent("error", "account.student_row_provision_failed", {
      actor_id: actor.userId,
      reason: error.message,
    });
    return null;
  }
  logEvent("info", "account.student_row_provisioned", { actor_id: actor.userId });
  return studentId;
}

export async function GET(req: NextRequest) {
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "student") {
    return NextResponse.json({ error: "student_authorization_required" }, { status: 403 });
  }
  const admin = createAdminClient();
  const studentId = await resolveStudentId(admin, actor);
  if (!studentId) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }
  const [studentResult, profileResult] = await Promise.all([
    admin
      .from("students")
      .select("id,full_name,email,dob,school,grade,avatar_url,created_at")
      .eq("id", studentId)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("phone")
      .eq("id", actor.userId)
      .maybeSingle(),
  ]);
  const student = studentResult.data;
  const error = studentResult.error;
  if (error || !student) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }
  const phone = profileResult.data?.phone ?? "";
  return NextResponse.json({
    student_id: student.id,
    full_name: student.full_name ?? "",
    // The auth email first: the form labels this "email bạn dùng để đăng nhập",
    // and students.email is a separate, editable contact field that can drift to
    // a different address — showing that one makes the form claim you are signed
    // in as somebody else. (`||` not `??` because these columns hold '' not NULL.)
    email: actor.email || student.email || "",
    dob: student.dob ?? "",
    school: student.school ?? "",
    grade: student.grade ?? "",
    phone,
    username: actor.email || student.email || "",
    avatar_url: student.avatar_url ?? "",
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
  if (actor?.role !== "student") {
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
  if (body.avatar_url !== undefined) {
    if (typeof body.avatar_url !== "string" || body.avatar_url.length > 1_000) {
      return NextResponse.json({ error: "invalid_avatar_url" }, { status: 400 });
    }
    const expectedPrefix = `/api/files?bucket=avatars&path=${encodeURIComponent(`${actor.userId}/`)}`;
    if (!body.avatar_url.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: "invalid_avatar_url" }, { status: 400 });
    }
    studentPatch.avatar_url = body.avatar_url;
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
  const studentId = await resolveStudentId(admin, actor);
  if (!studentId) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }
  if (Object.keys(studentPatch).length > 0) {
    // Write the ownership link too. This endpoint addresses the row by `id`,
    // while the route guard finds it by `user_id` — so a row with a missing or
    // stale link saves fine here yet stays invisible to the guard, which then
    // reports the profile as incomplete forever. Re-asserting it is a no-op when
    // the link is already correct.
    const { error } = await admin
      .from("students")
      .update({ ...studentPatch, user_id: actor.userId })
      .eq("id", studentId);
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
      .eq("id", studentId)
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
