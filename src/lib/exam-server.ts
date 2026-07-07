// Server-only helpers for exam delivery + grading (dùng trong API routes).
// KHÔNG import file này từ client — cần SUPABASE_SERVICE_ROLE_KEY.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CurriculumChapter,
  CurriculumLesson,
  ExamQuestion,
  StoredExamResult,
} from "@/lib/storage";
import { calcAutoScore, calcMaxScore, type StudentAnswer } from "@/lib/exam-scoring";
export type { StudentAnswer };

export function getServiceKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  // Cùng quy tắc guard với các route khác (change-password...)
  if (!key.startsWith("ey") && !key.startsWith("sb_secret")) return null;
  return key;
}

export function serviceClient(serviceKey: string): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── KV row helpers (bảng kv_*: {id, value, updated_at}) ──────────────────────

export async function kvGetServer<T>(
  admin: SupabaseClient,
  table: string,
  id: string
): Promise<T | null> {
  const { data, error } = await admin.from(table).select("value").eq("id", id).maybeSingle();
  if (error) throw new Error(`${table}/${id}: ${error.message}`);
  return data ? (data.value as T) : null;
}

export async function kvSetServer<T>(
  admin: SupabaseClient,
  table: string,
  id: string,
  value: T
): Promise<void> {
  const { error } = await admin
    .from(table)
    .upsert({ id, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(`${table}/${id}: ${error.message}`);
}

// ── Lesson lookup + access control ───────────────────────────────────────────

export async function findExamLesson(
  admin: SupabaseClient,
  classId: string,
  lessonId: string
): Promise<CurriculumLesson | null> {
  const chapters = await kvGetServer<CurriculumChapter[]>(admin, "kv_curriculum", classId);
  if (!chapters) return null;
  for (const ch of chapters)
    for (const sess of ch.sessions) {
      const found = sess.lessons.find(l => l.id === lessonId);
      if (found) return found;
    }
  return null;
}

export type ExamAccess =
  | { ok: true }
  | { ok: false; reason: "unpublished" | "closed" | "not_open_yet"; opens_at?: string };

// Cùng quy tắc với client: mở nếu status === "open" HOẶC (draft && đã tới giờ mở)
export function checkExamAccess(lesson: CurriculumLesson): ExamAccess {
  if (lesson.is_published === false) return { ok: false, reason: "unpublished" };
  const status = lesson.exam_status ?? "draft";
  if (status === "closed") return { ok: false, reason: "closed" };
  const opensAt = lesson.exam_opens_at;
  const isOpen = status === "open" || (status === "draft" && !!opensAt && new Date(opensAt) <= new Date());
  if (!isOpen) return { ok: false, reason: "not_open_yet", opens_at: opensAt };
  return { ok: true };
}

// ── Sanitization: học sinh KHÔNG được nhận đáp án ────────────────────────────

export type SanitizedQuestion = Omit<
  ExamQuestion,
  "correct_option" | "correct_value" | "statements" | "answer_html" | "explanation_html"
> & { statements?: { text: string }[] };

export function sanitizeQuestions(questions: ExamQuestion[]): SanitizedQuestion[] {
  return questions.map(q => {
    const { correct_option, correct_value, statements, answer_html, explanation_html, ...safe } = q;
    void correct_option; void correct_value; void answer_html; void explanation_html;
    return {
      ...safe,
      ...(statements ? { statements: statements.map(st => ({ text: st.text })) } : {}),
    };
  });
}

// ── Grading — dùng chung thang điểm với client (exam-scoring.ts) ─────────────

export function calcScoreServer(
  questions: ExamQuestion[],
  answers: Record<string, StudentAnswer>
): number {
  return calcAutoScore(questions, answers);
}

// Tổng điểm tối đa của bài (Đúng/Sai = 1đ, Trả lời ngắn = 0.5đ, còn lại = q.score).
export function calcTotalServer(questions: ExamQuestion[]): number {
  return calcMaxScore(questions);
}

// ── KV ids (khớp kvRoute trong storage.ts: prefix bị cắt, phần còn lại là id) ─

export function examResultId(classId: string, lessonId: string, studentId: string) {
  return `${classId}_${lessonId}_${studentId}`;
}
export function examSubmissionsId(classId: string, lessonId: string) {
  return `${classId}_${lessonId}`;
}

export type { StoredExamResult };
