import "server-only";

import {
  buildClassLeaderboard,
  type LeaderboardScoreSample,
} from "@/lib/class-leaderboard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CurriculumChapter, StoredExamResult } from "@/lib/storage";

export type LeaderboardClassScope = {
  id: string;
  tutor_id: string;
  student_ids: string[] | null;
};

function chunks<T>(items: T[], size = 50) {
  return Array.from(
    { length: Math.ceil(items.length / size) },
    (_, index) => items.slice(index * size, index * size + size),
  );
}

export function leaderboardStudentIds(classScope: LeaderboardClassScope) {
  return [...new Set((classScope.student_ids ?? []).map(String))];
}

export async function loadLeaderboardClassScope(classId: string) {
  const admin = createAdminClient();
  const core = await admin
    .from("classes")
    .select("id,tutor_id,student_ids")
    .eq("id", classId)
    .maybeSingle();
  if (core.error) throw core.error;
  if (core.data) return core.data as LeaderboardClassScope;

  const extra = await admin
    .from("teacher_extra_classes")
    .select("id,tutor_id,student_ids")
    .eq("id", classId)
    .maybeSingle();
  if (extra.error) throw extra.error;
  return extra.data as LeaderboardClassScope | null;
}

export async function loadClassLeaderboard(
  classScope: LeaderboardClassScope,
  viewer: { studentId?: string; displayName?: string } = {},
) {
  const classId = classScope.id;
  const studentIds = leaderboardStudentIds(classScope);
  if (studentIds.length === 0) {
    return {
      classId,
      generatedAt: new Date().toISOString(),
      ...buildClassLeaderboard([], [], viewer.studentId ?? ""),
    };
  }

  const admin = createAdminClient();
  const [studentsResponse, manualScoresResponse, curriculumResponse] = await Promise.all([
    admin
      .from("students")
      .select("id,full_name,avatar_url")
      .in("id", studentIds),
    admin
      .from("app_exam_scores")
      .select("student_ref,score,max_score,exam_date,created_at")
      .eq("class_id", classId)
      .in("student_ref", studentIds),
    admin
      .from("kv_curriculum")
      .select("value")
      .eq("id", classId)
      .maybeSingle(),
  ]);
  if (studentsResponse.error) throw studentsResponse.error;
  if (manualScoresResponse.error) throw manualScoresResponse.error;
  if (curriculumResponse.error) throw curriculumResponse.error;

  const chapters = (curriculumResponse.data?.value ?? []) as CurriculumChapter[];
  const examIds = chapters
    .flatMap((chapter) => chapter.sessions)
    .flatMap((session) => session.lessons)
    .filter((lesson) => lesson.type === "exam")
    .map((lesson) => lesson.id);
  const registryToExam = new Map(
    examIds.map((examId) => [`${classId}_${examId}`, examId]),
  );
  const registryResponses = await Promise.all(
    chunks([...registryToExam.keys()]).map((ids) =>
      admin.from("kv_exam_submissions").select("id,value").in("id", ids),
    ),
  );
  const failedRegistryQuery = registryResponses.find((response) => response.error);
  if (failedRegistryQuery?.error) throw failedRegistryQuery.error;

  const enrolledStudentIds = new Set(studentIds);
  const resultIds: string[] = [];
  for (const row of registryResponses.flatMap((response) => response.data ?? [])) {
    const examId = registryToExam.get(String(row.id));
    if (!examId || !Array.isArray(row.value)) continue;
    for (const submittedStudentId of row.value) {
      const studentId = String(submittedStudentId);
      if (enrolledStudentIds.has(studentId)) {
        resultIds.push(`${classId}_${examId}_${studentId}`);
      }
    }
  }

  const resultResponses = await Promise.all(
    chunks([...new Set(resultIds)]).map((ids) =>
      admin.from("kv_exam_results").select("value").in("id", ids),
    ),
  );
  const failedResultQuery = resultResponses.find((response) => response.error);
  if (failedResultQuery?.error) throw failedResultQuery.error;

  const samples: LeaderboardScoreSample[] = [
    ...(manualScoresResponse.data ?? []).map((row) => ({
      studentId: String(row.student_ref),
      score: Number(row.score),
      maxScore: Number(row.max_score),
      recordedAt: String(row.exam_date ?? row.created_at ?? ""),
    })),
    ...resultResponses
      .flatMap((response) => response.data ?? [])
      .map((row) => row.value as StoredExamResult)
      .map((result) => ({
        studentId: String(result.student_id),
        score: Number(result.score),
        maxScore: Number(result.total),
        recordedAt: result.submitted_at,
      })),
  ];

  const studentsById = new Map(
    (studentsResponse.data ?? []).map((student) => [String(student.id), student]),
  );
  const students = studentIds.map((studentId) => {
    const student = studentsById.get(studentId);
    return {
      id: studentId,
      fullName: String(
        student?.full_name
        ?? (studentId === viewer.studentId ? viewer.displayName : "Học viên"),
      ),
      avatarUrl: typeof student?.avatar_url === "string" ? student.avatar_url : "",
    };
  });

  return {
    classId,
    generatedAt: new Date().toISOString(),
    ...buildClassLeaderboard(students, samples, viewer.studentId ?? ""),
  };
}
