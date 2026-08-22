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

export async function getTeacherSubmissionSnapshot(classId: string): Promise<TeacherSubmissionSnapshot> {
  return cachedJsonFetch<TeacherSubmissionSnapshot>(
    `teacher-submission-snapshot:${classId}`,
    `/api/teacher/classes/${encodeURIComponent(classId)}/submissions`,
    { cache: "no-store", credentials: "same-origin" },
    5_000,
  );
}
