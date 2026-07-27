import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { logEvent } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNonEmptyString } from "@/lib/validation";
import { hasValidMutationOrigin } from "@/lib/request-security";

const FIXED_PRODUCTS: Record<string, { title: string; amount: number }> = {
  pp1: { title: "Toán 12 — Siêu Ôn Luyện THPT Quốc Gia", amount: 299000 },
  pp2: { title: "Vật Lý 12 — Điện xoay chiều & Sóng", amount: 199000 },
  pp3: { title: "Hóa Học 12 — Lý thuyết & Bài tập nâng cao", amount: 349000 },
  pp4: { title: "Tiếng Anh 12 — Ngữ pháp & Từ vựng", amount: 149000 },
};

type CatalogItem = { id?: unknown; title?: unknown; price?: unknown };

async function resolveProduct(pkgId: string) {
  if (FIXED_PRODUCTS[pkgId]) return FIXED_PRODUCTS[pkgId];
  const { data } = await createAdminClient()
    .from("teacher_materials")
    .select("data")
    .eq("id", pkgId)
    .maybeSingle();
  const item = (data?.data ?? null) as CatalogItem | null;
  if (
    item &&
    typeof item.title === "string" &&
    typeof item.price === "number" &&
    Number.isSafeInteger(item.price) &&
    item.price > 0 &&
    item.price <= 100_000_000
  ) {
    return { title: item.title.slice(0, 200), amount: item.price };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const actor = await getRequestIdentity(req);
  if (!actor) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }

  const admin = createAdminClient();
  let query = admin
    .from("purchase_transactions")
    .select("*")
    .order("created_at", { ascending: false });

  if (actor.role === "student") {
    if (!actor.studentId) {
      return NextResponse.json({ error: "student_profile_required" }, { status: 403 });
    }
    query = query.eq("student_id", actor.studentId);
  } else if (actor.role === "parent") {
    if (!actor.parentId) {
      return NextResponse.json({ error: "parent_profile_required" }, { status: 403 });
    }
    const { data: children, error: childError } = await admin
      .from("students")
      .select("id")
      .eq("parent_id", actor.parentId);
    if (childError) {
      return NextResponse.json({ error: "payment_list_failed" }, { status: 500 });
    }
    const ids = (children ?? []).map((child) => String(child.id));
    if (ids.length === 0) return NextResponse.json([]);
    query = query.in("student_id", ids);
  } else if (actor.role !== "teacher" && actor.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await query;
  if (error) {
    logEvent("error", "payment.list_failed", {
      actor_id: actor.userId,
      error: error.message,
    });
    return NextResponse.json({ error: "payment_list_failed" }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
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
  if (!isNonEmptyString(body.pkg_id, 100)) {
    return NextResponse.json({ error: "invalid_product" }, { status: 400 });
  }
  const product = await resolveProduct(body.pkg_id);
  if (!product) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 });
  }

  const transferNote =
    typeof body.transfer_note === "string"
      ? body.transfer_note.trim().slice(0, 200)
      : "";
  const id = crypto.randomUUID();
  const { data, error } = await createAdminClient()
    .from("purchase_transactions")
    .insert({
      id,
      pkg_id: body.pkg_id,
      pkg_title: product.title,
      amount: product.amount,
      student_id: actor.studentId,
      student_name: actor.displayName,
      student_email: actor.email,
      transfer_note: transferNote,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) {
    logEvent("error", "payment.create_failed", {
      actor_id: actor.userId,
      product_id: body.pkg_id,
      error: error.message,
    });
    return NextResponse.json({ error: "payment_create_failed" }, { status: 500 });
  }
  logEvent("info", "payment.created", {
    actor_id: actor.userId,
    transaction_id: id,
  });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (!actor || !["teacher", "admin"].includes(actor.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    !isNonEmptyString(body.transaction_id, 100) ||
    (body.status !== "approved" && body.status !== "rejected")
  ) {
    return NextResponse.json({ error: "invalid_transaction_update" }, { status: 400 });
  }

  const { data, error } = await createAdminClient()
    .from("purchase_transactions")
    .update({
      status: body.status,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", body.transaction_id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error ? "payment_update_failed" : "payment_not_pending" },
      { status: error ? 500 : 409 },
    );
  }
  logEvent("info", "payment.reviewed", {
    actor_id: actor.userId,
    transaction_id: body.transaction_id,
    status: body.status,
  });
  return NextResponse.json({ success: true });
}
