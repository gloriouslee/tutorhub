"use client";

import { useState, useEffect, useCallback } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import {
  getInvoices, confirmInvoicePaid, recordTuitionPayment,
  getTransactions, updateTransactionStatus,
  type TuitionInvoice, type PurchaseTransaction,
} from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import {
  Receipt, CreditCard, CheckCircle2, XCircle, Clock, User, BookOpen,
  Calendar, RefreshCw, Wallet, Inbox,
} from "lucide-react";
import { useTeacherContext } from "@/hooks/useTeacherContext";

function fmtDateTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function periodOf(inv: TuitionInvoice): string {
  return inv.period ?? inv.due_date.slice(0, 7);
}

export default function TeacherApprovalsPage() {
  const { teacherName } = useTeacherContext();
  const [invoices, setInvoices] = useState<TuitionInvoice[]>([]);
  const [txs, setTxs] = useState<PurchaseTransaction[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(() => {
    getInvoices().then(setInvoices);
    getTransactions().then(setTxs);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const pendingInvoices = invoices.filter(i => i.status === "pending_verification");
  const pendingTxs = txs.filter(t => t.status === "pending");

  async function confirmInvoice(inv: TuitionInvoice) {
    if (busy) return;
    setBusy(inv.id);
    try {
      if (inv.class_id) {
        // Ghi nhận thanh toán theo lớp — hàm này tự đồng bộ hóa đơn sang "đã đóng"
        await recordTuitionPayment(inv.class_id, inv.child_id, {
          amount: inv.amount, period: periodOf(inv), paid_at: new Date().toISOString(),
          method: "transfer", note: "Xác nhận biên lai học sinh (Duyệt thu)",
        });
      } else {
        await confirmInvoicePaid(inv.id);
      }
      reload();
    } catch {
      alert("Không thể xác nhận khoản thu. Vui lòng tải lại để kiểm tra trạng thái.");
    } finally {
      setBusy(null);
    }
  }

  async function actTx(txId: string, action: "approved" | "rejected") {
    if (busy) return;
    setBusy(txId);
    try {
      await updateTransactionStatus(txId, action);
      reload();
    } catch {
      alert("Không thể cập nhật giao dịch. Vui lòng tải lại để kiểm tra trạng thái.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <PortalLayout role="teacher" userName={teacherName || "Giáo viên"} pageTitle="Duyệt thu">
      <div className="max-w-4xl mx-auto space-y-6">
        <SectionHeader
          title="Duyệt thu tiền"
          subtitle="Xác nhận học phí học viên đã chuyển & duyệt giao dịch mua tài liệu"
          action={
            <Button size="sm" variant="outline" className="gap-1.5" onClick={reload}>
              <RefreshCw className="h-3.5 w-3.5" /> Làm mới
            </Button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Học phí chờ xác nhận</p>
                <p className="text-lg font-bold text-foreground">{pendingInvoices.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Giao dịch tài liệu chờ duyệt</p>
                <p className="text-lg font-bold text-foreground">{pendingTxs.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Tuition receipts ── */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" /> Học phí — biên lai chờ xác nhận ({pendingInvoices.length})
          </h3>
          {pendingInvoices.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto opacity-30 mb-2" />Không có biên lai nào đang chờ.
            </CardContent></Card>
          ) : pendingInvoices.map(inv => (
            <Card key={inv.id} className="border-amber-200 dark:border-amber-800/50">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                    <Clock className="h-3 w-3" /> Chờ xác minh
                  </span>
                  <p className="text-sm font-semibold text-foreground">{inv.title}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> {inv.child_id}
                    <span className="mx-1">·</span>
                    <Calendar className="h-3 w-3" /> Hạn {inv.due_date}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="text-lg font-bold text-foreground">{formatCurrency(inv.amount)}</p>
                  <Button
                    size="sm" className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                    disabled={busy === inv.id}
                    onClick={() => confirmInvoice(inv)}
                  >
                    {busy === inv.id
                      ? <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full inline-block" />
                      : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Xác nhận đã thu
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Material transactions ── */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Mua tài liệu — giao dịch chờ duyệt ({pendingTxs.length})
          </h3>
          {pendingTxs.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto opacity-30 mb-2" />Không có giao dịch nào đang chờ.
            </CardContent></Card>
          ) : pendingTxs.map(tx => (
            <Card key={tx.id} className="border-amber-200 dark:border-amber-800/50">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    <Clock className="h-3 w-3" /> Chờ xác nhận
                  </span>
                  <p className="text-sm font-semibold text-foreground">{tx.pkg_title}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                    <User className="h-3 w-3" /> {tx.student_name}
                    <span className="mx-1">·</span>
                    Mã GD: <span className="font-mono">{tx.transfer_note}</span>
                    <span className="mx-1">·</span>
                    <Calendar className="h-3 w-3" /> {fmtDateTime(tx.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-lg font-bold text-foreground mr-1">{formatCurrency(tx.amount)}</p>
                  <Button
                    size="sm" variant="outline"
                    className="h-8 gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                    disabled={busy === tx.id}
                    onClick={() => actTx(tx.id, "rejected")}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Từ chối
                  </Button>
                  <Button
                    size="sm" className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                    disabled={busy === tx.id}
                    onClick={() => actTx(tx.id, "approved")}
                  >
                    {busy === tx.id
                      ? <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full inline-block" />
                      : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Duyệt
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}
