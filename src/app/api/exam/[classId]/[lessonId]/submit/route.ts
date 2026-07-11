import { NextRequest, NextResponse } from "next/server";
import {
  getServiceKey, serviceClient, findExamLesson, checkExamAccess,
  sanitizeQuestions, calcScoreServer, calcTotalServer, kvGetServer, kvSetServer,
  examResultId, examSubmissionsId,
  type StoredExamResult, type StudentAnswer,
} from "@/lib/exam-server";
import { getRequestIdentity } from "@/lib/api-auth";

// POST /api/exam/[classId]/[lessonId]/submit
// Body: { studentId, studentName, answers }
// Server tự chấm điểm từ đề gốc — client không bao giờ thấy đáp án trước khi nộp.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string; lessonId: string }> }
) {
  const serviceKey = getServiceKey();
  if (!serviceKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }
  const { classId, lessonId } = await params;

  let body: { studentId?: string; studentName?: string; answers?: Record<string, StudentAnswer> };
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
  const studentName = body.studentName ?? "";
  const answers = body.answers ?? {};

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

  const resultId = examResultId(classId, lessonId, studentId);
  try {
    // Đã nộp rồi → 409. (Luồng "làm lại" xóa row này client-side trước,
    // nên không có row = được phép nộp lại.)
    const existing = await kvGetServer<StoredExamResult>(admin, "kv_exam_results", resultId);
    if (existing) {
      return NextResponse.json({ error: "already_submitted" }, { status: 409 });
    }

    // Giáo viên tắt "Cho làm lại": registry bài nộp còn ghi vết dù kết quả
    // đã bị xóa client-side → chặn nộp lần 2 tại server (không lách được).
    if (lesson.exam_content?.allow_retry === false) {
      const subsIdCheck = examSubmissionsId(classId, lessonId);
      const submittedIds = (await kvGetServer<string[]>(admin, "kv_exam_submissions", subsIdCheck)) ?? [];
      if (submittedIds.includes(studentId)) {
        return NextResponse.json({ error: "retry_not_allowed" }, { status: 409 });
      }
    }

    const questions = lesson.exam_content?.questions ?? [];
    const score = calcScoreServer(questions, answers);
    const total = calcTotalServer(questions);
    const result: StoredExamResult = {
      student_id: studentId,
      student_name: studentName,
      score,
      total,
      submitted_at: new Date().toISOString(),
      answers: answers as Record<string, unknown>,
    };

    await kvSetServer(admin, "kv_exam_results", resultId, result);

    // Sổ đăng ký bài nộp (read-modify-write server-side)
    const subsId = examSubmissionsId(classId, lessonId);
    const subs = (await kvGetServer<string[]>(admin, "kv_exam_submissions", subsId)) ?? [];
    if (!subs.includes(studentId)) {
      await kvSetServer(admin, "kv_exam_submissions", subsId, [...subs, studentId]);
    }

    const showSolution = lesson.exam_content?.show_solution_after_submit !== false;
    return NextResponse.json({
      submitted: true,
      result,
      show_solution_after_submit: showSolution,
      questions: showSolution ? questions : sanitizeQuestions(questions),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
