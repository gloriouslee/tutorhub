import type { CurriculumChapter } from "@/lib/storage";

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

function publicExamContent(value: unknown): JsonObject | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const { questions: _questions, ...safe } = value as JsonObject;
  void _questions;
  return safe;
}

function publicLesson(lesson: JsonObject): JsonObject | null {
  if (lesson.is_published !== true) return null;
  const {
    questions: _questions,
    answer_html: _answerHtml,
    explanation_html: _explanationHtml,
    correct_option: _correctOption,
    correct_value: _correctValue,
    exam_content: examContent,
    ...safe
  } = lesson;
  void _questions;
  void _answerHtml;
  void _explanationHtml;
  void _correctOption;
  void _correctValue;
  const safeExamContent = publicExamContent(examContent);
  return safeExamContent ? { ...safe, exam_content: safeExamContent } : safe;
}

export function sanitizeStudentCurriculum(
  value: unknown,
  studentId: string,
): CurriculumChapter[] {
  return objects(value).map((chapter) => ({
    ...chapter,
    sessions: objects(chapter.sessions).map((session) => ({
      ...session,
      lessons: objects(session.lessons)
        .filter((lesson) => assignedToStudent(lesson.assigned_to, studentId))
        .map(publicLesson)
        .filter((lesson): lesson is JsonObject => lesson !== null),
    })),
  })) as unknown as CurriculumChapter[];
}

