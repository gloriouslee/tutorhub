import { NextRequest, NextResponse } from "next/server";
import {
  getServiceKey, serviceClient, findExamLesson, checkExamAccess,
  sanitizeQuestions, kvGetServer, examResultId,
  type StoredExamResult,
} from "@/lib/exam-server";

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
  const studentId = req.nextUrl.searchParams.get("studentId") ?? "";
  if (!studentId) {
    return NextResponse.json({ error: "studentId required" }, { status: 400 });
  }

  const admin = serviceClient(serviceKey);
  let lesson;
  try {
    lesson = await findExamLesson(admin, classId, lessonId);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
  if (!lesson || lesson.type !== "exam") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
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
