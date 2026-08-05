import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import {
  getTeacherClassIds,
  hydrateQuestionRows,
  parseQuestionAttachment,
} from "@/lib/class-question-server";
import { consumeRateLimit } from "@/lib/rate-limit";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNonEmptyString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await getRequestIdentity(req);
  if (
    !actor
    || (actor.role !== "student" && actor.role !== "teacher")
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  let query = admin.from("class_questions").select("*");
  if (actor.role === "student" && actor.studentId) {
    query = query.eq("student_id", actor.studentId);
  } else if (actor.role === "teacher" && actor.teacherId) {
    let classIds: string[];
    try {
      classIds = await getTeacherClassIds(admin, actor.teacherId);
    } catch {
      return NextResponse.json({ error: "question_list_failed" }, { status: 500 });
    }
    if (classIds.length === 0) {
      return req.nextUrl.searchParams.get("summary") === "1"
        ? NextResponse.json({ count: 0 })
        : NextResponse.json([]);
    }
    query = query.in("class_id", classIds);
  } else {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (req.nextUrl.searchParams.get("summary") === "1") {
    const status = actor.role === "teacher" ? "open" : "answered";
    const { data, error } = await query.eq("status", status);
    return error
      ? NextResponse.json({ error: "question_list_failed" }, { status: 500 })
      : NextResponse.json(
          { count: data?.length ?? 0 },
          { headers: { "Cache-Control": "private, no-store" } },
        );
  }

  const { data, error } = await query.order("last_message_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "question_list_failed" }, { status: 500 });
  }
  try {
    return NextResponse.json(
      await hydrateQuestionRows(admin, (data ?? []) as Record<string, unknown>[]),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "question_list_failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "student" || !actor.studentId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!await consumeRateLimit({
    scope: "class-question-create",
    key: actor.userId,
    limit: 8,
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
  if (
    !isNonEmptyString(body.class_id, 100)
    || !isNonEmptyString(body.title, 160)
    || body.title.trim().length < 3
    || !isNonEmptyString(body.content, 10_000)
  ) {
    return NextResponse.json({ error: "invalid_question" }, { status: 400 });
  }

  const classId = body.class_id.trim();
  const admin = createAdminClient();
  const { data: classRow, error: classError } = await admin
    .from("classes")
    .select("id")
    .eq("id", classId)
    .contains("student_ids", [actor.studentId])
    .maybeSingle();
  if (classError || !classRow) {
    return NextResponse.json({ error: "class_access_denied" }, { status: 403 });
  }

  let attachment;
  try {
    attachment = parseQuestionAttachment(body.attachment, classId, actor.studentId);
  } catch {
    return NextResponse.json({ error: "invalid_attachment" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: question, error: questionError } = await admin
    .from("class_questions")
    .insert({
      class_id: classId,
      student_id: actor.studentId,
      title: body.title.trim(),
      status: "open",
      last_message_role: "student",
      last_message_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (questionError || !question) {
    return NextResponse.json({ error: "question_create_failed" }, { status: 500 });
  }

  const { error: messageError } = await admin
    .from("class_question_messages")
    .insert({
      question_id: question.id,
      author_user_id: actor.userId,
      author_role: "student",
      author_name: actor.displayName.slice(0, 160),
      content: body.content.trim(),
      attachment_url: attachment?.url ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_size: attachment?.size ?? null,
      created_at: now,
    });
  if (messageError) {
    await admin.from("class_questions").delete().eq("id", question.id);
    return NextResponse.json({ error: "question_create_failed" }, { status: 500 });
  }

  try {
    const [created] = await hydrateQuestionRows(admin, [question]);
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "question_create_failed" }, { status: 500 });
  }
}
