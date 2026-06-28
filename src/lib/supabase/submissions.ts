import { createClient } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SubmissionRecord {
  id: string;
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
}

const BUCKET = "homework-submissions";

// ── File upload ───────────────────────────────────────────────────────────────
export async function uploadSubmissionFile(
  homeworkId: string,
  studentId: string,
  file: File
): Promise<{ url: string; path: string } | null> {
  const supabase = createClient();
  // Sanitize filename: remove spaces and special chars
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${homeworkId}/${studentId}/${Date.now()}_${safeName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error || !data) {
    console.error("Storage upload error:", error?.message);
    return null;
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return { url: publicUrl, path: data.path };
}

// ── DB operations ─────────────────────────────────────────────────────────────
export async function insertSubmission(
  sub: Omit<SubmissionRecord, "id">
): Promise<SubmissionRecord | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("submissions")
    .insert(sub)
    .select()
    .single();
  if (error) { console.error("Insert submission error:", error.message); return null; }
  return data;
}

export async function getSubmissionsByStudent(
  studentId: string
): Promise<SubmissionRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false });
  if (error || !data?.length) return [];
  return data;
}

export async function getSubmissionsByHomeworks(
  homeworkIds: string[]
): Promise<SubmissionRecord[]> {
  if (!homeworkIds.length) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .in("homework_id", homeworkIds)
    .order("submitted_at", { ascending: false });
  if (error || !data?.length) return [];
  return data;
}

export async function updateGrade(
  submissionId: string,
  score: number,
  feedback: string
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("submissions")
    .update({
      score,
      feedback: feedback.trim() || null,
      status: "graded",
      graded_at: new Date().toISOString(),
    })
    .eq("id", submissionId);
  if (error) console.error("Update grade error:", error.message);
  return !error;
}
