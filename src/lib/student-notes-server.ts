import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { RequestIdentity } from "@/lib/api-auth";
import type { StudentNote, StudentNoteTag, StudentNoteVisibility } from "@/lib/student-notes";

export const NOTE_TAGS = new Set<StudentNoteTag>([
  "general",
  "academic",
  "attendance",
  "homework",
  "wellbeing",
]);
export const NOTE_VISIBILITIES = new Set<StudentNoteVisibility>(["private", "shared"]);

export function validNoteDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function bangkokDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function teacherClassForStudent(
  identity: RequestIdentity,
  studentId: string,
  requestedClassId?: string | null,
) {
  if (identity.role !== "teacher" || !identity.teacherId) return null;
  let query = createAdminClient()
    .from("classes")
    .select("id")
    .eq("tutor_id", identity.teacherId)
    .contains("student_ids", [studentId]);
  if (requestedClassId) query = query.eq("id", requestedClassId);
  const { data, error } = await query.order("created_at", { ascending: true }).limit(1);
  if (error) throw error;
  return data?.[0] ? String(data[0].id) : null;
}

export function shapeStudentNote(
  row: Record<string, unknown>,
  identity: RequestIdentity,
): StudentNote {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    classId: typeof row.class_id === "string" ? row.class_id : null,
    text: String(row.comment_text ?? ""),
    rating: Number(row.rating ?? 0),
    date: String(row.comment_date ?? ""),
    authorName: String(row.author_name ?? "Giáo viên"),
    visibility: row.visibility === "private" ? "private" : "shared",
    tag: NOTE_TAGS.has(row.tag as StudentNoteTag) ? row.tag as StudentNoteTag : "general",
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? row.created_at ?? ""),
    isOwner: String(row.author_user_id ?? "") === identity.userId,
  };
}
