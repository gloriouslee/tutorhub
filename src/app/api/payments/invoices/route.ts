import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNonEmptyString } from "@/lib/validation";
import { hasValidMutationOrigin } from "@/lib/request-security";

type Invoice = {
  id: string;
  child_id: string;
  title: string;
  amount: number;
  due_date: string;
  status: "pending" | "pending_verification" | "paid";
  paid_at?: string;
  submitted_by?: "student" | "parent";
  class_id?: string;
  period?: string;
};

async function readInvoices(): Promise<Invoice[]> {
  const { data, error } = await createAdminClient()
    .from("kv_invoices")
    .select("value")
    .eq("id", "global")
    .maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.value) ? (data.value as Invoice[]) : [];
}

export async function GET(req: NextRequest) {
  const actor = await getRequestIdentity(req);
  if (!actor) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }
  const invoices = await readInvoices();
  if (actor.role === "admin") return NextResponse.json(invoices);
  if (actor.role === "student" && actor.studentId) {
    return NextResponse.json(
      invoices.filter((invoice) => invoice.child_id === actor.studentId),
    );
  }
  const admin = createAdminClient();
  if (actor.role === "parent" && actor.parentId) {
    const { data: children } = await admin
      .from("students")
      .select("id")
      .eq("parent_id", actor.parentId);
    const ids = new Set((children ?? []).map((child) => String(child.id)));
    return NextResponse.json(invoices.filter((invoice) => ids.has(invoice.child_id)));
  }
  if (actor.role === "teacher" && actor.teacherId) {
    const { data: classes } = await admin
      .from("classes")
      .select("id")
      .eq("tutor_id", actor.teacherId);
    const ids = new Set((classes ?? []).map((item) => String(item.id)));
    return NextResponse.json(
      invoices.filter((invoice) => invoice.class_id && ids.has(invoice.class_id)),
    );
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export async function PATCH(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (!actor) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    !isNonEmptyString(body.invoice_id, 160) ||
    !isNonEmptyString(body.action, 30) ||
    (body.child_id !== undefined && !isNonEmptyString(body.child_id, 100))
  ) {
    return NextResponse.json({ error: "invalid_invoice_update" }, { status: 400 });
  }
  if (!["submit_receipt", "mark_paid"].includes(body.action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }
  const { data, error } = await createAdminClient().rpc("mutate_invoice_secure", {
    p_action: body.action,
    p_invoice_id: body.invoice_id,
    p_child_id: typeof body.child_id === "string" ? body.child_id : null,
    p_actor_id: actor.userId,
    p_invoice: null,
  });
  if (error) {
    const forbidden = error.message.includes("forbidden");
    return NextResponse.json(
      { error: forbidden ? "forbidden" : "invoice_update_failed" },
      { status: forbidden ? 403 : 409 },
    );
  }
  return NextResponse.json({ success: data === true });
}

export async function POST(req: NextRequest) {
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
    !isNonEmptyString(body.class_id, 100) ||
    !isNonEmptyString(body.class_name, 160) ||
    !isNonEmptyString(body.child_id, 100) ||
    !isNonEmptyString(body.period, 7) ||
    !isNonEmptyString(body.due_date, 10) ||
    typeof body.amount !== "number" ||
    !Number.isSafeInteger(body.amount) ||
    body.amount <= 0 ||
    body.amount > 100_000_000
  ) {
    return NextResponse.json({ error: "invalid_invoice" }, { status: 400 });
  }
  const [year, month] = body.period.split("-");
  const invoice: Invoice = {
    id: `INV-${body.period}-${body.class_id}-${body.child_id}`,
    child_id: body.child_id,
    title: `Học phí ${body.class_name.trim()} - Tháng ${Number(month)}/${year}`,
    amount: body.amount,
    due_date: body.due_date,
    status: "pending",
    class_id: body.class_id,
    period: body.period,
  };
  const { data, error } = await createAdminClient().rpc("mutate_invoice_secure", {
    p_action: "issue",
    p_invoice_id: invoice.id,
    p_child_id: invoice.child_id,
    p_actor_id: actor.userId,
    p_invoice: invoice,
  });
  if (error) {
    const forbidden = error.message.includes("forbidden");
    return NextResponse.json(
      { error: forbidden ? "forbidden" : "invoice_issue_failed" },
      { status: forbidden ? 403 : 409 },
    );
  }
  return NextResponse.json(data, { status: 201 });
}
