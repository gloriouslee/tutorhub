import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  NOTE_TAGS,
  NOTE_VISIBILITIES,
  shapeStudentNote,
  teacherClassForStudent,
} from "@/lib/student-notes-server";
import type { StudentNoteTag, StudentNoteVisibility } from "@/lib/student-notes";

const PRIVATE_NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

async function ownedNote(identity: NonNullable<Awaited<ReturnType<typeof getRequestIdentity>>>, id: string) {
  const { data, error } = await createAdminClient().from("student_comments").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data || String(data.author_user_id ?? "") !== identity.userId) return null;
  return await teacherClassForStudent(identity, String(data.student_id), typeof data.class_id === "string" ? data.class_id : null)
    ? data as Record<string, unknown>
    : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  const identity = await getRequestIdentity(req);
  if (!identity?.teacherId || identity.role !== "teacher") {
    return NextResponse.json({ error: "teacher_authorization_required" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  const { id } = await params;
  if (!id || id.length > 160 || !(await ownedNote(identity, id))) {
    return NextResponse.json({ error: "student_note_not_found" }, { status: 404, ...PRIVATE_NO_STORE });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, ...PRIVATE_NO_STORE });
  }
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.text !== undefined) {
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (text.length < 2 || text.length > 4000) {
      return NextResponse.json({ error: "invalid_student_note" }, { status: 400, ...PRIVATE_NO_STORE });
    }
    updates.comment_text = text;
  }
  if (body.rating !== undefined) {
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "invalid_student_note" }, { status: 400, ...PRIVATE_NO_STORE });
    }
    updates.rating = rating;
  }
  if (body.visibility !== undefined) {
    if (!NOTE_VISIBILITIES.has(body.visibility as StudentNoteVisibility)) {
      return NextResponse.json({ error: "invalid_student_note" }, { status: 400, ...PRIVATE_NO_STORE });
    }
    updates.visibility = body.visibility;
  }
  if (body.tag !== undefined) {
    if (!NOTE_TAGS.has(body.tag as StudentNoteTag)) {
      return NextResponse.json({ error: "invalid_student_note" }, { status: 400, ...PRIVATE_NO_STORE });
    }
    updates.tag = body.tag;
  }
  const { data, error } = await createAdminClient().from("student_comments")
    .update(updates)
    .eq("id", id)
    .eq("author_user_id", identity.userId)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "student_note_update_failed" }, { status: 500, ...PRIVATE_NO_STORE });
  }
  return NextResponse.json(shapeStudentNote(data as Record<string, unknown>, identity), PRIVATE_NO_STORE);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  const identity = await getRequestIdentity(req);
  if (!identity?.teacherId || identity.role !== "teacher") {
    return NextResponse.json({ error: "teacher_authorization_required" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  const { id } = await params;
  if (!id || id.length > 160 || !(await ownedNote(identity, id))) {
    return NextResponse.json({ error: "student_note_not_found" }, { status: 404, ...PRIVATE_NO_STORE });
  }
  const { error } = await createAdminClient().from("student_comments")
    .delete()
    .eq("id", id)
    .eq("author_user_id", identity.userId);
  if (error) {
    return NextResponse.json({ error: "student_note_delete_failed" }, { status: 500, ...PRIVATE_NO_STORE });
  }
  return NextResponse.json({ ok: true }, PRIVATE_NO_STORE);
}
