import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { teacherCanManageStudent } from "@/lib/guardian-server";
import { logEvent } from "@/lib/logger";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const PRIVATE_NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

async function loadLink(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("student_guardians")
    .select("id,student_id,parent_id,status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "parent" || !actor.parentId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (body.action !== "accept" && body.action !== "reject") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const { id } = await params;
  let link: Awaited<ReturnType<typeof loadLink>>;
  try {
    link = await loadLink(id);
  } catch (error) {
    logEvent("error", "guardian.invitation_lookup_failed", {
      actor_id: actor.userId,
      guardian_link_id: id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "invitation_lookup_failed" },
      { status: 500, ...PRIVATE_NO_STORE },
    );
  }
  if (!link || link.parent_id !== actor.parentId) {
    return NextResponse.json(
      { error: "invitation_not_found" },
      { status: 404, ...PRIVATE_NO_STORE },
    );
  }

  const accepted = body.action === "accept";
  if (link.status !== "pending") {
    const requestedStatus = accepted ? "active" : "rejected";
    if (link.status === requestedStatus) {
      return NextResponse.json(
        { success: true, alreadyProcessed: true },
        PRIVATE_NO_STORE,
      );
    }
    return NextResponse.json(
      { error: "invitation_already_processed" },
      { status: 409, ...PRIVATE_NO_STORE },
    );
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { data: updatedLink, error } = await admin
    .from("student_guardians")
    .update({
      status: accepted ? "active" : "rejected",
      accepted_at: accepted ? now : null,
      rejected_at: accepted ? null : now,
      revoked_at: null,
      updated_at: now,
    })
    .eq("id", id)
    .eq("parent_id", actor.parentId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) {
    logEvent("error", "guardian.invitation_update_failed", {
      actor_id: actor.userId,
      guardian_link_id: id,
      reason: error.message,
    });
    return NextResponse.json(
      { error: "invitation_update_failed" },
      { status: 500, ...PRIVATE_NO_STORE },
    );
  }
  if (!updatedLink) {
    const latest = await loadLink(id).catch(() => null);
    if (latest?.parent_id === actor.parentId && latest.status === (accepted ? "active" : "rejected")) {
      return NextResponse.json(
        { success: true, alreadyProcessed: true },
        PRIVATE_NO_STORE,
      );
    }
    return NextResponse.json(
      { error: "invitation_already_processed" },
      { status: 409, ...PRIVATE_NO_STORE },
    );
  }

  // Keep the legacy primary-parent field populated during the rollout. The new
  // authorization path uses student_guardians and supports additional parents.
  if (accepted) {
    const { error: legacyParentError } = await admin
      .from("students")
      .update({ parent_id: actor.parentId })
      .eq("id", link.student_id)
      .is("parent_id", null);
    if (legacyParentError) {
      logEvent("warn", "guardian.legacy_parent_sync_failed", {
        actor_id: actor.userId,
        guardian_link_id: id,
        student_id: link.student_id,
        reason: legacyParentError.message,
      });
    }
  }

  logEvent("info", accepted ? "guardian.accepted" : "guardian.rejected", {
    actor_id: actor.userId,
    guardian_link_id: id,
    student_id: link.student_id,
  });
  return NextResponse.json({ success: true }, PRIVATE_NO_STORE);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (!actor) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }
  const { id } = await params;
  let link: Awaited<ReturnType<typeof loadLink>>;
  try {
    link = await loadLink(id);
  } catch (error) {
    logEvent("error", "guardian.link_lookup_failed", {
      actor_id: actor.userId,
      guardian_link_id: id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "guardian_link_lookup_failed" },
      { status: 500, ...PRIVATE_NO_STORE },
    );
  }
  if (!link) {
    return NextResponse.json({ error: "guardian_link_not_found" }, { status: 404 });
  }

  let allowed = actor.role === "admin";
  if (actor.role === "parent" && actor.parentId) {
    allowed = link.parent_id === actor.parentId;
  } else if (actor.role === "teacher" && actor.teacherId) {
    allowed = await teacherCanManageStudent(
      createAdminClient(),
      actor.teacherId,
      link.student_id,
    );
  }
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin
    .from("student_guardians")
    .update({ status: "revoked", revoked_at: now, updated_at: now })
    .eq("id", id);
  if (error) {
    logEvent("error", "guardian.revoke_failed", {
      actor_id: actor.userId,
      guardian_link_id: id,
      reason: error.message,
    });
    return NextResponse.json({ error: "guardian_revoke_failed" }, { status: 500 });
  }

  // Keep the legacy primary-parent column from granting access after a revoke.
  // If another confirmed guardian exists, promote that relation as the fallback.
  const { data: replacement } = await admin
    .from("student_guardians")
    .select("parent_id")
    .eq("student_id", link.student_id)
    .eq("status", "active")
    .neq("parent_id", link.parent_id)
    .limit(1)
    .maybeSingle();
  await admin
    .from("students")
    .update({ parent_id: replacement?.parent_id ?? null })
    .eq("id", link.student_id)
    .eq("parent_id", link.parent_id);

  logEvent("info", "guardian.revoked", {
    actor_id: actor.userId,
    guardian_link_id: id,
    student_id: link.student_id,
  });
  return NextResponse.json({ success: true }, PRIVATE_NO_STORE);
}
