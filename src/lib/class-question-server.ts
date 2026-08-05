import "server-only";

import type { RequestIdentity } from "@/lib/api-auth";
import type {
  ClassQuestionMessage,
  ClassQuestionThread,
  QuestionAttachmentInput,
} from "@/lib/class-question-types";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export function parseQuestionAttachment(
  value: unknown,
  classId: string,
  studentId: string,
): QuestionAttachmentInput | null {
  if (value == null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid_attachment");
  }
  const item = value as Record<string, unknown>;
  if (
    typeof item.url !== "string"
    || typeof item.name !== "string"
    || item.url.length > 2_000
    || item.name.trim().length === 0
    || item.name.length > 255
    || (item.size != null && (typeof item.size !== "string" || item.size.length > 40))
  ) {
    throw new Error("invalid_attachment");
  }

  const parsed = new URL(item.url, "https://tutorhub.invalid");
  const path = parsed.searchParams.get("path") ?? "";
  const expectedPrefix = `${classId}/submissions/${studentId}/questions/`;
  if (
    !item.url.startsWith("/api/files?")
    || parsed.origin !== "https://tutorhub.invalid"
    || parsed.pathname !== "/api/files"
    || parsed.searchParams.get("bucket") !== "homework-submissions"
    || !path.startsWith(expectedPrefix)
    || path.includes("..")
  ) {
    throw new Error("invalid_attachment");
  }

  return {
    url: item.url,
    name: item.name.trim(),
    size: typeof item.size === "string" ? item.size : undefined,
  };
}

export async function getTeacherClassIds(
  admin: AdminClient,
  teacherId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from("classes")
    .select("id")
    .eq("tutor_id", teacherId);
  if (error) throw error;
  return (data ?? []).map((item) => String(item.id));
}

export async function getQuestionForActor(
  admin: AdminClient,
  questionId: string,
  actor: RequestIdentity,
) {
  const { data: question, error } = await admin
    .from("class_questions")
    .select("*")
    .eq("id", questionId)
    .maybeSingle();
  if (error) throw error;
  if (!question) return { question: null, allowed: false };

  if (actor.role === "student" && actor.studentId) {
    return {
      question,
      allowed: String(question.student_id) === actor.studentId,
    };
  }
  if (actor.role === "teacher" && actor.teacherId) {
    const { data: classRow, error: classError } = await admin
      .from("classes")
      .select("id")
      .eq("id", question.class_id)
      .eq("tutor_id", actor.teacherId)
      .maybeSingle();
    if (classError) throw classError;
    return { question, allowed: Boolean(classRow) };
  }
  return { question, allowed: false };
}

export async function hydrateQuestionRows(
  admin: AdminClient,
  rows: Record<string, unknown>[],
): Promise<ClassQuestionThread[]> {
  if (rows.length === 0) return [];
  const questionIds = rows.map((row) => String(row.id));
  const studentIds = [...new Set(rows.map((row) => String(row.student_id)))];
  const classIds = [...new Set(rows.map((row) => String(row.class_id)))];
  const [messagesResult, studentsResult, classesResult] = await Promise.all([
    admin
      .from("class_question_messages")
      .select("id,question_id,author_role,author_name,content,attachment_url,attachment_name,attachment_size,created_at")
      .in("question_id", questionIds)
      .order("created_at", { ascending: true }),
    admin.from("students").select("id,full_name").in("id", studentIds),
    admin.from("classes").select("id,class_name").in("id", classIds),
  ]);
  const error = messagesResult.error ?? studentsResult.error ?? classesResult.error;
  if (error) throw error;

  const studentNames = new Map(
    (studentsResult.data ?? []).map((item) => [String(item.id), String(item.full_name)]),
  );
  const classNames = new Map(
    (classesResult.data ?? []).map((item) => [String(item.id), String(item.class_name)]),
  );
  const messagesByQuestion = new Map<string, ClassQuestionMessage[]>();
  for (const raw of messagesResult.data ?? []) {
    const questionId = String(raw.question_id);
    const messages = messagesByQuestion.get(questionId) ?? [];
    messages.push({
      id: String(raw.id),
      author_role: raw.author_role === "teacher" ? "teacher" : "student",
      author_name: String(raw.author_name),
      content: String(raw.content),
      attachment_url: raw.attachment_url ? String(raw.attachment_url) : null,
      attachment_name: raw.attachment_name ? String(raw.attachment_name) : null,
      attachment_size: raw.attachment_size ? String(raw.attachment_size) : null,
      created_at: String(raw.created_at),
    });
    messagesByQuestion.set(questionId, messages);
  }

  return rows.map((row) => {
    const id = String(row.id);
    const classId = String(row.class_id);
    const studentId = String(row.student_id);
    return {
      id,
      class_id: classId,
      class_name: classNames.get(classId) ?? "Lớp học",
      student_id: studentId,
      student_name: studentNames.get(studentId) ?? "Học viên",
      title: String(row.title),
      status:
        row.status === "answered" || row.status === "closed"
          ? row.status
          : "open",
      last_message_role: row.last_message_role === "teacher" ? "teacher" : "student",
      last_message_at: String(row.last_message_at),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      messages: messagesByQuestion.get(id) ?? [],
    };
  });
}
