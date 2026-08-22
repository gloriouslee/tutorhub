import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { logEvent } from "@/lib/logger";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNonEmptyString } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ classId: string; studentId: string }>;
};

export async function DELETE(req: NextRequest, context: RouteContext) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "teacher" || !actor.teacherId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { classId, studentId } = await context.params;
  if (
    !isNonEmptyString(classId, 100)
    || !isNonEmptyString(studentId, 100)
  ) {
    return NextResponse.json({ error: "invalid_membership" }, { status: 400 });
  }

  const { data: studentIds, error } = await createAdminClient().rpc(
    "teacher_remove_student_from_class_secure",
    {
      p_class_id: classId,
      p_student_id: studentId,
      p_teacher_id: actor.teacherId,
      p_actor_id: actor.userId,
    },
  );
  if (error) {
    const message = String(error.message ?? "");
    logEvent("error", "teacher_class_student_remove_failed", {
      classId,
      databaseMessage: message,
    });
    if (message.includes("class_not_found")) {
      return NextResponse.json({ error: "class_not_found" }, { status: 404 });
    }
    if (message.includes("forbidden")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "student_remove_failed" },
      { status: 500 },
    );
  }

  revalidateTag("class-catalog-public", { expire: 0 });
  return NextResponse.json({ student_ids: studentIds ?? [] });
}
