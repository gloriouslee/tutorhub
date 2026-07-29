import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type JsonObject = Record<string, unknown>;

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => !!item && typeof item === "object")
    : [];
}

function assignedToStudent(value: unknown, studentId: string): boolean {
  return !Array.isArray(value)
    || value.length === 0
    || value.map(String).includes(studentId);
}

function publicLesson(lesson: JsonObject): JsonObject | null {
  if (lesson.is_published !== true) return null;
  const {
    questions: _questions,
    answer_html: _answerHtml,
    explanation_html: _explanationHtml,
    correct_option: _correctOption,
    correct_value: _correctValue,
    ...safe
  } = lesson;
  void _questions;
  void _answerHtml;
  void _explanationHtml;
  void _correctOption;
  void _correctValue;
  return safe;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "student" || !actor.studentId) {
    return NextResponse.json({ error: "student_authorization_required" }, { status: 403 });
  }
  const { classId } = await params;
  const admin = createAdminClient();
  const { data: enrolled } = await admin
    .from("classes")
    .select("id")
    .eq("id", classId)
    .contains("student_ids", [actor.studentId])
    .maybeSingle();
  if (!enrolled) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { data, error } = await admin
    .from("kv_curriculum")
    .select("value")
    .eq("id", classId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "curriculum_unavailable" }, { status: 500 });
  }

  const chapters = objects(data?.value).map((chapter) => ({
    ...chapter,
    sessions: objects(chapter.sessions).map((session) => ({
      ...session,
      lessons: objects(session.lessons)
        .filter((lesson) => assignedToStudent(lesson.assigned_to, actor.studentId!))
        .map(publicLesson)
        .filter((lesson): lesson is JsonObject => lesson !== null),
    })),
  }));
  return NextResponse.json(chapters, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
