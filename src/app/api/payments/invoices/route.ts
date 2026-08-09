import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNonEmptyString } from "@/lib/validation";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { logEvent } from "@/lib/logger";
import { getActiveChildIdsForParent } from "@/lib/guardian-server";

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
    const ids = new Set(await getActiveChildIdsForParent(admin, actor.parentId));
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
  const admin = createAdminClient();
  let data: unknown;
  let error: { message: string } | null;
  if (body.action === "submit_receipt") {
    if (!isNonEmptyString(body.receipt_path, 260)) {
      return NextResponse.json({ error: "receipt_required" }, { status: 400 });
    }
    const invoices = await readInvoices();
    const childId = body.invoice_id === "ALL"
      ? (typeof body.child_id === "string" ? body.child_id : "")
      : (invoices.find(invoice => invoice.id === body.invoice_id)?.child_id ?? "");
    if (!childId || !body.receipt_path.startsWith(`${childId}/`)) {
      return NextResponse.json({ error: "invalid_receipt" }, { status: 400 });
    }
    const result = await admin.rpc("submit_invoice_receipt_secure", {
      p_invoice_id: body.invoice_id,
      p_child_id: childId,
      p_actor_id: actor.userId,
      p_receipt_path: body.receipt_path,
    });
    data = result.data;
    error = result.error;

    if (!error) {
      const targetInvoices = invoices.filter(invoice =>
        invoice.child_id === childId
        && (body.invoice_id === "ALL" ? invoice.status === "pending" : invoice.id === body.invoice_id),
      );
      const classIds = [...new Set(targetInvoices.map(invoice => invoice.class_id).filter(Boolean))] as string[];
      if (classIds.length > 0) {
        const rows = classIds.map(classId => ({
          id: crypto.randomUUID(),
          title: "Học viên gửi biên lai học phí",
          content: `${actor.displayName} đã gửi biên lai học phí, đang chờ xác nhận.`,
          target_role: "teacher",
          target_class_id: classId,
          category: "system",
          sent_by: actor.displayName,
          sender_user_id: actor.userId,
          is_read: false,
        }));
        const { error: notificationError } = await admin.from("notifications").insert(rows);
        if (notificationError) {
          logEvent("warn", "invoice.notification_failed", {
            actor_id: actor.userId,
            error: notificationError.message,
          });
        }
      }
    }
  } else {
    const result = await admin.rpc("mutate_invoice_secure", {
      p_action: body.action,
      p_invoice_id: body.invoice_id,
      p_child_id: typeof body.child_id === "string" ? body.child_id : null,
      p_actor_id: actor.userId,
      p_invoice: null,
    });
    data = result.data;
    error = result.error;
  }
  if (error) {
    const forbidden = error.message.includes("forbidden");
    return NextResponse.json(
      { error: forbidden ? "forbidden" : "invoice_update_failed" },
      { status: forbidden ? 403 : 409 },
    );
  }
  return NextResponse.json({ success: true, result: data });
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
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("mutate_invoice_secure", {
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

  // Phát hành xong mà không báo gì thì học viên không có cách nào biết là có hoá
  // đơn mới — trước đây chỉ luồng gửi biên lai mới sinh thông báo (cho giáo viên).
  //
  // Thông báo gắn theo LỚP chứ không theo từng học viên, vì bảng notifications
  // chỉ lọc theo vai trò + lớp. Do đó tuyệt đối không đưa số tiền vào nội dung:
  // học phí của một em sẽ hiển thị cho cả lớp. Số tiền cụ thể xem ở trang Thanh toán.
  const notificationTitle = `Học phí tháng ${Number(month)}/${year}`;
  const { data: existing } = await admin
    .from("notifications")
    .select("id")
    .eq("target_class_id", invoice.class_id)
    .eq("title", notificationTitle)
    .limit(1);
  // Phát hành hàng loạt gọi endpoint này một lần cho mỗi học viên; chỉ báo một lần.
  if (!existing?.length) {
    const { error: notificationError } = await admin.from("notifications").insert({
      id: crypto.randomUUID(),
      title: notificationTitle,
      content: `Học phí ${body.class_name.trim()} tháng ${Number(month)}/${year} đã được phát hành. Vào mục Thanh toán để xem chi tiết và nộp biên lai.`,
      target_role: "student",
      target_class_id: invoice.class_id,
      category: "payment",
      sent_by: actor.displayName,
      sender_user_id: actor.userId,
      is_read: false,
    });
    if (notificationError) {
      // Hoá đơn đã ghi thành công — hỏng thông báo không được làm hỏng cả thao tác.
      logEvent("warn", "invoice.issue_notification_failed", {
        actor_id: actor.userId,
        class_id: invoice.class_id,
        error: notificationError.message,
      });
    }
  }

  return NextResponse.json(data, { status: 201 });
}
