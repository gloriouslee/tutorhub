import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { logEvent } from "@/lib/logger";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNonEmptyString } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ classId: string }> };

function mutationError(error: { message?: string }, event: string) {
  const message = String(error.message ?? "");
  logEvent("error", event, { databaseMessage: message });
  if (message.includes("class_not_found")) {
    return NextResponse.json({ error: "class_not_found" }, { status: 404 });
  }
  if (message.includes("forbidden")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ error: "class_mutation_failed" }, { status: 500 });
}

export async function POST(req: NextRequest, context: RouteContext) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "teacher" || !actor.teacherId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { classId } = await context.params;
  if (!isNonEmptyString(classId, 100)) {
    return NextResponse.json({ error: "invalid_class_id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (body.action !== "clone") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: clonedId, error } = await admin.rpc(
    "teacher_clone_class_secure",
    {
      p_class_id: classId,
      p_teacher_id: actor.teacherId,
      p_actor_id: actor.userId,
    },
  );
  if (error) return mutationError(error, "teacher_class_clone_failed");

  const { data: clonedClass, error: classError } = await admin
    .from("classes")
    .select("*")
    .eq("id", String(clonedId))
    .eq("tutor_id", actor.teacherId)
    .single();
  if (classError || !clonedClass) {
    return mutationError(
      classError ?? { message: "cloned_class_not_found" },
      "teacher_class_clone_read_failed",
    );
  }

  revalidateTag("class-catalog-public", { expire: 0 });
  return NextResponse.json(clonedClass, { status: 201 });
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "teacher" || !actor.teacherId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { classId } = await context.params;
  if (!isNonEmptyString(classId, 100)) {
    return NextResponse.json({ error: "invalid_class_id" }, { status: 400 });
  }

  const { error } = await createAdminClient().rpc(
    "teacher_delete_class_secure",
    {
      p_class_id: classId,
      p_teacher_id: actor.teacherId,
      p_actor_id: actor.userId,
    },
  );
  if (error) return mutationError(error, "teacher_class_delete_failed");

  revalidateTag("class-catalog-public", { expire: 0 });
  return NextResponse.json({ deleted: true });
}
