import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import {
  buildClassLeaderboard,
  type LeaderboardScoreSample,
} from "@/lib/class-leaderboard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CurriculumChapter, StoredExamResult } from "@/lib/storage";

const PRIVATE_NO_STORE = {
  headers: { "Cache-Control": "private, no-store" },
};

type ClassScope = {
  id: string;
  student_ids: string[] | null;
};

function chunks<T>(items: T[], size = 50) {
  return Array.from(
    { length: Math.ceil(items.length / size) },
    (_, index) => items.slice(index * size, index * size + size),
  );
}

async function loadClassScope(classId: string) {
  const admin = createAdminClient();
  const core = await admin
    .from("classes")
    .select("id,student_ids")
    .eq("id", classId)
    .maybeSingle();
  if (core.error) throw core.error;
  if (core.data) return core.data as ClassScope;

  const extra = await admin
    .from("teacher_extra_classes")
    .select("id,student_ids")
    .eq("id", classId)
    .maybeSingle();
  if (extra.error) throw extra.error;
  return extra.data as ClassScope | null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const identity = await getRequestIdentity(req);
  if (identity?.role !== "student" || !identity.studentId) {
    return NextResponse.json(
      { error: "student_authorization_required" },
      { status: 403, ...PRIVATE_NO_STORE },
    );
  }

  const { classId } = await params;
  if (!classId || classId.length > 120) {
    return NextResponse.json(
      { error: "invalid_class_id" },
      { status: 400, ...PRIVATE_NO_STORE },
    );
  }

  try {
    const classScope = await loadClassScope(classId);
    if (!classScope) {
      return NextResponse.json(
        { error: "not_found" },
        { status: 404, ...PRIVATE_NO_STORE },
      );
    }

    const studentIds = [...new Set((classScope.student_ids ?? []).map(String))];
    if (!studentIds.includes(identity.studentId)) {
      return NextResponse.json(
        { error: "forbidden" },
        { status: 403, ...PRIVATE_NO_STORE },
      );
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
    const registryChunks = chunks([...registryToExam.keys()]);
    const registryResponses = await Promise.all(
      registryChunks.map((ids) =>
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
          ?? (studentId === identity.studentId ? identity.displayName : "Học viên"),
        ),
        avatarUrl: typeof student?.avatar_url === "string" ? student.avatar_url : "",
      };
    });
    const leaderboard = buildClassLeaderboard(students, samples, identity.studentId);

    return NextResponse.json(
      {
        classId,
        generatedAt: new Date().toISOString(),
        ...leaderboard,
      },
      PRIVATE_NO_STORE,
    );
  } catch {
    return NextResponse.json(
      { error: "leaderboard_unavailable" },
      { status: 500, ...PRIVATE_NO_STORE },
    );
  }
}
