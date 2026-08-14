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
  notifications: new Set([
    "id", "title", "content", "category", "target_role", "target_class_id",
    "target_student_id", "sent_by", "sender_user_id", "is_read", "created_at",
  ]),
};

function validateItem(value: unknown, fields: Set<string>) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string"
    || item.id.length === 0
    || item.id.length > 120
    || Object.keys(item).some((key) => !fields.has(key))
    || JSON.stringify(item).length > 100_000
  ) {
    return null;
  }
  return item;
}

async function context(req: NextRequest, params: Promise<{ entity: string }>) {
  if (!hasValidMutationOrigin(req)) {
    return { response: NextResponse.json({ error: "invalid_origin" }, { status: 403 }) };
  }
  const actor = await getRequestIdentity(req);
  if (!actor) {
    return {
      response: NextResponse.json(
        { error: "authentication_required" },
        { status: 401 },
      ),
    };
  }
  const { entity } = await params;
  const fields = ENTITY_FIELDS[entity];
  if (!fields) {
    return { response: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  }
  return { actor, entity, fields };
}

async function teacherCanWriteNotification(
  admin: ReturnType<typeof createAdminClient>,
  teacherId: string | null | undefined,
  item: Record<string, unknown>,
) {
  if (
    item.target_role === "admin"
    || typeof item.title !== "string"
    || item.title.length > 200
    || typeof item.content !== "string"
    || item.content.length > 5_000
    || typeof item.target_class_id !== "string"
  ) {
    return false;
  }
  const { data } = await admin
    .from("classes")
    .select("id,student_ids")
    .eq("id", item.target_class_id)
    .eq("tutor_id", teacherId ?? "")
    .maybeSingle();
  if (!data) return false;
  if (item.target_student_id === undefined || item.target_student_id === null || item.target_student_id === "") return true;
  return typeof item.target_student_id === "string"
    && item.target_student_id.length <= 120
    && Array.isArray(data.student_ids)
    && data.student_ids.includes(item.target_student_id);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> },
) {
  const result = await context(req, params);
  if ("response" in result) return result.response;

  const { actor, entity, fields } = result;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const item = validateItem(body.item, fields);
  if (!item) {
    return NextResponse.json({ error: "invalid_entity_row" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (actor.role === "teacher" && entity === "notifications") {
    if (!await teacherCanWriteNotification(admin, actor.teacherId, item)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    item.sent_by = actor.displayName;
    item.sender_user_id = actor.userId;
  } else if (actor.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } else if (entity === "notifications") {
    item.sent_by = actor.displayName;
    item.sender_user_id = actor.userId;
  }

  const { data, error } = await admin
    .from(entity)
    .upsert(item)
    .select("*")
    .single();
  if (error) {
    logEvent("error", "admin.entity_upsert_failed", {
      actor_id: actor.userId,
      entity,
      record_id: item.id,
      error: error.message,
    });
    return NextResponse.json({ error: "entity_upsert_failed" }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> },
) {
  const result = await context(req, params);
  if ("response" in result) return result.response;
  const { actor, entity } = result;
  const id = req.nextUrl.searchParams.get("id");
  if (!id || id.length > 120) {
    return NextResponse.json({ error: "invalid_entity_id" }, { status: 400 });
  }
  const admin = createAdminClient();
  if (actor.role === "teacher" && entity === "notifications") {
    const { data: notification } = await admin
      .from("notifications")
      .select("id,target_class_id")
      .eq("id", id)
      .maybeSingle();
    if (
      !notification?.target_class_id
      || !await teacherCanWriteNotification(admin, actor.teacherId, {
        id,
        title: "delete",
        content: "delete",
        target_role: "student",
        target_class_id: notification.target_class_id,
      })
    ) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } else if (actor.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (entity === "students" || entity === "teachers") {
    const { data, error } = await admin.rpc(
      "delete_admin_domain_identity_secure",
      {
        p_entity: entity,
        p_record_id: id,
        p_actor_id: actor.userId,
      },
    );
    if (error) {
      const conflict = error.message.includes("_has_classes");
      return NextResponse.json(
        { error: conflict ? error.message : "entity_delete_failed" },
        { status: conflict ? 409 : 500 },
      );
    }
    if (typeof data === "string" && data) {
      const authResult = await admin.auth.admin.deleteUser(data);
      if (authResult.error) {
        logEvent("error", "admin.domain_auth_delete_failed", {
          actor_id: actor.userId,
          entity,
          record_id: id,
          user_id: data,
          error: authResult.error.message,
        });
        return NextResponse.json(
          { error: "account_delete_incomplete" },
          { status: 500 },
        );
      }
    }
    return NextResponse.json({ success: true });
  }

  const { error } = await admin.from(entity).delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "entity_delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
