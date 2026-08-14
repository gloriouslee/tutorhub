export type StudentNoteVisibility = "private" | "shared";
export type StudentNoteTag = "general" | "academic" | "attendance" | "homework" | "wellbeing";

export type StudentNote = {
  id: string;
  studentId: string;
  classId: string | null;
  text: string;
  rating: number;
  date: string;
  authorName: string;
  visibility: StudentNoteVisibility;
  tag: StudentNoteTag;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
};

async function noteResponse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body.error ?? "student_note_failed"));
  return body;
}

export async function listStudentNotes(studentId: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/teacher/student-comments?student_id=${encodeURIComponent(studentId)}`,
    { cache: "no-store", credentials: "same-origin", signal },
  );
  return noteResponse(response) as Promise<StudentNote[]>;
}

export async function createStudentNote(input: {
  studentId: string;
  classId?: string | null;
  text: string;
  rating: number;
  visibility: StudentNoteVisibility;
  tag: StudentNoteTag;
  date?: string;
}) {
  const response = await fetch("/api/teacher/student-comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });
  return noteResponse(response) as Promise<StudentNote>;
}

export async function updateStudentNote(
  id: string,
  input: Partial<Pick<StudentNote, "text" | "rating" | "visibility" | "tag">>,
) {
  const response = await fetch(`/api/teacher/student-comments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });
  return noteResponse(response) as Promise<StudentNote>;
}

export async function deleteStudentNote(id: string) {
  const response = await fetch(`/api/teacher/student-comments/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  await noteResponse(response);
}
