import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { logEvent } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNonEmptyString, validatePassword } from "@/lib/validation";
import { hasValidMutationOrigin } from "@/lib/request-security";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!isNonEmptyString(id, 100)) {
    return NextResponse.json({ error: "invalid_enrollment_id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (body.action === "reject") {
    const reason =
      typeof body.reject_reason === "string"
        ? body.reject_reason.trim().slice(0, 1000)
        : null;
    const { data, error } = await admin
      .from("enrollment_requests")
      .update({
        status: "rejected",
        reject_reason: reason,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json(
        { error: error ? "enrollment_reject_failed" : "enrollment_not_pending" },
        { status: error ? 500 : 409 },
      );
    }
    logEvent("info", "enrollment.rejected", {
      actor_id: actor.userId,
      enrollment_id: id,
    });
    return NextResponse.json({ success: true });
  }

  if (body.action !== "approve") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  if (!isNonEmptyString(body.assigned_class_id, 100)) {
    return NextResponse.json({ error: "invalid_class_id" }, { status: 400 });
  }
  const passwordError = validatePassword(body.account_password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const { data: enrollment, error: fetchError } = await admin
    .from("enrollment_requests")
    .select("id,email,full_name,status")
    .eq("id", id)
    .maybeSingle();
  if (fetchError || !enrollment) {
    return NextResponse.json({ error: "enrollment_not_found" }, { status: 404 });
  }
  if (enrollment.status !== "pending") {
    return NextResponse.json({ error: "enrollment_not_pending" }, { status: 409 });
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: String(enrollment.email).trim().toLowerCase(),
    password: body.account_password as string,
    email_confirm: true,
    app_metadata: { role: "student" },
    user_metadata: { full_name: enrollment.full_name },
  });
  if (authError) {
    const duplicate = authError.message.toLowerCase().includes("already");
    logEvent("warn", "enrollment.auth_create_failed", {
      actor_id: actor.userId,
      enrollment_id: id,
      error: authError.message,
    });
    return NextResponse.json(
      { error: duplicate ? "account_already_exists" : "account_create_failed" },
      { status: duplicate ? 409 : 500 },
    );
  }

  const userId = authData.user.id;
  const { data: result, error: transactionError } = await admin.rpc(
    "approve_enrollment_request_secure",
    {
      p_enrollment_id: id,
      p_assigned_class_id: body.assigned_class_id,
      p_auth_user_id: userId,
      p_actor_id: actor.userId,
    },
  );

  if (transactionError) {
    await admin.auth.admin.deleteUser(userId);
    logEvent("error", "enrollment.approve_transaction_failed", {
      actor_id: actor.userId,
      enrollment_id: id,
      error: transactionError.message,
    });
    return NextResponse.json(
      { error: "enrollment_approval_transaction_failed" },
      { status: 500 },
    );
  }

  logEvent("info", "enrollment.approved", {
    actor_id: actor.userId,
    enrollment_id: id,
    user_id: userId,
  });
  return NextResponse.json({
    success: true,
    student_id: result,
    temporary_password_persisted: false,
  });
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  if (!isNonEmptyString(id, 100)) {
    return NextResponse.json({ error: "invalid_enrollment_id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: userId, error } = await admin.rpc(
    "delete_enrollment_request_secure",
    { p_enrollment_id: id, p_actor_id: actor.userId },
  );
  if (error) {
    logEvent("error", "enrollment.delete_transaction_failed", {
      actor_id: actor.userId,
      enrollment_id: id,
      error: error.message,
    });
    return NextResponse.json({ error: "enrollment_delete_failed" }, { status: 500 });
  }
  if (typeof userId === "string" && userId) {
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      logEvent("error", "enrollment.auth_delete_failed", {
        actor_id: actor.userId,
        enrollment_id: id,
        user_id: userId,
        error: authDeleteError.message,
      });
      return NextResponse.json(
        { error: "auth_delete_failed_database_already_cleaned" },
        { status: 500 },
      );
    }
  }
  logEvent("info", "enrollment.deleted", {
    actor_id: actor.userId,
    enrollment_id: id,
  });
  return NextResponse.json({ success: true });
}
