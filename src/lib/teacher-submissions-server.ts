import { createAdminClient } from "@/lib/supabase/admin";
import type { CurriculumChapter, StoredExamResult } from "@/lib/storage";
import type { SubmissionRecord } from "@/lib/supabase/submissions";
import type { TeacherSubmissionSnapshot } from "@/lib/teacher-submissions";

type AdminClient = ReturnType<typeof createAdminClient>;

export type TeacherClassScope = {
  id: string;
  tutor_id: string;
  student_ids: string[] | null;
};

function chunksOf<T>(items: T[], size = 50): T[][] {
  return Array.from(
    { length: Math.ceil(items.length / size) },
    (_, index) => items.slice(index * size, index * size + size),
  );
}

export async function loadTeacherClassScopes(
  admin: AdminClient,
  classIds: readonly string[],
): Promise<TeacherClassScope[]> {
  const ids = [...new Set(classIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const [core, extra] = await Promise.all([
    admin.from("classes").select("id,tutor_id,student_ids").in("id", ids),
    admin.from("teacher_extra_classes").select("id,tutor_id,student_ids").in("id", ids),
  ]);
  if (core.error) throw core.error;
  if (extra.error) throw extra.error;

  const byId = new Map<string, TeacherClassScope>();
  for (const row of [...(core.data ?? []), ...(extra.data ?? [])]) {
    byId.set(String(row.id), {
      id: String(row.id),
      tutor_id: String(row.tutor_id),
      student_ids: Array.isArray(row.student_ids) ? row.student_ids.map(String) : [],
    });
  }
  return ids.flatMap((id) => {
    const scope = byId.get(id);
    return scope ? [scope] : [];
  });
}

/** Load all grading snapshots without an exams × roster Cartesian product. */
export async function loadTeacherSubmissionSnapshots(
  admin: AdminClient,
  classScopes: readonly TeacherClassScope[],
): Promise<Record<string, TeacherSubmissionSnapshot>> {
  const classIds = classScopes.map((scope) => scope.id);
  if (classIds.length === 0) return {};

  const [curriculumResponse, fileResponse] = await Promise.all([
    admin.from("kv_curriculum").select("id,value").in("id", classIds),
    admin.from("hw_submissions").select("class_id,data").in("class_id", classIds),
  ]);
  if (curriculumResponse.error) throw curriculumResponse.error;
  if (fileResponse.error) throw fileResponse.error;

  const examRefs = (curriculumResponse.data ?? []).flatMap((row) => {
    const classId = String(row.id);
    const chapters = (row.value ?? []) as CurriculumChapter[];
    return chapters
      .flatMap((chapter) => chapter.sessions)
      .flatMap((session) => session.lessons)
      .filter((lesson) => lesson.type === "exam")
      .map((lesson) => ({ classId, lessonId: lesson.id }));
  });
  const registryRefById = new Map(
    examRefs.map((ref) => [`${ref.classId}_${ref.lessonId}`, ref]),
  );
  const registryResponses = await Promise.all(
    chunksOf([...registryRefById.keys()]).map((ids) =>
      admin.from("kv_exam_submissions").select("id,value").in("id", ids),
    ),
  );
  const failedRegistryQuery = registryResponses.find((response) => response.error);
  if (failedRegistryQuery?.error) throw failedRegistryQuery.error;

  const resultOwnerById = new Map<string, { classId: string; lessonId: string }>();
  for (const row of registryResponses.flatMap((response) => response.data ?? [])) {
    const ref = registryRefById.get(String(row.id));
    if (!ref || !Array.isArray(row.value)) continue;
    for (const studentId of row.value) {
      resultOwnerById.set(`${ref.classId}_${ref.lessonId}_${String(studentId)}`, ref);
    }
  }

  const resultResponses = await Promise.all(
    chunksOf([...resultOwnerById.keys()]).map((ids) =>
      admin.from("kv_exam_results").select("id,value").in("id", ids),
    ),
  );
  const failedResultQuery = resultResponses.find((response) => response.error);
  if (failedResultQuery?.error) throw failedResultQuery.error;

  const snapshots: Record<string, TeacherSubmissionSnapshot> = Object.fromEntries(
    classIds.map((classId) => [
      classId,
      { examResults: {}, fileSubmissions: [] } satisfies TeacherSubmissionSnapshot,
    ]),
  );
  for (const { classId, lessonId } of examRefs) {
    snapshots[classId].examResults[lessonId] ??= [];
  }
  for (const row of resultResponses.flatMap((response) => response.data ?? [])) {
    const owner = resultOwnerById.get(String(row.id));
    if (!owner) continue;
    snapshots[owner.classId].examResults[owner.lessonId].push(row.value as StoredExamResult);
  }
  for (const row of fileResponse.data ?? []) {
    const classId = String(row.class_id ?? "");
    if (!snapshots[classId]) continue;
    snapshots[classId].fileSubmissions.push({
      ...(row.data as SubmissionRecord),
      class_id: classId || (row.data as SubmissionRecord).class_id,
    });
  }
  return snapshots;
}
