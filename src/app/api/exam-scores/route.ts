import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNonEmptyString } from "@/lib/validation";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { parentCanAccessStudent } from "@/lib/guardian-server";

async function canAccessStudent(
  actor: NonNullable<Awaited<ReturnType<typeof getRequestIdentity>>>,
  studentId: string,
  classId?: string,
) {
  if (actor.role === "admin") return true;
  if (actor.role === "student") return actor.studentId === studentId;
  const admin = createAdminClient();
  if (actor.role === "parent" && actor.parentId) {
    return parentCanAccessStudent(admin, actor.parentId, studentId);
  }
  if (actor.role === "teacher" && actor.teacherId) {
    // Classes live in `classes` (admin) or `teacher_extra_classes` (teacher).
    for (const table of ["classes", "teacher_extra_classes"] as const) {
      let query = admin
        .from(table)
        .select("id")
        .eq("tutor_id", actor.teacherId)
        .contains("student_ids", [studentId]);
      if (classId) query = query.eq("id", classId);
      const { data } = await query.limit(1).maybeSingle();
      if (data) return true;
    }
    return false;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const actor = await getRequestIdentity(req);
  if (!actor) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }
  const studentRef = req.nextUrl.searchParams.get("student_ref");
  const classId = req.nextUrl.searchParams.get("class_id") ?? undefined;
  if (req.nextUrl.searchParams.get("all") === "true" && (actor.role === "admin" || actor.role === "teacher")) {
    const admin = createAdminClient();
    let allowedClassIds: string[] | null = null;
    if (actor.role === "teacher") {
      const results = await Promise.all([
        admin.from("classes").select("id").eq("tutor_id", actor.teacherId ?? ""),
        admin.from("teacher_extra_classes").select("id").eq("tutor_id", actor.teacherId ?? ""),
      ]);
      const failed = results.find((result) => result.error);
      if (failed?.error) return NextResponse.json({ error: "score_list_failed" }, { status: 500 });
      allowedClassIds = [...new Set(results.flatMap((result) => (result.data ?? []).map((row) => String(row.id))))];
      if (allowedClassIds.length === 0) return NextResponse.json([]);
    }
    let query = admin.from("app_exam_scores").select("*").order("exam_date", { ascending: false });
    if (allowedClassIds) query = query.in("class_id", allowedClassIds);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "score_list_failed" }, { status: 500 });
    return NextResponse.json(
      (data ?? []).map((row) => ({ ...row, student_id: row.student_ref })),
    );
  }
  if (!studentRef || !(await canAccessStudent(actor, studentRef, classId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let query = createAdminClient()
    .from("app_exam_scores")
    .select("*")
    .eq("student_ref", studentRef)
    .order("exam_date", { ascending: false });
  if (classId) query = query.eq("class_id", classId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "score_list_failed" }, { status: 500 });
  return NextResponse.json(
    (data ?? []).map((row) => ({ ...row, student_id: row.student_ref })),
  );
}

export async function POST(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (!actor || !["teacher", "admin"].includes(actor.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    !isNonEmptyString(body.student_ref, 100) ||
    !isNonEmptyString(body.class_id, 100) ||
    !isNonEmptyString(body.exam_name, 200) ||
    !isNonEmptyString(body.exam_date, 10) ||
    typeof body.score !== "number" ||
    typeof body.max_score !== "number" ||
    !Number.isFinite(body.score) ||
    !Number.isFinite(body.max_score) ||
    body.max_score <= 0 ||
    body.score < 0 ||
    body.score > body.max_score
  ) {
    return NextResponse.json({ error: "invalid_score" }, { status: 400 });
  }
  if (!(await canAccessStudent(actor, body.student_ref, body.class_id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { data, error } = await createAdminClient()
    .from("app_exam_scores")
    .insert({
      id: typeof body.id === "string" ? body.id.slice(0, 100) : crypto.randomUUID(),
      student_ref: body.student_ref,
      class_id: body.class_id,
      exam_name: body.exam_name.trim(),
      score: body.score,
      max_score: body.max_score,
      exam_date: body.exam_date,
      created_by: actor.userId,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "score_create_failed" }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
