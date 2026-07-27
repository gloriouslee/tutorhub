import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

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
    return NextResponse.json({
      role: identity.role,
      studentId: identity.studentId,
      studentName: identity.displayName,
      classes: classes ?? [],
      assignedClassId: classes?.[0]?.id ?? "",
    });
  }

  if (identity.role === "parent" && identity.parentId) {
    const { data: children, error: childError } = await admin
      .from("students")
      .select("id, full_name, grade, school")
      .eq("parent_id", identity.parentId);
    if (childError) {
      return NextResponse.json({ error: "context_unavailable" }, { status: 500 });
    }

    const childIds = (children ?? []).map((child) => String(child.id));
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

    return NextResponse.json({
      role: identity.role,
      parentId: identity.parentId,
      parentName: identity.displayName,
      children: (children ?? []).map((child) => ({
        id: String(child.id),
        name: String(child.full_name),
        grade: child.grade,
        school: child.school,
        classes: (classes ?? []).filter((item) =>
          Array.isArray(item.student_ids)
            ? item.student_ids.includes(String(child.id))
            : false,
        ),
      })),
    });
  }

  return NextResponse.json({
    role: identity.role,
    displayName: identity.displayName,
  });
}
