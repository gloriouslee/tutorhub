import { createClient } from "@/lib/supabase/client";
import {
  cachedClientQuery,
  invalidateClientQueries,
  normalizedQueryKey,
} from "@/lib/client-query-cache";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SubmissionRecord {
  id: string;
  class_id?: string;
  homework_id: string;
  student_id: string;
  student_name?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  status: "submitted" | "graded" | "returned";
  submitted_at: string;
  score?: number;
  feedback?: string;
  graded_at?: string;
  teacher_file_url?: string;
  teacher_file_name?: string;
}

const BUCKET = "homework-submissions";

// ── File upload ───────────────────────────────────────────────────────────────
export async function uploadSubmissionFile(
  classId: string,
  homeworkId: string,
  studentId: string,
  file: File
): Promise<{ url: string; path: string } | null> {
  const supabase = createClient();
  // Sanitize filename: remove spaces and special chars
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${classId}/submissions/${studentId}/${homeworkId}/${Date.now()}_${safeName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error || !data) {
    console.error("Storage upload error:", error?.message);
    return null;
  }

  return {
    url: `/api/files?bucket=${BUCKET}&path=${encodeURIComponent(data.path)}`,
    path: data.path,
  };
}

// ── DB operations ─────────────────────────────────────────────────────────────
export async function insertSubmission(
  sub: Omit<SubmissionRecord, "id">
): Promise<SubmissionRecord | null> {
  if (!sub.class_id) return null;
  const supabase = createClient();
  const record: SubmissionRecord = { ...sub, id: `sub_${crypto.randomUUID()}` };
  const { data, error } = await supabase
    .from("hw_submissions")
    .insert({
      id: record.id,
      class_id: record.class_id,
      homework_id: record.homework_id,
      student_id: record.student_id,
      data: record,
    })
    .select("data")
    .single();
  if (error) { console.error("Insert submission error:", error.message); return null; }
  invalidateClientQueries(
    "submission-records:",
    "homework-submissions:",
    "teacher-submission-snapshots:",
    "sidebar-badges:",
  );
  return data.data as SubmissionRecord;
}

export async function getSubmissionsByStudent(
  studentId: string
): Promise<SubmissionRecord[]> {
  return cachedClientQuery(`submission-records:student:${studentId}`, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("hw_submissions")
      .select("data")
      .eq("student_id", studentId)
      .order("submitted_at", { ascending: false });
    if (error || !data?.length) return [];
    return data.map(row => row.data as SubmissionRecord);
  }, 20_000);
}

export async function getSubmissionsByHomeworks(
  homeworkIds: string[]
): Promise<SubmissionRecord[]> {
  if (!homeworkIds.length) return [];
  const key = normalizedQueryKey("submission-records:homework", { homeworkIds });
  return cachedClientQuery(key, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("hw_submissions")
      .select("data")
      .in("homework_id", homeworkIds)
      .order("submitted_at", { ascending: false });
    if (error || !data?.length) return [];
    return data.map(row => row.data as SubmissionRecord);
  }, 20_000);
}

export async function updateGrade(
  submissionId: string,
  score: number,
  feedback: string,
  teacherFileUrl?: string,
  teacherFileName?: string,
): Promise<boolean> {
  const supabase = createClient();
  const { data: existing, error: loadError } = await supabase
    .from("hw_submissions")
    .select("data")
    .eq("id", submissionId)
    .maybeSingle();
  if (loadError || !existing?.data) return false;
  const updated = {
    ...(existing.data as SubmissionRecord),
    score,
    feedback: feedback.trim() || undefined,
    status: "graded" as const,
    graded_at: new Date().toISOString(),
    teacher_file_url: teacherFileUrl,
    teacher_file_name: teacherFileName,
  };
  const { error } = await supabase
    .from("hw_submissions")
    .update({ data: updated })
    .eq("id", submissionId);
  if (error) console.error("Update grade error:", error.message);
  if (!error) invalidateClientQueries(
    "submission-records:",
    "homework-submissions:",
    "teacher-submission-snapshots:",
  );
  return !error;
}
