import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { isNonEmptyString } from "@/lib/validation";

async function teacherOwnsClass(
  admin: ReturnType<typeof createAdminClient>,
  teacherId: string,
  classId: string,
  studentId?: string,
) {
  for (const table of ["classes", "teacher_extra_classes"] as const) {
    let query = admin.from(table).select("id").eq("id", classId).eq("tutor_id", teacherId);
    if (studentId) query = query.contains("student_ids", [studentId]);
    const { data } = await query.maybeSingle();
    if (data) return true;
  }
  return false;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (!actor || !["teacher", "admin"].includes(actor.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  if (!id || id.length > 100) {
    return NextResponse.json({ error: "invalid_score_id" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: score, error: lookupError } = await admin
    .from("app_exam_scores")
    .select("id,class_id")
    .eq("id", id)
    .maybeSingle();
  if (lookupError || !score) {
    return NextResponse.json({ error: "score_not_found" }, { status: 404 });
  }
  if (actor.role === "teacher") {
    if (!(await teacherOwnsClass(admin, actor.teacherId ?? "", String(score.class_id)))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }
  const { error } = await admin.from("app_exam_scores").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "score_delete_failed" }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (!actor || !["teacher", "admin"].includes(actor.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  if (!id || id.length > 100) {
    return NextResponse.json({ error: "invalid_score_id" }, { status: 400 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    !isNonEmptyString(body.class_id, 100)
    || !isNonEmptyString(body.exam_name, 200)
    || !isNonEmptyString(body.exam_date, 10)
    || typeof body.score !== "number" || !Number.isFinite(body.score)
    || typeof body.max_score !== "number" || !Number.isFinite(body.max_score)
    || body.max_score <= 0 || body.score < 0 || body.score > body.max_score
  ) {
    return NextResponse.json({ error: "invalid_score" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: current, error: lookupError } = await admin.from("app_exam_scores")
    .select("id,student_ref")
    .eq("id", id)
    .maybeSingle();
  if (lookupError || !current) {
    return NextResponse.json({ error: "score_not_found" }, { status: 404 });
  }
  if (
    actor.role === "teacher"
    && !(await teacherOwnsClass(admin, actor.teacherId ?? "", body.class_id, String(current.student_ref)))
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { data, error } = await admin.from("app_exam_scores").update({
    class_id: body.class_id,
    exam_name: body.exam_name.trim(),
    score: body.score,
    max_score: body.max_score,
    exam_date: body.exam_date,
  }).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: "score_update_failed" }, { status: 500 });
  return NextResponse.json({ ...data, student_id: data.student_ref });
}
