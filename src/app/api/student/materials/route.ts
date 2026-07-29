import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type JsonObject = Record<string, unknown>;

function asObjects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => !!item && typeof item === "object")
    : [];
}

function packageForStudent(value: unknown, studentId: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const selected = (value as JsonObject)[studentId];
  return typeof selected === "string" ? selected : null;
}

function filterLesson(lesson: JsonObject, canAccessFull: boolean): JsonObject {
  if (canAccessFull || lesson.isPreview === true) return lesson;
  const {
    videoUrl: _videoUrl,
    fileUrl: _fileUrl,
    answer_html: _answerHtml,
    explanation_html: _explanationHtml,
    ...preview
  } = lesson;
  void _videoUrl;
  void _fileUrl;
  void _answerHtml;
  void _explanationHtml;
  return preview;
}

function filterCourse(course: JsonObject, canAccessFull: boolean): JsonObject {
  return {
    ...course,
    access_granted: canAccessFull,
    chapters: asObjects(course.chapters).map((chapter) => ({
      ...chapter,
      lessons: asObjects(chapter.lessons).map((lesson) =>
        filterLesson(lesson, canAccessFull),
      ),
    })),
  };
}

export async function GET(req: NextRequest) {
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "student" || !actor.studentId) {
    return NextResponse.json({ error: "student_authorization_required" }, { status: 403 });
  }

  const admin = createAdminClient();
  const [classesResult, materialsResult, transactionsResult] = await Promise.all([
    admin
      .from("classes")
      .select("id")
      .contains("student_ids", [actor.studentId]),
    admin
      .from("teacher_materials")
      .select("id,class_id,data")
      .eq("published", true)
      .order("created_at", { ascending: false }),
    admin
      .from("purchase_transactions")
      .select("pkg_id")
      .eq("student_id", actor.studentId)
      .eq("status", "approved"),
  ]);
  const error =
    classesResult.error ?? materialsResult.error ?? transactionsResult.error;
  if (error) {
    return NextResponse.json({ error: "materials_unavailable" }, { status: 500 });
  }

  const classIds = (classesResult.data ?? []).map((item) => String(item.id));
  const packageResult = classIds.length
    ? await admin
        .from("kv_student_packages")
        .select("id,value")
        .in("id", classIds)
    : { data: [], error: null };
  if (packageResult.error) {
    return NextResponse.json({ error: "materials_unavailable" }, { status: 500 });
  }
  const packages = new Map(
    (packageResult.data ?? []).map((row) => [
      String(row.id),
      packageForStudent(row.value, actor.studentId!),
    ]),
  );
  const granted = new Set(
    (transactionsResult.data ?? []).map((row) => String(row.pkg_id)),
  );

  const items: JsonObject[] = [];
  for (const row of materialsResult.data ?? []) {
    const course = row.data && typeof row.data === "object"
      ? row.data as JsonObject
      : {};
    const type = course.type;
    if (type === "class") {
      const classId = String(row.class_id ?? course.classId ?? "");
      if (!classIds.includes(classId)) continue;
      const allowedPackages = Array.isArray(course.packages)
        ? course.packages.map(String)
        : [];
      const studentPackage = packages.get(classId);
      const allowed =
        allowedPackages.length === 0
        || (!!studentPackage && allowedPackages.includes(studentPackage));
      items.push(filterCourse(course, allowed));
      continue;
    }
    if (type === "paid_package") {
      items.push(filterCourse(course, granted.has(String(row.id))));
    }
  }

  return NextResponse.json(items, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
