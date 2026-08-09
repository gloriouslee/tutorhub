import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveChildIdsForParent } from "@/lib/guardian-server";
import {
  DEFAULT_PORTAL_BRANDING,
  resolvePortalBranding,
  type PortalBranding,
} from "@/lib/portal-branding";

const PRIVATE_NO_STORE = {
  headers: { "Cache-Control": "private, no-store" },
};

async function loadPortalBranding(
  admin: ReturnType<typeof createAdminClient>,
  teacherId: string | undefined,
): Promise<PortalBranding> {
  if (!teacherId) return DEFAULT_PORTAL_BRANDING;

  const { data, error } = await admin
    .from("kv_teacher_settings")
    .select("value")
    .eq("id", teacherId)
    .maybeSingle();
  if (error) return DEFAULT_PORTAL_BRANDING;

  return resolvePortalBranding(data?.value, teacherId);
}

async function attachTutorNames(
  admin: ReturnType<typeof createAdminClient>,
  classes: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const tutorIds = [
    ...new Set(
      classes
        .map((item) => String(item.tutor_id ?? ""))
        .filter(Boolean),
    ),
  ];
  if (tutorIds.length === 0) return classes;

  const { data: teachers } = await admin
    .from("teachers")
    .select("id, full_name")
    .in("id", tutorIds);
  const names = new Map(
    (teachers ?? []).map((teacher) => [
      String(teacher.id),
      String(teacher.full_name),
    ]),
  );
  return classes.map((item) => ({
    ...item,
    tutor_name: names.get(String(item.tutor_id ?? "")),
  }));
}

export async function GET(req: NextRequest) {
  const identity = await getRequestIdentity(req);
  if (!identity) {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  if (identity.role === "student" && identity.studentId) {
    const { data: classes, error } = await admin
      .from("classes")
      .select("*")
      .contains("student_ids", [identity.studentId]);
    if (error) {
      return NextResponse.json({ error: "context_unavailable" }, { status: 500 });
    }
    const hydratedClasses = await attachTutorNames(
      admin,
      (classes ?? []) as Record<string, unknown>[],
    );
    const primaryTeacherId = hydratedClasses[0]?.tutor_id
      ? String(hydratedClasses[0].tutor_id)
      : undefined;
    const portalBranding = await loadPortalBranding(admin, primaryTeacherId);
    return NextResponse.json(
      {
        role: identity.role,
        studentId: identity.studentId,
        studentName: identity.displayName,
        classes: hydratedClasses,
        assignedClassId: hydratedClasses[0]?.id ?? "",
        portalBranding,
        avatarUrl: identity.avatarUrl,
      },
      PRIVATE_NO_STORE,
    );
  }

  if (identity.role === "teacher" && identity.teacherId) {
    const [classResult, portalBranding] = await Promise.all([
      admin
        .from("classes")
        .select("*")
        .eq("tutor_id", identity.teacherId),
      loadPortalBranding(admin, identity.teacherId),
    ]);
    const { data: classes, error } = classResult;
    if (error) {
      return NextResponse.json({ error: "context_unavailable" }, { status: 500 });
    }
    return NextResponse.json(
      {
        role: identity.role,
        userId: identity.userId,
        teacherId: identity.teacherId,
        teacherName: identity.displayName,
        classes: (classes ?? []).map((item) => ({
          ...item,
          tutor_name: identity.displayName,
        })),
        portalBranding,
        avatarUrl: identity.avatarUrl,
      },
      PRIVATE_NO_STORE,
    );
  }

  if (identity.role === "parent" && identity.parentId) {
    const childIds = await getActiveChildIdsForParent(admin, identity.parentId);
    const { data: children, error: childError } =
      childIds.length === 0
        ? { data: [], error: null }
        : await admin
            .from("students")
            .select("id, full_name, grade, school")
            .in("id", childIds);
    if (childError) {
      return NextResponse.json({ error: "context_unavailable" }, { status: 500 });
    }

    const { data: classes, error: classError } =
      childIds.length === 0
        ? { data: [], error: null }
        : await admin
            .from("classes")
            .select("*")
            .overlaps("student_ids", childIds);
    if (classError) {
      return NextResponse.json({ error: "context_unavailable" }, { status: 500 });
    }

    const hydratedClasses = await attachTutorNames(
      admin,
      (classes ?? []) as Record<string, unknown>[],
    );
    return NextResponse.json(
      {
        role: identity.role,
        parentId: identity.parentId,
        parentName: identity.displayName,
        avatarUrl: identity.avatarUrl,
        children: (children ?? []).map((child) => ({
          id: String(child.id),
          name: String(child.full_name),
          grade: child.grade,
          school: child.school,
          classes: hydratedClasses.filter((item) =>
            Array.isArray(item.student_ids)
              ? item.student_ids.includes(String(child.id))
              : false,
          ),
        })),
      },
      PRIVATE_NO_STORE,
    );
  }

  return NextResponse.json(
    {
      role: identity.role,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
    },
    PRIVATE_NO_STORE,
  );
}
