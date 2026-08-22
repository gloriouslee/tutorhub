import type { StoredExamResult } from "@/lib/storage";
import type { SubmissionRecord } from "@/lib/supabase/submissions";
import { cachedJsonFetch } from "@/lib/client-query-cache";

export type TeacherSubmissionSnapshot = {
  examResults: Record<string, StoredExamResult[]>;
  fileSubmissions: SubmissionRecord[];
};

export function emptyTeacherSubmissionSnapshot(): TeacherSubmissionSnapshot {
  return { examResults: {}, fileSubmissions: [] };
}

export async function getTeacherSubmissionSnapshots(
  classIds: readonly string[],
): Promise<Record<string, TeacherSubmissionSnapshot>> {
  const ids = [...new Set(classIds.filter(Boolean))];
  if (ids.length === 0) return {};
  return cachedJsonFetch<Record<string, TeacherSubmissionSnapshot>>(
    `teacher-submission-snapshots:${[...ids].sort().join(",")}`,
    `/api/teacher/submissions?class_ids=${encodeURIComponent(ids.join(","))}`,
    { cache: "no-store", credentials: "same-origin" },
    5_000,
  );
}

export async function getTeacherSubmissionSnapshot(classId: string): Promise<TeacherSubmissionSnapshot> {
  const snapshots = await getTeacherSubmissionSnapshots([classId]);
  return snapshots[classId] ?? emptyTeacherSubmissionSnapshot();
}
