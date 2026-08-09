type JsonObject = Record<string, unknown>;
const PROTECTED_CLASS_FILE_RE = /\/api\/files\?bucket=class-materials&path=[^\s"'<>\]\\]+/g;

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

function examIsOpen(lesson: JsonObject): boolean {
  const status = lesson.exam_status ?? "draft";
  if (status === "closed") return false;
  if (status === "open") return true;
  if (status !== "draft" || typeof lesson.exam_opens_at !== "string") return false;
  const opensAt = Date.parse(lesson.exam_opens_at);
  return Number.isFinite(opensAt) && opensAt <= Date.now();
}

function referencesFile(value: unknown, expectedUrl: string): boolean {
  if (typeof value === "string") {
    const normalized = value.replaceAll("&amp;", "&");
    const referencedUrls: string[] = normalized.match(PROTECTED_CLASS_FILE_RE) ?? [];
    return normalized === expectedUrl
      || referencedUrls.includes(expectedUrl);
  }
  if (Array.isArray(value)) {
    return value.some((item) => referencesFile(item, expectedUrl));
  }
  return false;
}

function examQuestionReferencesFile(value: unknown, expectedUrl: string): boolean {
  return objects(value).some((question) =>
    referencesFile(question.content_html, expectedUrl)
    || referencesFile(question.options, expectedUrl)
    || objects(question.statements).some((statement) =>
      referencesFile(statement.text, expectedUrl),
    ),
  );
}

/**
 * Allows only files that are visible in a published lesson assigned to the
 * student. Exam solutions and answer keys are deliberately excluded here;
 * those remain available only through the protected exam result response.
 */
export function curriculumReferencesStudentFile(
  curriculum: unknown,
  expectedUrl: string,
  studentId: string,
): boolean {
  for (const chapter of objects(curriculum)) {
    for (const session of objects(chapter.sessions)) {
      for (const lesson of objects(session.lessons)) {
        if (lesson.is_published !== true) continue;
        if (!assignedToStudent(lesson.assigned_to, studentId)) continue;
        if (lesson.type === "exam" && !examIsOpen(lesson)) continue;

        if (
          referencesFile(lesson.file_url, expectedUrl)
          || referencesFile(lesson.video_url, expectedUrl)
        ) {
          return true;
        }

        if (lesson.type !== "exam") continue;
        const examContent = lesson.exam_content;
        if (!examContent || typeof examContent !== "object" || Array.isArray(examContent)) {
          continue;
        }
        if (examQuestionReferencesFile((examContent as JsonObject).questions, expectedUrl)) {
          return true;
        }
      }
    }
  }
  return false;
}
