"use client";

import { useState, useEffect, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import {
  getInvoicesOrThrow, confirmInvoicePaid, recordTuitionPayment,
  getTransactions, updateTransactionStatus,
  type TuitionInvoice, type PurchaseTransaction,
} from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import {
  Receipt, CreditCard, CheckCircle2, XCircle, Clock, User, BookOpen,
  Calendar, RefreshCw, Wallet, Inbox, ExternalLink, AlertCircle, Loader2, X,
} from "lucide-react";
import { useTeacherContext } from "@/hooks/useTeacherContext";

function fmtDateTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function periodOf(inv: TuitionInvoice): string {
  return inv.period ?? inv.due_date.slice(0, 7);
}
function receiptUrl(path: string) {
  return `/api/files?bucket=payment-receipts&path=${encodeURIComponent(path)}`;
}

export default function TeacherApprovalsPage() {
  const { teacherName, ready } = useTeacherContext();
  const [invoices, setInvoices] = useState<TuitionInvoice[]>([]);
  const [txs, setTxs] = useState<PurchaseTransaction[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [rejectionTarget, setRejectionTarget] = useState<PurchaseTransaction | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionError, setActionError] = useState("");

  const reload = useCallback(async () => {
    if (!ready) return;
    setLoadError("");
    try {
      const [invoiceList, transactionList] = await Promise.all([getInvoicesOrThrow(), getTransactions()]);
      setInvoices(invoiceList);
      setTxs(transactionList);
      setLoadState("ready");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Không thể tải danh sách duyệt thu.");
      setLoadState("error");
    }
  }, [ready]);
  useEffect(() => { if (ready) void reload(); }, [ready, reload]);

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
      await reload();
    } catch {
      alert("Không thể xác nhận khoản thu. Vui lòng tải lại để kiểm tra trạng thái.");
    } finally {
      setBusy(null);
    }
  }

  async function actTx(txId: string, action: "approved" | "rejected", reason?: string) {
    if (busy) return;
    setBusy(txId);
    setActionError("");
    try {
      await updateTransactionStatus(txId, action, reason);
      await reload();
      if (action === "rejected") {
        setRejectionTarget(null);
        setRejectionReason("");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể cập nhật giao dịch.";
      if (action === "rejected") setActionError(message);
      else alert(`${message} Vui lòng tải lại để kiểm tra trạng thái.`);
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
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void reload()}>
              <RefreshCw className="h-3.5 w-3.5" /> Làm mới
            </Button>
          }
        />

        {loadState === "error" && (
          <Card className="border-red-200 dark:border-red-900/60">
            <CardContent className="flex flex-col items-center py-10 text-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="mt-3 text-sm font-semibold text-foreground">Chưa thể tải danh sách duyệt thu</p>
              <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
              <Button className="mt-4" size="sm" onClick={() => void reload()}>
                <RefreshCw className="h-3.5 w-3.5" /> Thử lại
              </Button>
            </CardContent>
          </Card>
        )}

        {loadState === "loading" && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-16 text-sm text-muted-foreground" aria-busy="true">
            <Loader2 className="h-5 w-5 animate-spin" /> Đang tải giao dịch...
          </div>
        )}

        {loadState === "ready" && <>
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
                  {inv.receipt_path && (
                    <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                      <a href={receiptUrl(inv.receipt_path)} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Xem biên lai
                      </a>
                    </Button>
                  )}
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
                  {tx.receipt_path && (
                    <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                      <a href={receiptUrl(tx.receipt_path)} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Biên lai
                      </a>
                    </Button>
                  )}
                  <Button
                    size="sm" variant="outline"
                    className="h-8 gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                    disabled={busy === tx.id}
                    onClick={() => {
                      setRejectionTarget(tx);
                      setRejectionReason("");
                      setActionError("");
                    }}
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
        </>}

        <Dialog.Root
          open={Boolean(rejectionTarget)}
          onOpenChange={(open) => {
            if (!open && !busy) {
              setRejectionTarget(null);
              setRejectionReason("");
              setActionError("");
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-2xl focus:outline-none">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Dialog.Title className="text-lg font-bold text-foreground">Từ chối giao dịch</Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                    Nêu rõ lý do để học viên biết cần sửa hoặc gửi lại biên lai nào.
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Đóng cửa sổ">
                    <X className="h-4 w-4" />
                  </Button>
                </Dialog.Close>
              </div>

              {rejectionTarget && (
                <div className="mt-4 rounded-xl bg-muted/50 p-3 text-sm">
                  <p className="font-semibold text-foreground">{rejectionTarget.pkg_title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {rejectionTarget.student_name} · {formatCurrency(rejectionTarget.amount)}
                  </p>
                </div>
              )}

              <label htmlFor="rejection-reason" className="mt-4 block text-sm font-semibold text-foreground">
                Lý do từ chối <span className="text-red-500">*</span>
              </label>
              <textarea
                id="rejection-reason"
                value={rejectionReason}
                maxLength={500}
                rows={4}
                autoFocus
                placeholder="Ví dụ: Ảnh biên lai bị mờ, chưa thấy mã giao dịch..."
                onChange={(event) => {
                  setRejectionReason(event.target.value);
                  setActionError("");
                }}
                className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>Tối thiểu 5 ký tự</span>
                <span>{rejectionReason.length}/500</span>
              </div>

              {actionError && (
                <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300" role="alert">{actionError}</p>
              )}

              <div className="mt-5 flex gap-3">
                <Dialog.Close asChild>
                  <Button variant="outline" className="flex-1" disabled={Boolean(busy)}>Hủy</Button>
                </Dialog.Close>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={!rejectionTarget || rejectionReason.trim().length < 5 || Boolean(busy)}
                  onClick={() => rejectionTarget && void actTx(rejectionTarget.id, "rejected", rejectionReason.trim())}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Xác nhận từ chối
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </PortalLayout>
  );
}
