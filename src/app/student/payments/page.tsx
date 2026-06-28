"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared";
import {
  createTransaction, getTransactions, getGrantedPackages,
  type PurchaseTransaction,
} from "@/lib/storage";
import {
  DollarSign, CreditCard, Receipt, Clock, CheckCircle2,
  AlertCircle, ArrowRight, X, QrCode, UploadCloud, BookMarked,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Package catalogue (mirrors student/materials/page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

const PACKAGES: Record<string, { id: string; title: string; price: number }> = {
  pp1: { id: "pp1", title: "Toán 12 — Siêu Ôn Luyện THPT Quốc Gia",     price: 299000 },
  pp2: { id: "pp2", title: "Vật Lý 12 — Điện xoay chiều & Sóng",          price: 199000 },
  pp3: { id: "pp3", title: "Hóa Học 12 — Lý thuyết & Bài tập nâng cao",   price: 349000 },
  pp4: { id: "pp4", title: "Tiếng Anh 12 — Ngữ pháp & Từ vựng",           price: 149000 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Mock tuition invoices
// ─────────────────────────────────────────────────────────────────────────────

type InvoiceStatus = "pending" | "pending_verification" | "paid";

interface Invoice {
  id: string;
  title: string;
  amount: number;
  due_date: string;
  status: InvoiceStatus;
  paid_at?: string;
}

const MOCK_INVOICES: Invoice[] = [
  { id: "INV-2025-05-01", title: "Học phí Toán cao cấp - Tháng 5",  amount: 1500000, due_date: "2025-05-15", status: "pending" },
  { id: "INV-2025-05-02", title: "Tài liệu Vật lý đại cương",         amount: 350000,  due_date: "2025-05-20", status: "pending" },
  { id: "INV-2025-04-01", title: "Học phí Toán cao cấp - Tháng 4",  amount: 1500000, due_date: "2025-04-15", status: "paid", paid_at: "2025-04-12" },
  { id: "INV-2025-03-01", title: "Học phí Toán cao cấp - Tháng 3",  amount: 1500000, due_date: "2025-03-15", status: "paid", paid_at: "2025-03-14" },
];

const STUDENT = { id: "s1", name: "Nguyễn Anh Tuấn", email: "tuan.nva@gmail.com" };

const formatVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

// ─────────────────────────────────────────────────────────────────────────────
// Modal target
// ─────────────────────────────────────────────────────────────────────────────

type ModalTarget =
  | { kind: "invoice"; invoice: Invoice }
  | { kind: "package"; pkgId: string; title: string; amount: number };

// ─────────────────────────────────────────────────────────────────────────────
// Inner component (needs Suspense for useSearchParams)
// ─────────────────────────────────────────────────────────────────────────────

function PaymentsContent() {
  const params = useSearchParams();
  const pkgParam = params.get("pkg");

  const [invoices, setInvoices] = useState<Invoice[]>(MOCK_INVOICES);
  const [pkgTransactions, setPkgTransactions] = useState<PurchaseTransaction[]>([]);
  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPkgTransactions(getTransactions());
    if (pkgParam && PACKAGES[pkgParam]) {
      const pkg = PACKAGES[pkgParam];
      setModalTarget({ kind: "package", pkgId: pkg.id, title: pkg.title, amount: pkg.price });
    }
  }, [pkgParam]);

  const reload = () => setPkgTransactions(getTransactions());

  const closeModal = () => {
    setModalTarget(null);
    setReceiptFile(null);
  };

  const handleConfirm = async () => {
    if (!modalTarget || !receiptFile) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 600));

    if (modalTarget.kind === "invoice") {
      const targetId = modalTarget.invoice.id;
      setInvoices(prev =>
        prev.map(i =>
          (targetId === "ALL" ? i.status === "pending" : i.id === targetId)
            ? { ...i, status: "pending_verification" as InvoiceStatus }
            : i
        )
      );
    } else {
      const note = `TUTORHUB ${modalTarget.pkgId.toUpperCase()} ${STUDENT.id}`;
      createTransaction({
        pkg_id:        modalTarget.pkgId,
        pkg_title:     modalTarget.title,
        amount:        modalTarget.amount,
        student_id:    STUDENT.id,
        student_name:  STUDENT.name,
        student_email: STUDENT.email,
        transfer_note: note,
      });
      reload();
    }

    setSubmitting(false);
    closeModal();
  };

  const pendingInvoices = invoices.filter(i => i.status === "pending");
  const totalPending    = pendingInvoices.reduce((s, i) => s + i.amount, 0);
  const invoiceHistory  = invoices.filter(i => i.status !== "pending");
  const pendingPkgTxs   = pkgTransactions.filter(t => t.status === "pending");

  const modalTitle = modalTarget?.kind === "invoice" ? modalTarget.invoice.title : (modalTarget?.title ?? "");
  const modalAmt   = modalTarget?.kind === "invoice" ? modalTarget.invoice.amount : (modalTarget?.amount ?? 0);
  const modalId    = modalTarget?.kind === "invoice" ? modalTarget.invoice.id : (modalTarget?.pkgId ?? "");
  const transferNote = modalTarget?.kind === "package"
    ? `TUTORHUB ${modalTarget.pkgId.toUpperCase()} ${STUDENT.id}`
    : `TT ${modalId} ${STUDENT.name.toUpperCase().replace(/ /g, "")}`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <SectionHeader title="Quản lý Học phí" subtitle="Xem hóa đơn và thanh toán trực tuyến" />

      {pendingPkgTxs.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
          <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {pendingPkgTxs.length} giao dịch mua tài liệu đang chờ xác nhận
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Admin sẽ xác nhận trong 1–4 giờ. Bạn sẽ nhận thông báo khi được duyệt.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Hero card */}
          <Card className="overflow-hidden border-0 shadow-lg relative animate-fade-in">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800" />
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <DollarSign className="w-32 h-32" />
            </div>
            <CardContent className="p-8 relative z-10 text-white">
              <p className="text-indigo-100 font-medium mb-1">Tổng học phí cần thanh toán</p>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">{formatVND(totalPending)}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="bg-white text-indigo-600 hover:bg-indigo-50 border-0 font-bold px-8 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:-translate-y-0.5 transition-all"
                  disabled={totalPending === 0}
                  onClick={() => setModalTarget({
                    kind: "invoice",
                    invoice: { id: "ALL", title: "Thanh toán tất cả hóa đơn", amount: totalPending, due_date: "", status: "pending" },
                  })}
                >
                  <CreditCard className="h-5 w-5 mr-2" /> Thanh toán tất cả
                </Button>
                <Button size="lg" className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md hover:-translate-y-0.5 transition-all">
                  <Receipt className="h-5 w-5 mr-2" /> Xem chính sách
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Pending invoices */}
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" /> Cần thanh toán
            </h3>
            {pendingInvoices.length > 0 ? (
              <div className="space-y-3">
                {pendingInvoices.map(inv => (
                  <Card key={inv.id} className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{inv.id}</span>
                          <Badge variant="warning" className="text-[10px] uppercase">Chưa thanh toán</Badge>
                        </div>
                        <h4 className="font-semibold text-foreground">{inv.title}</h4>
                        <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" /> Hạn chót: {inv.due_date}
                        </p>
                      </div>
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0 border-t border-border sm:border-0 pt-4 sm:pt-0">
                        <span className="text-lg font-bold">{formatVND(inv.amount)}</span>
                        <Button size="sm" variant="gradient" className="w-full sm:w-auto"
                          onClick={() => setModalTarget({ kind: "invoice", invoice: inv })}>
                          Thanh toán <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-muted/50 border-dashed">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-3 opacity-50" />
                  <p>Bạn đã hoàn tất mọi khoản học phí. Tuyệt vời!</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6 animate-fade-in">
          <Card>
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Phương thức hỗ trợ
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {[
                { bg: "#005BAA", label: "VNPay", name: "Cổng thanh toán VNPay" },
                { bg: "#A50064", label: "MoMo",  name: "Ví điện tử MoMo" },
                { bg: "",        label: "BANK",  name: "Chuyển khoản Ngân hàng" },
              ].map(m => (
                <div key={m.label} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                  <div
                    className={`h-8 w-12 rounded flex items-center justify-center text-xs font-bold shrink-0 ${m.bg ? "text-white" : "bg-muted text-foreground"}`}
                    style={m.bg ? { background: m.bg } : undefined}
                  >
                    {m.label}
                  </div>
                  <span className="text-sm font-medium">{m.name}</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground text-center mt-2">
                Giao dịch được mã hóa và bảo mật an toàn 100%.
              </p>
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" /> Lịch sử thanh toán
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {pkgTransactions.map(tx => (
                  <div key={tx.id} className="p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                      tx.status === "approved" ? "bg-emerald-100 dark:bg-emerald-900/30"
                      : tx.status === "rejected" ? "bg-red-100 dark:bg-red-900/30"
                      : "bg-amber-100 dark:bg-amber-900/30"
                    }`}>
                      {tx.status === "approved"
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        : tx.status === "rejected"
                          ? <X className="h-5 w-5 text-red-500" />
                          : <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <BookMarked className="h-3 w-3 text-violet-500 shrink-0" />
                        <p className="text-sm font-medium text-foreground truncate">{tx.pkg_title}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDateTime(tx.created_at)} ·{" "}
                        {tx.status === "approved" ? "Đã xác nhận"
                          : tx.status === "rejected" ? "Bị từ chối"
                          : "Chờ xác nhận"}
                      </p>
                    </div>
                    <span className="text-sm font-bold shrink-0">{formatVND(tx.amount)}</span>
                  </div>
                ))}

                {invoiceHistory.map(inv => {
                  const isPending = inv.status === "pending_verification";
                  return (
                    <div key={inv.id} className="p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isPending ? "bg-amber-100 dark:bg-amber-900/30" : "bg-emerald-100 dark:bg-emerald-900/30"}`}>
                        {isPending
                          ? <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          : <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{inv.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {isPending ? "Đang chờ duyệt" : inv.paid_at} · {inv.id}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold">{formatVND(inv.amount)}</span>
                        {isPending && <p className="text-[10px] text-amber-600 font-medium">Chờ xác nhận</p>}
                      </div>
                    </div>
                  );
                })}

                {invoiceHistory.length === 0 && pkgTransactions.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">Chưa có giao dịch nào</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── QR Payment modal ── */}
      {modalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[90vh]">

            <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                {modalTarget.kind === "package" ? "Mua tài liệu" : "Thanh toán học phí"}
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={closeModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="w-full text-center space-y-1 bg-primary/5 p-4 rounded-xl border border-primary/20">
                <p className="text-sm text-muted-foreground">Số tiền cần thanh toán:</p>
                <p className="text-3xl font-black text-primary">{formatVND(modalAmt)}</p>
                <p className="text-xs font-medium text-foreground mt-2 px-4 line-clamp-2">{modalTitle}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-6 w-full items-center sm:items-start">
                <div className="p-3 bg-white rounded-2xl shadow-sm border border-border shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.vietqr.io/image/970423-12604051999-compact.png?amount=${modalAmt}&addInfo=${encodeURIComponent(transferNote)}&accountName=LE%20HUY%20HOANG`}
                    alt="QR Code Thanh Toán"
                    className="w-40 h-40 object-contain"
                  />
                </div>

                <div className="flex-1 w-full bg-muted/30 p-3 rounded-xl border border-border/50 space-y-2">
                  <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Thông tin người nhận</p>
                  {[
                    { label: "Ngân hàng",     value: "TPBank" },
                    { label: "Số tài khoản",  value: "12604051999" },
                    { label: "Chủ tài khoản", value: "LE HUY HOANG" },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center border-b border-border/50 pb-1.5 last:border-0 last:pb-0">
                      <span className="text-xs text-muted-foreground">{row.label}:</span>
                      <span className="text-sm font-semibold">{row.value}</span>
                    </div>
                  ))}
                  <div className="flex flex-col gap-1 pt-1">
                    <span className="text-xs text-muted-foreground">Nội dung (Bắt buộc):</span>
                    <span className="text-sm font-bold text-primary bg-primary/10 px-2 py-1 rounded select-all font-mono text-center">
                      {transferNote}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full space-y-2 pt-2 border-t border-border/50">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <UploadCloud className="h-4 w-4 text-primary" />
                  Tải lên biên lai giao dịch <span className="text-red-500">*</span>
                </p>
                <div className="border-2 border-dashed border-border/60 rounded-xl p-4 text-center hover:bg-muted/30 transition-colors relative cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
                  />
                  {receiptFile ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="text-sm font-medium">{receiptFile.name}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <UploadCloud className="h-8 w-8 mb-1 opacity-50" />
                      <span className="text-sm font-medium">Bấm hoặc kéo thả ảnh biên lai vào đây</span>
                      <span className="text-xs">JPG, PNG, PDF</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 text-xs text-amber-700 bg-amber-50 p-4 rounded-xl border border-amber-200/50 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Lưu ý:</strong> Nhập đúng nội dung chuyển khoản để hệ thống xác nhận nhanh hơn.
                  Admin sẽ đối soát trong vòng 1–4 giờ (giờ hành chính).
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-border/50 bg-muted/10 flex gap-3 shrink-0">
              <Button variant="outline" className="flex-1" onClick={closeModal}>Hủy bỏ</Button>
              <Button className="flex-1" disabled={!receiptFile || submitting} onClick={handleConfirm}>
                {submitting ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full inline-block mr-2" />
                    Đang gửi...
                  </>
                ) : "Tôi đã chuyển khoản"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudentPaymentsPage() {
  return (
    <PortalLayout role="student" userName="Nguyễn Anh Tuấn" pageTitle="Thanh toán">
      <Suspense fallback={<div className="py-20 text-center text-sm text-muted-foreground">Đang tải...</div>}>
        <PaymentsContent />
      </Suspense>
    </PortalLayout>
  );
}
