import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { isNonEmptyString } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "student" || !actor.studentId) {
    return NextResponse.json({ error: "student_authorization_required" }, { status: 403 });
  }
  const resourceId = req.nextUrl.searchParams.get("resource_id");
  if (!isNonEmptyString(resourceId, 120)) {
    return NextResponse.json({ error: "invalid_resource_id" }, { status: 400 });
  }
  const { data, error } = await createAdminClient()
    .from("student_lesson_progress")
    .select("lesson_id,completed,notes,updated_at")
    .eq("student_id", actor.studentId)
    .eq("resource_id", resourceId);
  if (error) {
    return NextResponse.json({ error: "progress_unavailable" }, { status: 500 });
  }
  return NextResponse.json(data ?? [], {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PUT(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "student" || !actor.studentId) {
    return NextResponse.json({ error: "student_authorization_required" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    !isNonEmptyString(body.resource_id, 120)
    || !isNonEmptyString(body.lesson_id, 120)
    || (body.completed !== undefined && typeof body.completed !== "boolean")
    || (body.notes !== undefined && typeof body.notes !== "string")
    || (typeof body.notes === "string" && body.notes.length > 5_000)
  ) {
    return NextResponse.json({ error: "invalid_progress" }, { status: 400 });
  }
  const { data, error } = await createAdminClient()
    .from("student_lesson_progress")
    .upsert({
      student_id: actor.studentId,
      resource_id: body.resource_id,
      lesson_id: body.lesson_id,
      completed: body.completed === true,
      notes: typeof body.notes === "string" ? body.notes.trim() : "",
      updated_at: new Date().toISOString(),
    }, { onConflict: "student_id,resource_id,lesson_id" })
    .select("lesson_id,completed,notes,updated_at")
    .single();
  if (error) {
    return NextResponse.json({ error: "progress_update_failed" }, { status: 500 });
  }
  return NextResponse.json(data);
}
