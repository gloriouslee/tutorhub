import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { logEvent } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasValidMutationOrigin } from "@/lib/request-security";

const ENTITY_FIELDS: Record<string, Set<string>> = {
  students: new Set([
    "id", "user_id", "full_name", "email", "dob", "school", "grade",
    "learning_type", "parent_id", "avatar_url", "created_at",
  ]),
  teachers: new Set([
    "id", "user_id", "full_name", "email", "specialization", "bio",
    "avatar_url", "created_at",
  ]),
  classes: new Set([
    "id", "class_name", "subject", "grade", "learning_mode", "tutor_id",
    "classroom", "zoom_link", "schedule", "student_ids", "description",
    "max_students", "color", "created_at",
  ]),
  payments: new Set([
    "id", "student_id", "class_id", "amount", "due_date", "paid_date",
    "payment_status", "description", "created_at",
  ]),
  attendance: new Set([
    "id", "class_id", "student_id", "attendance_date", "status", "notes",
    "created_at",
  ]),
  notifications: new Set([
    "id", "title", "content", "category", "target_role", "target_class_id",
    "sent_by", "is_read", "created_at",
  ]),
};

function validateRows(value: unknown, fields: Set<string>) {
  if (!Array.isArray(value) || value.length > 5_000) return null;
  const seen = new Set<string>();
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const record = row as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      record.id.length === 0 ||
      record.id.length > 120 ||
      seen.has(record.id) ||
      Object.keys(record).some((key) => !fields.has(key))
    ) {
      return null;
    }
    seen.add(record.id);
  }
  if (JSON.stringify(value).length > 5_000_000) return null;
  return value as Record<string, unknown>[];
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> },
) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (!actor) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }
  const { entity } = await params;
  const fields = ENTITY_FIELDS[entity];
  if (!fields) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const items = validateRows(body.items, fields);
  if (!items) {
    return NextResponse.json({ error: "invalid_entity_rows" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (actor.role === "admin") {
    const { data, error } = await admin.rpc("replace_admin_entity_rows_secure", {
      p_table_name: entity,
      p_rows: items,
      p_actor_id: actor.userId,
    });
    if (error || data !== true) {
      logEvent("error", "admin.entity_replace_failed", {
        actor_id: actor.userId,
        entity,
        error: error?.message ?? "not_replaced",
      });
      return NextResponse.json({ error: "entity_replace_failed" }, { status: 500 });
    }
    logEvent("info", "admin.entity_replaced", {
      actor_id: actor.userId,
      entity,
      row_count: items.length,
    });
    return NextResponse.json({ success: true });
  }

  if (actor.role === "teacher" && entity === "notifications") {
    // A teacher may only write notifications scoped to a class they own. This
    // prevents overwriting other users' notifications (by id) or injecting into
    // classes they don't teach. Rows for other classes are ignored, not written.
    const { data: owned } = await admin
      .from("classes")
      .select("id")
      .eq("tutor_id", actor.teacherId ?? "");
    const ownedSet = new Set((owned ?? []).map((c) => String(c.id)));
    const safeItems = items.filter(
      (item) =>
        item.target_role !== "admin" &&
        typeof item.title === "string" &&
        item.title.length <= 200 &&
        typeof item.content === "string" &&
        item.content.length <= 5_000 &&
        typeof item.target_class_id === "string" &&
        ownedSet.has(item.target_class_id),
    );
    if (safeItems.length === 0) {
      return NextResponse.json({ success: true, written: 0 });
    }
    for (const item of safeItems) item.sent_by = actor.userId;
    const { error } = await admin.from("notifications").upsert(safeItems);
    if (error) {
      return NextResponse.json({ error: "notification_save_failed" }, { status: 500 });
    }
    return NextResponse.json({ success: true, written: safeItems.length });
  }

  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}
