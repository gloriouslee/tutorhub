import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CurriculumChapter, StoredExamResult } from "@/lib/storage";
import type { SubmissionRecord } from "@/lib/supabase/submissions";

const PRIVATE_NO_STORE = {
  headers: { "Cache-Control": "private, no-store" },
};

type ClassScope = {
  id: string;
  tutor_id: string;
  student_ids: string[] | null;
};

async function loadClassScope(classId: string) {
  const admin = createAdminClient();
  const core = await admin
    .from("classes")
    .select("id,tutor_id,student_ids")
    .eq("id", classId)
    .maybeSingle();
  if (core.error) throw core.error;
  if (core.data) return core.data as ClassScope;

  const extra = await admin
    .from("teacher_extra_classes")
    .select("id,tutor_id,student_ids")
    .eq("id", classId)
    .maybeSingle();
  if (extra.error) throw extra.error;
  return extra.data as ClassScope | null;
}

// Teacher-owned, server-scoped source for both online exam results and file submissions.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const identity = await getRequestIdentity(req);
  if (!identity || (identity.role !== "teacher" && identity.role !== "admin")) {
    return NextResponse.json({ error: "authentication_required" }, { status: 403 });
  }

  const { classId } = await params;
  try {
    const classScope = await loadClassScope(classId);
    if (!classScope) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (identity.role === "teacher" && classScope.tutor_id !== identity.teacherId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    const [curriculumResponse, manualHomeworkResponse] = await Promise.all([
      admin.from("kv_curriculum").select("value").eq("id", classId).maybeSingle(),
      admin.from("teacher_homework").select("id").eq("class_id", classId),
    ]);
    if (curriculumResponse.error) throw curriculumResponse.error;
    if (manualHomeworkResponse.error) throw manualHomeworkResponse.error;

    const lessons = ((curriculumResponse.data?.value ?? []) as CurriculumChapter[])
      .flatMap((chapter) => chapter.sessions)
      .flatMap((session) => session.lessons);
    const examIds = lessons.filter((lesson) => lesson.type === "exam").map((lesson) => lesson.id);
    const homeworkIds = [
      ...lessons.filter((lesson) => lesson.type === "homework").map((lesson) => lesson.id),
      ...(manualHomeworkResponse.data ?? []).map((row) => String(row.id)),
    ];

    const registryIds = examIds.map((lessonId) => `${classId}_${lessonId}`);
    const [registriesResponse, fileResponse] = await Promise.all([
      registryIds.length > 0
        ? admin.from("kv_exam_submissions").select("id,value").in("id", registryIds)
        : Promise.resolve({ data: [], error: null }),
      homeworkIds.length > 0
        ? admin.from("hw_submissions").select("class_id,data").eq("class_id", classId).in("homework_id", homeworkIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (registriesResponse.error) throw registriesResponse.error;
    if (fileResponse.error) throw fileResponse.error;

    const lessonByRegistryId = new Map(
      examIds.map((lessonId) => [`${classId}_${lessonId}`, lessonId]),
    );
    // The registry already contains the students who submitted each exam.
    // Query only those exact rows instead of every exam × every class student.
    const resultIds = (registriesResponse.data ?? []).flatMap((row) => {
      const lessonId = lessonByRegistryId.get(String(row.id));
      if (!lessonId || !Array.isArray(row.value)) return [];
      return row.value.map(
        (studentId) => `${classId}_${lessonId}_${String(studentId)}`,
      );
    });
    // Keep each PostgREST URL bounded even for large classes with many exams.
    const resultChunks = Array.from(
      { length: Math.ceil(resultIds.length / 50) },
      (_, index) => resultIds.slice(index * 50, index * 50 + 50),
    );
    const resultResponses = await Promise.all(
      resultChunks.map((ids) => admin.from("kv_exam_results").select("id,value").in("id", ids)),
    );
    const failedResultQuery = resultResponses.find((response) => response.error);
    if (failedResultQuery?.error) throw failedResultQuery.error;
    const resultRows = resultResponses.flatMap((response) => response.data ?? []);

    const examResults = Object.fromEntries(examIds.map((lessonId) => [lessonId, [] as StoredExamResult[]]));
    for (const row of resultRows) {
      const lessonId = examIds.find((candidate) => row.id.startsWith(`${classId}_${candidate}_`));
      if (lessonId) examResults[lessonId].push(row.value as StoredExamResult);
    }

    const fileSubmissions = (fileResponse.data ?? []).map((row) => ({
      ...(row.data as SubmissionRecord),
      class_id: row.class_id ?? (row.data as SubmissionRecord).class_id,
    }));

    return NextResponse.json({ examResults, fileSubmissions }, PRIVATE_NO_STORE);
  } catch {
    return NextResponse.json({ error: "submission_snapshot_unavailable" }, { status: 500 });
  }
}
