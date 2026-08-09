import type { StoredExamResult } from "@/lib/storage";
import type { SubmissionRecord } from "@/lib/supabase/submissions";

export type TeacherSubmissionSnapshot = {
  examResults: Record<string, StoredExamResult[]>;
  fileSubmissions: SubmissionRecord[];
};

export function emptyTeacherSubmissionSnapshot(): TeacherSubmissionSnapshot {
  return { examResults: {}, fileSubmissions: [] };
}

export async function getTeacherSubmissionSnapshot(classId: string): Promise<TeacherSubmissionSnapshot> {
  const response = await fetch(
    `/api/teacher/classes/${encodeURIComponent(classId)}/submissions`,
    { cache: "no-store", credentials: "same-origin" },
  );
  if (!response.ok) throw new Error("submission_snapshot_unavailable");
  return response.json() as Promise<TeacherSubmissionSnapshot>;
}
