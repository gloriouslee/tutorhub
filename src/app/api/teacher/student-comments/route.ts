import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  bangkokDate,
  NOTE_TAGS,
  NOTE_VISIBILITIES,
  shapeStudentNote,
  teacherClassForStudent,
  validNoteDate,
} from "@/lib/student-notes-server";
import type { StudentNoteTag, StudentNoteVisibility } from "@/lib/student-notes";

const PRIVATE_NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(req: NextRequest) {
  const identity = await getRequestIdentity(req);
  if (!identity?.teacherId || identity.role !== "teacher") {
    return NextResponse.json({ error: "teacher_authorization_required" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  const studentId = req.nextUrl.searchParams.get("student_id")?.trim() ?? "";
  if (!studentId || studentId.length > 120 || !(await teacherClassForStudent(identity, studentId))) {
    return NextResponse.json({ error: "student_access_denied" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  const { data, error } = await createAdminClient()
    .from("student_comments")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "student_notes_unavailable" }, { status: 500, ...PRIVATE_NO_STORE });
  }
  return NextResponse.json(
    (data ?? []).map((row) => shapeStudentNote(row as Record<string, unknown>, identity)),
    PRIVATE_NO_STORE,
  );
}

export async function POST(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  const identity = await getRequestIdentity(req);
  if (!identity?.teacherId || identity.role !== "teacher") {
    return NextResponse.json({ error: "teacher_authorization_required" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  if (!await consumeRateLimit({ scope: "student-note-create", key: identity.userId, limit: 20, windowSeconds: 60 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, ...PRIVATE_NO_STORE });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, ...PRIVATE_NO_STORE });
  }
  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
  const requestedClassId = typeof body.classId === "string" ? body.classId.trim() : null;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const rating = Number(body.rating);
  const visibility = body.visibility as StudentNoteVisibility;
  const tag = body.tag as StudentNoteTag;
  const date = body.date ?? bangkokDate();
  if (
    !studentId || studentId.length > 120 || text.length < 2 || text.length > 4000
    || !Number.isInteger(rating) || rating < 1 || rating > 5
    || !NOTE_VISIBILITIES.has(visibility) || !NOTE_TAGS.has(tag) || !validNoteDate(date)
  ) {
    return NextResponse.json({ error: "invalid_student_note" }, { status: 400, ...PRIVATE_NO_STORE });
  }
  const classId = await teacherClassForStudent(identity, studentId, requestedClassId);
  if (!classId) {
    return NextResponse.json({ error: "student_access_denied" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  const { data, error } = await createAdminClient().from("student_comments").insert({
    id: `cmt_${crypto.randomUUID()}`,
    student_id: studentId,
    class_id: classId,
    comment_text: text,
    comment_date: date,
    rating,
    author_user_id: identity.userId,
    author_name: identity.displayName,
    visibility,
    tag,
  }).select("*").single();
  if (error || !data) {
    return NextResponse.json({ error: "student_note_create_failed" }, { status: 500, ...PRIVATE_NO_STORE });
  }
  return NextResponse.json(shapeStudentNote(data as Record<string, unknown>, identity), { status: 201, ...PRIVATE_NO_STORE });
}
