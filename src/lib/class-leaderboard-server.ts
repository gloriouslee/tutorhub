import "server-only";

import {
  buildClassLeaderboard,
  DEFAULT_CLASS_LEADERBOARD_SETTINGS,
  filterLeaderboardSamplesForPeriod,
  type ClassLeaderboardEntry,
  type ClassLeaderboardSettings,
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

type LeaderboardSettingsRow = {
  enabled?: unknown;
  period?: unknown;
  term_start_date?: unknown;
  minimum_assessments?: unknown;
  privacy_mode?: unknown;
  updated_at?: unknown;
};

function normalizeLeaderboardSettings(row?: LeaderboardSettingsRow | null): ClassLeaderboardSettings {
  const period = ["all_time", "last_7_days", "last_30_days", "term"].includes(String(row?.period))
    ? String(row?.period) as ClassLeaderboardSettings["period"]
    : DEFAULT_CLASS_LEADERBOARD_SETTINGS.period;
  const privacyMode = ["full_name", "abbreviated", "anonymous"].includes(String(row?.privacy_mode))
    ? String(row?.privacy_mode) as ClassLeaderboardSettings["privacyMode"]
    : DEFAULT_CLASS_LEADERBOARD_SETTINGS.privacyMode;
  const minimumAssessments = Number(row?.minimum_assessments);

  return {
    enabled: typeof row?.enabled === "boolean" ? row.enabled : DEFAULT_CLASS_LEADERBOARD_SETTINGS.enabled,
    period,
    termStartDate: typeof row?.term_start_date === "string" ? row.term_start_date : null,
    minimumAssessments: Number.isInteger(minimumAssessments)
      ? Math.min(20, Math.max(1, minimumAssessments))
      : DEFAULT_CLASS_LEADERBOARD_SETTINGS.minimumAssessments,
    privacyMode,
    updatedAt: typeof row?.updated_at === "string" ? row.updated_at : null,
  };
}

export async function loadClassLeaderboardSettings(classId: string) {
  const { data, error } = await createAdminClient()
    .from("class_leaderboard_settings")
    .select("enabled,period,term_start_date,minimum_assessments,privacy_mode,updated_at")
    .eq("class_id", classId)
    .maybeSingle();
  // Keep existing deployments functional until the new migration is applied.
  if (error && ["42P01", "PGRST205"].includes(error.code)) {
    return { ...DEFAULT_CLASS_LEADERBOARD_SETTINGS };
  }
  if (error) throw error;
  return normalizeLeaderboardSettings(data);
}

export async function saveClassLeaderboardSettings(
  classId: string,
  settings: Omit<ClassLeaderboardSettings, "updatedAt">,
  updatedBy: string,
) {
  const updatedAt = new Date().toISOString();
  const { data, error } = await createAdminClient()
    .from("class_leaderboard_settings")
    .upsert({
      class_id: classId,
      enabled: settings.enabled,
      period: settings.period,
      term_start_date: settings.period === "term" ? settings.termStartDate : null,
      minimum_assessments: settings.minimumAssessments,
      privacy_mode: settings.privacyMode,
      updated_by: updatedBy,
      updated_at: updatedAt,
    }, { onConflict: "class_id" })
    .select("enabled,period,term_start_date,minimum_assessments,privacy_mode,updated_at")
    .single();
  if (error) throw error;
  return normalizeLeaderboardSettings(data);
}

function abbreviatedName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "Học viên";
  return `${parts[0]} ${parts.slice(1).map((part) => `${part[0]?.toLocaleUpperCase("vi") ?? ""}.`).join(" ")}`;
}

export function applyStudentLeaderboardPrivacy<
  T extends { entries: ClassLeaderboardEntry[]; settings: ClassLeaderboardSettings },
>(leaderboard: T, currentStudentId: string): T {
  if (leaderboard.settings.privacyMode === "full_name") return leaderboard;
  const aliasByStudent = new Map(
    [...leaderboard.entries]
      .sort((a, b) => a.studentId.localeCompare(b.studentId))
      .map((entry, index) => [entry.studentId, `Học viên ${String(index + 1).padStart(2, "0")}`]),
  );

  return {
    ...leaderboard,
    entries: leaderboard.entries.map((entry) => {
      if (entry.studentId === currentStudentId) return entry;
      return {
        ...entry,
        displayName: leaderboard.settings.privacyMode === "anonymous"
          ? aliasByStudent.get(entry.studentId) ?? "Học viên"
          : abbreviatedName(entry.displayName),
        avatarUrl: "",
      };
    }),
  } as T;
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
  providedSettings?: ClassLeaderboardSettings,
) {
  const classId = classScope.id;
  const settings = providedSettings ?? await loadClassLeaderboardSettings(classId);
  const studentIds = leaderboardStudentIds(classScope);
  if (studentIds.length === 0) {
    return {
      classId,
      generatedAt: new Date().toISOString(),
      settings,
      ...buildClassLeaderboard([], [], viewer.studentId ?? "", {
        minimumAssessments: settings.minimumAssessments,
      }),
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
    settings,
    ...buildClassLeaderboard(
      students,
      filterLeaderboardSamplesForPeriod(samples, settings),
      viewer.studentId ?? "",
      { minimumAssessments: settings.minimumAssessments },
    ),
  };
}
