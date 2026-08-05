import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { getQuestionForActor } from "@/lib/class-question-server";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (
    !actor
    || (actor.role !== "student" && actor.role !== "teacher")
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (body.status !== "open" && body.status !== "closed") {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  let access;
  try {
    access = await getQuestionForActor(admin, id, actor);
  } catch {
    return NextResponse.json({ error: "question_unavailable" }, { status: 500 });
  }
  if (!access.question) {
    return NextResponse.json({ error: "question_not_found" }, { status: 404 });
  }
  if (!access.allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("class_questions")
    .update({ status: body.status, updated_at: now })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: "question_update_failed" }, { status: 500 });
  }
  return NextResponse.json({ success: true, status: body.status, updated_at: now });
}
