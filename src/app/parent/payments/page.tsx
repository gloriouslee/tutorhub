"use client";

import { useState, useEffect } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared";
import {
  getInvoices, updateInvoiceStatus, type TuitionInvoice,
} from "@/lib/storage";
import { useParentContext } from "@/hooks/useParentContext";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign, CreditCard, Clock, CheckCircle2,
  AlertCircle, ArrowRight, X, QrCode, UploadCloud, Users,
} from "lucide-react";

export default function ParentPaymentsPage() {
  const { parentName, children, ready } = useParentContext();
  const childIds = children.map(c => c.id);

  const [invoices,     setInvoices]     = useState<TuitionInvoice[]>([]);
  const [modalInvoice, setModalInvoice] = useState<TuitionInvoice | null>(null);
  const [receiptFile,  setReceiptFile]  = useState<File | null>(null);
  const [submitting,   setSubmitting]   = useState(false);

  const load = async () => setInvoices((await getInvoices()).filter(inv => childIds.includes(inv.child_id)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready) load(); }, [ready]);

  const getChildName = (id: string) => children.find(c => c.id === id)?.name ?? "Học viên";

  const pendingInvoices = invoices.filter(i => i.status === "pending");
  const otherInvoices   = invoices.filter(i => i.status !== "pending");
  const totalPending    = pendingInvoices.reduce((s, i) => s + i.amount, 0);

  // invoices already submitted by student
  const studentSubmitted = invoices.filter(i => i.status === "pending_verification" && i.submitted_by === "student");

  const openModal = (inv: TuitionInvoice) => {
    setModalInvoice(inv);
    setReceiptFile(null);
  };

  const openPayAll = () => {
    if (totalPending === 0) return;
    setModalInvoice({
      id: "ALL",
      child_id: "ALL",
      title: "Thanh toán gộp tất cả hóa đơn",
      amount: totalPending,
      due_date: "",
      status: "pending",
    });
    setReceiptFile(null);
  };

  const closeModal = () => {
    setModalInvoice(null);
    setReceiptFile(null);
  };

  const handleConfirm = async () => {
    if (!modalInvoice || !receiptFile) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 600));
    if (modalInvoice.id === "ALL") {
      // Chỉ đụng hóa đơn của các con mình — gọi theo từng child id
      for (const cid of childIds) {
        await updateInvoiceStatus("ALL", "pending_verification", "parent", cid);
      }
    } else {
      await updateInvoiceStatus(modalInvoice.id, "pending_verification", "parent");
    }
    await load();
    setSubmitting(false);
    closeModal();
  };

  const transferNote = modalInvoice
    ? `PH THANH TOAN ${modalInvoice.id}`
    : "";

  return (
    <PortalLayout role="parent" userName={parentName} pageTitle="Thanh toán">
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        <SectionHeader
          title="Thanh toán Học phí"
          subtitle="Quản lý và thanh toán học phí cho các con một cách tiện lợi, an toàn."
        />

        {/* Banner: student already submitted */}
        {studentSubmitted.length > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                Học viên đã nộp biên lai cho {studentSubmitted.length} hóa đơn
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                Đang chờ admin xác nhận — bạn không cần thanh toán lại.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            {/* Hero card */}
            <Card className="overflow-hidden border-0 shadow-lg relative animate-fade-in group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-500">
                <DollarSign className="w-40 h-40" />
              </div>
              <CardContent className="p-8 relative z-10 text-white">
                <p className="text-indigo-100 font-medium mb-1">Tổng học phí cần thanh toán</p>
                <h2 className="text-4xl sm:text-5xl font-black tracking-tight drop-shadow-sm mb-6">
                  {formatCurrency(totalPending)}
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    className="bg-white text-indigo-600 hover:bg-indigo-50 border-0 font-bold px-8 shadow-[0_4px_20px_rgba(255,255,255,0.3)] hover:-translate-y-1 transition-all rounded-xl"
                    disabled={totalPending === 0}
                    onClick={openPayAll}
                  >
                    <CreditCard className="h-5 w-5 mr-2" /> Thanh toán gộp tất cả
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Pending invoices */}
            <div className="space-y-4 animate-fade-in delay-100">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" /> Cần thanh toán
              </h3>
              {pendingInvoices.length > 0 ? (
                <div className="space-y-3">
                  {pendingInvoices.map(inv => (
                    <Card key={inv.id} className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow group">
                      <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:from-amber-50/50 dark:hover:from-amber-950/20">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{inv.id}</span>
                            <Badge variant="warning" className="text-[10px] uppercase font-bold">Chưa thanh toán</Badge>
                            <span className="flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                              <Users className="h-3 w-3" /> {getChildName(inv.child_id)}
                            </span>
                          </div>
                          <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">{inv.title}</h4>
                          <p className="text-sm text-amber-600 dark:text-amber-500 mt-1.5 flex items-center gap-1.5 font-medium">
                            <Clock className="h-4 w-4" /> Hạn chót: {new Date(inv.due_date).toLocaleDateString("vi-VN")}
                          </p>
                        </div>
                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0 border-t border-border sm:border-0 pt-4 sm:pt-0">
                          <span className="text-xl font-black">{formatCurrency(inv.amount)}</span>
                          <Button size="sm" variant="gradient" className="w-full sm:w-auto font-bold" onClick={() => openModal(inv)}>
                            Thanh toán <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-muted/50 border-dashed border-2">
                  <CardContent className="p-10 text-center text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-4 opacity-80" />
                    <p className="font-medium text-lg text-foreground">Bạn đã hoàn tất mọi khoản học phí.</p>
                    <p className="text-sm mt-1">Cảm ơn sự đồng hành của bạn cùng TutorHub!</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* History */}
            {otherInvoices.length > 0 && (
              <div className="space-y-4 animate-fade-in delay-200">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Giao dịch gần đây
                </h3>
                <Card className="border border-border/50 shadow-sm overflow-hidden">
                  <div className="divide-y divide-border/50">
                    {otherInvoices.map(inv => {
                      const isPending = inv.status === "pending_verification";
                      const byStudent = inv.submitted_by === "student";
                      return (
                        <div key={inv.id} className="p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isPending ? "bg-amber-100 dark:bg-amber-900/30" : "bg-emerald-100 dark:bg-emerald-900/30"}`}>
                            {isPending
                              ? <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                              : <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">{inv.title}</p>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                              <span>Mã: {inv.id}</span>
                              <span className="font-medium text-primary">{getChildName(inv.child_id)}</span>
                              {isPending && byStudent && (
                                <span className="text-emerald-600 font-semibold">· Học viên đã nộp biên lai</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-sm">{formatCurrency(inv.amount)}</p>
                            {isPending
                              ? <p className="text-[10px] text-amber-600 font-medium mt-0.5">Chờ xác nhận</p>
                              : <Badge variant="outline" className="mt-1 text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800">Đã thanh toán</Badge>
                            }
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-6 animate-fade-in delay-300">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                <CardTitle className="text-base flex items-center gap-2 font-bold">
                  <CreditCard className="h-4 w-4 text-primary" /> Phương thức hỗ trợ
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5 hover:border-primary/50 transition-colors">
                  <div className="h-10 w-14 rounded-lg flex items-center justify-center text-xs font-black shadow-inner shrink-0 bg-slate-800 text-white">
                    BANK
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Chuyển khoản Ngân hàng</p>
                    <p className="text-[11px] text-muted-foreground">TPBank · VietQR</p>
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl mt-2 border border-blue-100 dark:border-blue-900/50">
                  <p className="text-xs text-blue-700 dark:text-blue-400 font-medium text-center leading-relaxed">
                    Hiện tại chỉ hỗ trợ chuyển khoản ngân hàng. Quét mã QR hoặc chuyển thủ công.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-500 font-bold">
                  <AlertCircle className="h-4 w-4" /> Chính sách thanh toán
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <ul className="text-sm text-foreground/80 space-y-3 font-medium">
                  <li className="flex gap-2"><span className="text-amber-500 mt-0.5">•</span><span>Học phí cần hoàn tất trước ngày 15 hàng tháng.</span></li>
                  <li className="flex gap-2"><span className="text-amber-500 mt-0.5">•</span><span>Gia đình có từ 2 bé theo học được giảm 15% tổng hóa đơn.</span></li>
                  <li className="flex gap-2"><span className="text-amber-500 mt-0.5">•</span><span>Chỉ cần <strong>một trong hai</strong> — phụ huynh hoặc học viên — nộp biên lai là đủ.</span></li>
                  <li className="flex gap-2"><span className="text-amber-500 mt-0.5">•</span><span>Cần xuất hóa đơn VAT, vui lòng liên hệ Ban Giáo vụ sau khi thanh toán.</span></li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* QR Payment Modal */}
      {modalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[90vh]">

            <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" /> Thanh toán học phí
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={closeModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Amount */}
              <div className="w-full text-center bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-1">
                <p className="text-sm text-muted-foreground">Số tiền cần thanh toán:</p>
                <p className="text-3xl font-black text-primary">{formatCurrency(modalInvoice.amount)}</p>
                <p className="text-xs font-medium text-foreground px-4 line-clamp-2">{modalInvoice.title}</p>
                {modalInvoice.child_id !== "ALL" && (
                  <p className="text-xs text-primary font-semibold flex items-center justify-center gap-1">
                    <Users className="h-3 w-3" /> {getChildName(modalInvoice.child_id)}
                  </p>
                )}
              </div>

              {/* QR + bank info */}
              <div className="flex flex-col sm:flex-row gap-4 w-full items-center sm:items-start">
                <div className="p-3 bg-white rounded-2xl shadow-sm border border-border shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.vietqr.io/image/970423-12604051999-compact.png?amount=${modalInvoice.amount}&addInfo=${encodeURIComponent(transferNote)}&accountName=LE%20HUY%20HOANG`}
                    alt="VietQR"
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

              {/* Upload receipt */}
              <div className="space-y-2 border-t border-border/50 pt-4">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <UploadCloud className="h-4 w-4 text-primary" />
                  Tải lên biên lai giao dịch <span className="text-red-500">*</span>
                </p>
                <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-colors relative ${receiptFile ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
                  />
                  {receiptFile ? (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="text-sm font-medium">{receiptFile.name}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <UploadCloud className="h-7 w-7 mb-1 opacity-50" />
                      <span className="text-sm font-medium"><span className="text-primary font-semibold">Bấm để chọn</span> hoặc kéo thả ảnh</span>
                      <span className="text-xs">JPG, PNG, PDF (tối đa 5MB)</span>
                    </div>
                  )}
                </label>
              </div>

              <div className="flex gap-3 text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200/50 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Lưu ý:</strong> Nếu học viên đã thanh toán rồi, bạn không cần nộp lại. Admin sẽ đối soát trong vòng 1–4 giờ.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-border/50 bg-muted/10 flex gap-3 shrink-0">
              <Button variant="outline" className="flex-1" onClick={closeModal}>Hủy bỏ</Button>
              <Button
                className="flex-1" variant="gradient"
                disabled={!receiptFile || submitting}
                onClick={handleConfirm}
              >
                {submitting ? (
                  <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full inline-block mr-2" />Đang gửi...</>
                ) : "Tôi đã chuyển khoản"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
