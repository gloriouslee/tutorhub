import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveRegistrationTuition } from "@/lib/registration-pricing";

export const dynamic = "force-dynamic";

type JsonObject = Record<string, unknown>;

function arrayOfObjects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => !!item && typeof item === "object")
    : [];
}

function publicRoadmap(value: unknown) {
  return arrayOfObjects(value)
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
    .map((chapter) => ({
      id: String(chapter.id ?? ""),
      title: String(chapter.title ?? "Chương học"),
      sessions: arrayOfObjects(chapter.sessions)
        .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
        .map((session) => ({
          id: String(session.id ?? ""),
          title: String(session.title ?? "Buổi học"),
          date: typeof session.date === "string" ? session.date : undefined,
        })),
    }));
}

function publicMaterial(row: JsonObject) {
  const data = (row.data && typeof row.data === "object"
    ? row.data
    : {}) as JsonObject;
  return {
    id: String(row.id ?? data.id ?? ""),
    class_id: String(row.class_id ?? data.classId ?? ""),
    title: String(data.title ?? "Tài liệu lớp học"),
    subject: String(data.subject ?? ""),
    description: String(data.description ?? ""),
    chapters: arrayOfObjects(data.chapters).map((chapter) => ({
      id: String(chapter.id ?? ""),
      title: String(chapter.title ?? "Chương học"),
      lessons: arrayOfObjects(chapter.lessons).map((lesson) => ({
        id: String(lesson.id ?? ""),
        title: String(lesson.title ?? "Tài liệu"),
        type: String(lesson.type ?? "pdf"),
        duration:
          typeof lesson.duration === "string" ? lesson.duration : undefined,
      })),
    })),
  };
}

export async function GET(req: NextRequest) {
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "student" || !actor.studentId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const [
    classResult,
    teacherResult,
    requestResult,
    curriculumResult,
    materialResult,
    tuitionResult,
  ] = await Promise.all([
      admin
        .from("classes")
        .select(
          "id,class_name,subject,grade,learning_mode,tutor_id,classroom,schedule,description,max_students,student_ids,color",
        )
        .order("created_at", { ascending: false }),
      admin.from("teachers").select("id,full_name"),
      admin
        .from("class_registration_requests")
        .select("id,requested_class_id,status,requested_package,created_at")
        .eq("student_id", actor.studentId)
        .order("created_at", { ascending: false }),
      admin.from("kv_curriculum").select("id,value"),
      admin
        .from("teacher_materials")
        .select("id,class_id,data")
        .eq("published", true)
        .not("class_id", "is", null),
      admin.from("kv_tuition").select("id,value"),
    ]);

  const error =
    classResult.error
    ?? teacherResult.error
    ?? requestResult.error
    ?? curriculumResult.error
    ?? materialResult.error
    ?? tuitionResult.error;
  if (error) {
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 500 });
  }

  const teacherNames = new Map(
    (teacherResult.data ?? []).map((teacher) => [
      String(teacher.id),
      String(teacher.full_name ?? ""),
    ]),
  );
  const latestRequests = new Map<string, JsonObject>();
  for (const request of requestResult.data ?? []) {
    const classId = String(request.requested_class_id);
    if (!latestRequests.has(classId)) latestRequests.set(classId, request);
  }
  const roadmaps = new Map(
    (curriculumResult.data ?? []).map((row) => [
      String(row.id),
      publicRoadmap(row.value),
    ]),
  );
  const tuitionByClass = new Map(
    (tuitionResult.data ?? []).map((row) => [
      String(row.id),
      resolveRegistrationTuition(row.value),
    ]),
  );
  const materials = new Map<string, ReturnType<typeof publicMaterial>[]>();
  for (const row of materialResult.data ?? []) {
    const item = publicMaterial(row);
    if (!item.class_id) continue;
    materials.set(item.class_id, [...(materials.get(item.class_id) ?? []), item]);
  }

  const catalog = (classResult.data ?? []).map((item) => {
    const studentIds = Array.isArray(item.student_ids)
      ? item.student_ids.map(String)
      : [];
    const request = latestRequests.get(String(item.id));
    return {
      id: String(item.id),
      class_name: String(item.class_name),
      subject: String(item.subject),
      grade: item.grade,
      learning_mode: item.learning_mode,
      tutor_id: String(item.tutor_id ?? ""),
      tutor_name: teacherNames.get(String(item.tutor_id ?? "")) ?? "Giáo viên",
      classroom: item.classroom,
      schedule: Array.isArray(item.schedule) ? item.schedule : [],
      description: item.description,
      max_students: item.max_students,
      student_count: studentIds.length,
      color: item.color,
      enrolled: studentIds.includes(actor.studentId!),
      registration_status: request?.status ?? null,
      registration_id: request?.id ?? null,
      registration_package: request?.requested_package ?? null,
      tuition:
        tuitionByClass.get(String(item.id))
        ?? resolveRegistrationTuition(null),
      roadmap: roadmaps.get(String(item.id)) ?? [],
      materials: materials.get(String(item.id)) ?? [],
    };
  });

  return NextResponse.json(catalog, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
