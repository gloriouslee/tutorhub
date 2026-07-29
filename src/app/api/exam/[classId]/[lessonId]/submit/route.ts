import { NextRequest, NextResponse } from "next/server";
import {
  getServiceKey, serviceClient, findExamLesson, checkExamAccess,
  sanitizeQuestions, calcScoreServer, calcTotalServer, kvGetServer,
  examResultId, verifyStudentExamScope,
  type StoredExamResult, type StudentAnswer,
} from "@/lib/exam-server";
import { getRequestIdentity } from "@/lib/api-auth";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { logEvent } from "@/lib/logger";

// POST /api/exam/[classId]/[lessonId]/submit
// Body: { studentId, studentName, answers }
// Server tự chấm điểm từ đề gốc — client không bao giờ thấy đáp án trước khi nộp.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string; lessonId: string }> }
) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const serviceKey = getServiceKey();
  if (!serviceKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }
  const { classId, lessonId } = await params;

  let body: { studentId?: string; studentName?: string; answers?: Record<string, StudentAnswer>; duration_seconds?: number; attempt?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const identity = await getRequestIdentity(req);
  if (identity?.role !== "student" || !identity.studentId) {
    return NextResponse.json({ error: "authentication_required" }, { status: 403 });
  }
  if (body.studentId && body.studentId !== identity.studentId) {
    return NextResponse.json({ error: "student_mismatch" }, { status: 403 });
  }
  const studentId = identity.studentId;
  const studentName = identity.displayName;
  const answers = body.answers ?? {};
  if (
    !answers ||
    typeof answers !== "object" ||
    Array.isArray(answers) ||
    JSON.stringify(answers).length > 500_000
  ) {
    return NextResponse.json({ error: "invalid_answers" }, { status: 400 });
  }

  const admin = serviceClient(serviceKey);
  let lesson;
  try {
    lesson = await findExamLesson(admin, classId, lessonId);
  } catch (e) {
    logEvent("error", "exam.submit_load_failed", {
      actor_id: identity.userId,
      class_id: classId,
      lesson_id: lessonId,
      error: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json({ error: "exam_load_failed" }, { status: 500 });
  }
  if (!lesson || lesson.type !== "exam") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!(await verifyStudentExamScope(admin, classId, studentId, lesson))) {
    return NextResponse.json({ error: "not_assigned" }, { status: 403 });
  }
  const access = checkExamAccess(lesson);
  if (!access.ok) {
    return NextResponse.json(
      { error: "forbidden", reason: access.reason, opens_at: access.opens_at ?? null },
      { status: 403 }
    );
  }

  const resultId = examResultId(classId, lessonId, studentId);
  try {
    // Check trước để trả lỗi rõ; RPC bên dưới vẫn là nguồn chống race chính.
    const existing = await kvGetServer<StoredExamResult>(admin, "kv_exam_results", resultId);
    if (existing) {
      return NextResponse.json({ error: "already_submitted" }, { status: 409 });
    }

    const questions = lesson.exam_content?.questions ?? [];
    const score = calcScoreServer(questions, answers, lesson.exam_content?.true_false_scale);
    const total = calcTotalServer(questions);
    const result: StoredExamResult = {
      student_id: studentId,
      student_name: studentName,
      score,
      total,
      submitted_at: new Date().toISOString(),
      answers: answers as Record<string, unknown>,
      duration_seconds: typeof body.duration_seconds === "number" ? body.duration_seconds : undefined,
      attempt: typeof body.attempt === "number" ? body.attempt : undefined,
    };

    const { data: saved, error: saveError } = await admin.rpc(
      "submit_exam_result_secure",
      {
        p_result_id: resultId,
        p_submissions_id: `${classId}_${lessonId}`,
        p_student_id: studentId,
        p_result: result,
        p_allow_retry: lesson.exam_content?.allow_retry !== false,
      },
    );
    if (saveError) {
      if (saveError.message.includes("already_submitted")) {
        return NextResponse.json({ error: "already_submitted" }, { status: 409 });
      }
      if (saveError.message.includes("retry_not_allowed")) {
        return NextResponse.json({ error: "retry_not_allowed" }, { status: 409 });
      }
      throw saveError;
    }
    if (saved !== true) throw new Error("exam_result_not_saved");

    const showSolution = lesson.exam_content?.show_solution_after_submit !== false;
    return NextResponse.json({
      submitted: true,
      result,
      show_solution_after_submit: showSolution,
      questions: sanitizeQuestions(questions, showSolution),
    });
  } catch (e) {
    logEvent("error", "exam.submit_failed", {
      actor_id: identity.userId,
      class_id: classId,
      lesson_id: lessonId,
      error: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json({ error: "exam_submit_failed" }, { status: 500 });
  }
}
