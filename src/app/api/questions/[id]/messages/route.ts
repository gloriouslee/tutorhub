import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import {
  getQuestionForActor,
  parseQuestionAttachment,
} from "@/lib/class-question-server";
import type { ClassQuestionMessage } from "@/lib/class-question-types";
import { consumeRateLimit } from "@/lib/rate-limit";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNonEmptyString } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
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
  if (!await consumeRateLimit({
    scope: "class-question-reply",
    key: actor.userId,
    limit: 20,
    windowSeconds: 60,
  })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isNonEmptyString(body.content, 10_000)) {
    return NextResponse.json({ error: "invalid_message" }, { status: 400 });
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
  if (access.question.status === "closed") {
    return NextResponse.json({ error: "question_closed" }, { status: 409 });
  }

  let attachment = null;
  if (actor.role === "student" && actor.studentId) {
    try {
      attachment = parseQuestionAttachment(
        body.attachment,
        String(access.question.class_id),
        actor.studentId,
      );
    } catch {
      return NextResponse.json({ error: "invalid_attachment" }, { status: 400 });
    }
  } else if (body.attachment != null) {
    return NextResponse.json({ error: "invalid_attachment" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: message, error: messageError } = await admin
    .from("class_question_messages")
    .insert({
      question_id: id,
      author_user_id: actor.userId,
      author_role: actor.role,
      author_name: actor.displayName.slice(0, 160),
      content: body.content.trim(),
      attachment_url: attachment?.url ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_size: attachment?.size ?? null,
      created_at: now,
    })
    .select("id,author_role,author_name,content,attachment_url,attachment_name,attachment_size,created_at")
    .single();
  if (messageError || !message) {
    return NextResponse.json({ error: "message_create_failed" }, { status: 500 });
  }

  const nextStatus = actor.role === "teacher" ? "answered" : "open";
  const { error: updateError } = await admin
    .from("class_questions")
    .update({
      status: nextStatus,
      last_message_role: actor.role,
      last_message_at: now,
      updated_at: now,
    })
    .eq("id", id);
  if (updateError) {
    await admin.from("class_question_messages").delete().eq("id", message.id);
    return NextResponse.json({ error: "message_create_failed" }, { status: 500 });
  }

  const response: ClassQuestionMessage & { status: "open" | "answered" } = {
    id: String(message.id),
    author_role: actor.role,
    author_name: String(message.author_name),
    content: String(message.content),
    attachment_url: message.attachment_url ? String(message.attachment_url) : null,
    attachment_name: message.attachment_name ? String(message.attachment_name) : null,
    attachment_size: message.attachment_size ? String(message.attachment_size) : null,
    created_at: String(message.created_at),
    status: nextStatus,
  };
  return NextResponse.json(response, { status: 201 });
}
