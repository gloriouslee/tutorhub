import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { sanitizeStudentCurriculum } from "@/lib/student-learning-server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CurriculumChapter, StoredExamResult } from "@/lib/storage";

const PRIVATE_NO_STORE = {
  headers: { "Cache-Control": "private, no-store" },
};

function requestedClassIds(req: NextRequest): string[] {
  return [...new Set(
    (req.nextUrl.searchParams.get("class_ids") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )].slice(0, 50);
}

export async function GET(req: NextRequest) {
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "student" || !actor.studentId) {
    return NextResponse.json(
      { error: "student_authorization_required" },
      { status: 403 },
    );
  }

  const requested = requestedClassIds(req);
  if (requested.length === 0) {
    return NextResponse.json(
      { curricula: {}, examResults: {} },
      PRIVATE_NO_STORE,
    );
  }

  try {
    const admin = createAdminClient();
    const { data: enrolled, error: enrollmentError } = await admin
      .from("classes")
      .select("id")
      .in("id", requested)
      .contains("student_ids", [actor.studentId]);
    if (enrollmentError) throw enrollmentError;

    const allowedIds = (enrolled ?? []).map((row) => String(row.id));
    if (allowedIds.length === 0) {
      return NextResponse.json(
        { curricula: {}, examResults: {} },
        PRIVATE_NO_STORE,
      );
    }

    const { data: curriculumRows, error: curriculumError } = await admin
      .from("kv_curriculum")
      .select("id,value")
      .in("id", allowedIds);
    if (curriculumError) throw curriculumError;

    const curricula = Object.fromEntries(allowedIds.map((classId) => [
      classId,
      sanitizeStudentCurriculum(
        (curriculumRows ?? []).find((row) => String(row.id) === classId)?.value ?? [],
        actor.studentId!,
      ),
    ])) as Record<string, CurriculumChapter[]>;

    const examRefs = Object.entries(curricula).flatMap(([classId, chapters]) =>
      chapters.flatMap((chapter) =>
        chapter.sessions.flatMap((session) =>
          session.lessons
            .filter((lesson) => lesson.type === "exam")
            .map((lesson) => ({ classId, lessonId: lesson.id })),
        ),
      ),
    );
    const resultIds = examRefs.map(
      ({ classId, lessonId }) => `${classId}_${lessonId}_${actor.studentId}`,
    );
    const chunks = Array.from(
      { length: Math.ceil(resultIds.length / 50) },
      (_, index) => resultIds.slice(index * 50, index * 50 + 50),
    );
    const responses = await Promise.all(
      chunks.map((ids) => admin.from("kv_exam_results").select("id,value").in("id", ids)),
    );
    const failed = responses.find((response) => response.error);
    if (failed?.error) throw failed.error;

    const resultById = new Map(
      responses
        .flatMap((response) => response.data ?? [])
        .map((row) => [String(row.id), row.value as StoredExamResult]),
    );
    const examResults = Object.fromEntries(
      examRefs.flatMap(({ classId, lessonId }) => {
        const result = resultById.get(`${classId}_${lessonId}_${actor.studentId}`);
        return result ? [[`${classId}:${lessonId}`, result]] : [];
      }),
    );

    return NextResponse.json({ curricula, examResults }, PRIVATE_NO_STORE);
  } catch {
    return NextResponse.json(
      { error: "learning_snapshot_unavailable" },
      { status: 500 },
    );
  }
}

