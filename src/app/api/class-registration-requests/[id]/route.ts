import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasValidMutationOrigin } from "@/lib/request-security";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "teacher" || !actor.teacherId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }
  const assignedClassId =
    typeof body.assigned_class_id === "string" ? body.assigned_class_id : null;
  if (action === "approve" && !assignedClassId) {
    return NextResponse.json({ error: "invalid_class_id" }, { status: 400 });
  }
  const teacherNote =
    typeof body.teacher_note === "string"
      ? body.teacher_note.trim().slice(0, 1000)
      : null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc(
    "review_class_registration_request_secure",
    {
      p_request_id: id,
      p_action: action,
      p_assigned_class_id: assignedClassId,
      p_teacher_id: actor.teacherId,
      p_actor_id: actor.userId,
      p_teacher_note: teacherNote,
    },
  );
  if (error) {
    const message = error.message.toLowerCase();
    const status =
      message.includes("not_found") ? 404
      : message.includes("not_pending") || message.includes("class_full") ? 409
      : message.includes("forbidden") || message.includes("not_owned") ? 403
      : 500;
    const code =
      message.includes("class_full") ? "class_full"
      : message.includes("not_pending") ? "registration_not_pending"
      : status === 403 ? "forbidden"
      : status === 404 ? "registration_not_found"
      : "registration_review_failed";
    return NextResponse.json({ error: code }, { status });
  }

  return NextResponse.json({
    success: true,
    result: Array.isArray(data) ? data[0] ?? null : data,
  });
}

