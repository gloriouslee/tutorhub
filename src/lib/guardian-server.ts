import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function getActiveChildIdsForParent(
  admin: AdminClient,
  parentId: string,
): Promise<string[]> {
  const [linksResult, legacyResult] = await Promise.all([
    admin
      .from("student_guardians")
      .select("student_id")
      .eq("parent_id", parentId)
      .eq("status", "active"),
    // Deployment compatibility while old parent_id assignments are migrated.
    admin.from("students").select("id").eq("parent_id", parentId),
  ]);

  return [...new Set([
    ...(linksResult.data ?? []).map((link) => String(link.student_id)),
    ...(legacyResult.data ?? []).map((child) => String(child.id)),
  ])];
}

export async function parentCanAccessStudent(
  admin: AdminClient,
  parentId: string,
  studentId: string,
): Promise<boolean> {
  const childIds = await getActiveChildIdsForParent(admin, parentId);
  return childIds.includes(studentId);
}

export async function teacherCanManageStudent(
  admin: AdminClient,
  teacherId: string,
  studentId: string,
): Promise<boolean> {
  const [core, extra] = await Promise.all([
    admin
      .from("classes")
      .select("id")
      .eq("tutor_id", teacherId)
      .contains("student_ids", [studentId])
      .limit(1),
    admin
      .from("teacher_extra_classes")
      .select("id")
      .eq("tutor_id", teacherId)
      .contains("student_ids", [studentId])
      .limit(1),
  ]);
  return Boolean(core.data?.length || extra.data?.length);
}
