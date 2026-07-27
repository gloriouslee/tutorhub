import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import {
  checkExamAccess,
  findExamLesson,
  serviceClient,
  getServiceKey,
  verifyStudentExamScope,
} from "@/lib/exam-server";
import { logEvent } from "@/lib/logger";
import { hasValidMutationOrigin } from "@/lib/request-security";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string; lessonId: string }> },
) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const identity = await getRequestIdentity(req);
  if (identity?.role !== "student" || !identity.studentId) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }
  const serviceKey = getServiceKey();
  if (!serviceKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const { classId, lessonId } = await params;
  const admin = serviceClient(serviceKey);
  const lesson = await findExamLesson(admin, classId, lessonId);
  if (!lesson || lesson.type !== "exam") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (
    !(await verifyStudentExamScope(
      admin,
      classId,
      identity.studentId,
      lesson,
    ))
  ) {
    return NextResponse.json({ error: "not_assigned" }, { status: 403 });
  }
  const access = checkExamAccess(lesson);
  if (!access.ok || lesson.exam_content?.allow_retry === false) {
    return NextResponse.json({ error: "retry_not_allowed" }, { status: 409 });
  }

  const { data, error } = await admin.rpc("retry_exam_secure", {
    p_result_id: `${classId}_${lessonId}_${identity.studentId}`,
    p_submissions_id: `${classId}_${lessonId}`,
    p_student_id: identity.studentId,
  });
  if (error) {
    logEvent("error", "exam.retry_failed", {
      actor_id: identity.userId,
      class_id: classId,
      lesson_id: lessonId,
      error: error.message,
    });
    return NextResponse.json({ error: "retry_failed" }, { status: 500 });
  }
  return NextResponse.json({ success: data === true });
}
