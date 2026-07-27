import { NextRequest, NextResponse } from "next/server";
import {
  getServiceKey, serviceClient, findExamLesson, checkExamAccess,
  sanitizeQuestions, kvGetServer, examResultId, verifyStudentExamScope,
  type StoredExamResult,
} from "@/lib/exam-server";
import { getRequestIdentity } from "@/lib/api-auth";
import { logEvent } from "@/lib/logger";

// GET /api/exam/[classId]/[lessonId]?studentId=...
// Trả đề thi ĐÃ LỌC ĐÁP ÁN cho học sinh. Nếu đã nộp → kèm kết quả,
// và (nếu được xem lời giải) bộ câu hỏi đầy đủ để review.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string; lessonId: string }> }
) {
  const serviceKey = getServiceKey();
  if (!serviceKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }
  const { classId, lessonId } = await params;
  const requestedStudentId = req.nextUrl.searchParams.get("studentId") ?? "";
  const identity = await getRequestIdentity(req);
  if (identity?.role !== "student" || !identity.studentId) {
    return NextResponse.json({ error: "authentication_required" }, { status: 403 });
  }
  if (requestedStudentId && requestedStudentId !== identity.studentId) {
    return NextResponse.json({ error: "student_mismatch" }, { status: 403 });
  }
  const studentId = identity.studentId;

  const admin = serviceClient(serviceKey);
  let lesson;
  try {
    lesson = await findExamLesson(admin, classId, lessonId);
  } catch (e) {
    logEvent("error", "exam.load_failed", {
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

  const questions = lesson.exam_content?.questions ?? [];
  const showSolution = lesson.exam_content?.show_solution_after_submit !== false;

  let result: StoredExamResult | null = null;
  try {
    result = await kvGetServer<StoredExamResult>(
      admin, "kv_exam_results", examResultId(classId, lessonId, studentId)
    );
  } catch { /* kết quả không đọc được — coi như chưa nộp */ }

  const base = {
    title: lesson.title,
    time_limit: lesson.exam_content?.time_limit ?? null,
    show_solution_after_submit: showSolution,
    allow_retry: lesson.exam_content?.allow_retry !== false,
  };

  if (result) {
    // Đã nộp — cho review. Chỉ trả đáp án đầy đủ khi giáo viên mở lời giải.
    return NextResponse.json({
      ...base,
      submitted: true,
      result,
      questions: showSolution ? questions : sanitizeQuestions(questions),
    });
  }

  return NextResponse.json({
    ...base,
    submitted: false,
    questions: sanitizeQuestions(questions),
  });
}
