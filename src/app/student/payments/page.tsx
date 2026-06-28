"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared";
import { DollarSign, CreditCard, Receipt, Clock, CheckCircle2, AlertCircle, ArrowRight, X, QrCode, UploadCloud } from "lucide-react";
import { useState } from "react";

const MOCK_INVOICES = [
  { id: "INV-2025-05-01", title: "Học phí Toán cao cấp - Tháng 5", amount: 1500000, due_date: "2025-05-15", status: "pending" },
  { id: "INV-2025-05-02", title: "Tài liệu Vật lý đại cương", amount: 350000, due_date: "2025-05-20", status: "pending" },
  { id: "INV-2025-04-01", title: "Học phí Toán cao cấp - Tháng 4", amount: 1500000, due_date: "2025-04-15", status: "paid", paid_at: "2025-04-12" },
  { id: "INV-2025-03-01", title: "Học phí Toán cao cấp - Tháng 3", amount: 1500000, due_date: "2025-03-15", status: "paid", paid_at: "2025-03-14" },
];

export default function StudentPaymentsPage() {
  const [invoices, setInvoices] = useState(MOCK_INVOICES);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const pendingInvoices = invoices.filter(inv => inv.status === "pending");
  const paidInvoices = invoices.filter(inv => inv.status === "paid" || inv.status === "pending_verification");
  const totalPending = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const handleCloseModal = () => {
    setSelectedInvoice(null);
    setReceiptFile(null);
  };

  const handleConfirmTransfer = () => {
    if (!selectedInvoice || !receiptFile) return;
    
    if (selectedInvoice.id === "ALL") {
      setInvoices(prev => prev.map(inv => 
        inv.status === "pending" ? { ...inv, status: "pending_verification" } : inv
      ));
    } else {
      setInvoices(prev => prev.map(inv => 
        inv.id === selectedInvoice.id ? { ...inv, status: "pending_verification" } : inv
      ));
    }
    
    handleCloseModal();
  };

  return (
    <PortalLayout role="student" userName="Nguyễn Anh Tuấn" pageTitle="Thanh toán">
      <div className="space-y-6 max-w-5xl mx-auto">
        <SectionHeader title="Quản lý Học phí" subtitle="Xem hóa đơn và thanh toán trực tuyến" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="overflow-hidden border-0 shadow-lg relative animate-fade-in">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800" />
              <div className="absolute top-0 right-0 p-8 opacity-10"><DollarSign className="w-32 h-32" /></div>
              <CardContent className="p-8 relative z-10 text-white">
                <p className="text-indigo-100 font-medium mb-1">Tổng học phí cần thanh toán</p>
                <div className="flex items-end gap-4 mb-6">
                  <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">{formatVND(totalPending)}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50 border-0 font-bold px-8 shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] hover:-translate-y-0.5" onClick={() => {
                    if (totalPending > 0) {
                      setSelectedInvoice({ id: "ALL", title: "Thanh toán tất cả hóa đơn", amount: totalPending });
                    }
                  }}>
                    <CreditCard className="h-5 w-5 mr-2" /> Thanh toán tất cả
                  </Button>
                  <Button size="lg" className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md transition-all hover:-translate-y-0.5">
                    <Receipt className="h-5 w-5 mr-2" /> Xem chính sách
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4 animate-fade-in delay-100">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" /> Cần thanh toán
              </h3>
              {pendingInvoices.length > 0 ? (
                <div className="space-y-3">
                  {pendingInvoices.map((invoice) => (
                    <Card key={invoice.id} className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
                      <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{invoice.id}</span>
                            <Badge variant="warning" className="text-[10px] uppercase">Chưa thanh toán</Badge>
                          </div>
                          <h4 className="font-semibold text-foreground text-base">{invoice.title}</h4>
                          <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" /> Hạn chót: {invoice.due_date}
                          </p>
                        </div>
                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0 border-t border-border sm:border-0 pt-4 sm:pt-0">
                          <span className="text-lg font-bold text-foreground">{formatVND(invoice.amount)}</span>
                          <Button size="sm" variant="gradient" className="w-full sm:w-auto" onClick={() => setSelectedInvoice(invoice)}>
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

          <div className="space-y-6 animate-fade-in delay-200">
            <Card>
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" /> Phương thức hỗ trợ
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                  <div className="h-8 w-12 bg-[#005BAA] rounded flex items-center justify-center text-white font-bold text-[10px]">VNPay</div>
                  <span className="text-sm font-medium">Cổng thanh toán VNPay</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                  <div className="h-8 w-12 bg-[#A50064] rounded flex items-center justify-center text-white font-bold text-[10px]">MoMo</div>
                  <span className="text-sm font-medium">Ví điện tử MoMo</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                  <div className="h-8 w-12 bg-muted rounded flex items-center justify-center text-foreground font-bold text-[10px]">BANK</div>
                  <span className="text-sm font-medium">Chuyển khoản Ngân hàng</span>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Giao dịch được mã hóa và bảo mật an toàn 100%.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" /> Lịch sử thanh toán
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {paidInvoices.map((invoice) => {
                    const isPending = invoice.status === "pending_verification";
                    
                    return (
                    <div key={invoice.id} className="p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isPending ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                        {isPending ? <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{invoice.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {isPending ? 'Đang chờ duyệt' : invoice.paid_at} · {invoice.id}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-foreground">{formatVND(invoice.amount)}</span>
                        {isPending && <p className="text-[10px] text-amber-600 font-medium">Chờ xác nhận</p>}
                      </div>
                    </div>
                  )})}
                </div>
                <div className="p-3 border-t border-border/50 text-center">
                  <Button variant="link" className="text-xs text-primary h-auto p-0">
                    Xem toàn bộ lịch sử &rarr;
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-slide-up border border-border flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" /> Thanh toán qua mã QR
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleCloseModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-6 space-y-6 flex-col items-center overflow-y-auto">
              <div className="w-full text-center space-y-1 bg-primary/5 p-4 rounded-xl border border-primary/20">
                <p className="text-sm text-muted-foreground">Số tiền cần thanh toán:</p>
                <p className="text-3xl font-black text-primary">{formatVND(selectedInvoice.amount)}</p>
                <p className="text-xs font-medium text-foreground mt-2 px-4">{selectedInvoice.title}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-6 w-full items-center sm:items-start">
                <div className="p-3 bg-white rounded-2xl shadow-sm border border-border shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={`https://img.vietqr.io/image/970423-12604051999-compact.png?amount=${selectedInvoice.amount}&addInfo=${encodeURIComponent(`TT ${selectedInvoice.id} NGUYEN ANH TUAN`)}&accountName=LE%20HUY%20HOANG`}
                    alt="QR Code Thanh Toán" 
                    className="w-40 h-40 object-contain"
                  />
                </div>
                
                <div className="flex-1 space-y-3 w-full">
                  <div className="bg-muted/30 p-3 rounded-xl border border-border/50 space-y-2">
                    <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Thông tin người nhận</p>
                    <div className="flex justify-between items-center border-b border-border/50 pb-1.5">
                      <span className="text-xs text-muted-foreground">Ngân hàng:</span>
                      <span className="text-sm font-semibold">TPBank</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-border/50 pb-1.5">
                      <span className="text-xs text-muted-foreground">Số tài khoản:</span>
                      <span className="text-sm font-semibold font-mono">12604051999</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-border/50 pb-1.5">
                      <span className="text-xs text-muted-foreground">Chủ tài khoản:</span>
                      <span className="text-sm font-semibold uppercase">LE HUY HOANG</span>
                    </div>
                    <div className="flex flex-col gap-1 pt-1">
                      <span className="text-xs text-muted-foreground">Nội dung (Bắt buộc):</span>
                      <span className="text-sm font-bold text-primary bg-primary/10 px-2 py-1 rounded select-all font-mono text-center">
                        TT {selectedInvoice.id} NGUYEN ANH TUAN
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full space-y-2 pt-2 border-t border-border/50">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <UploadCloud className="h-4 w-4 text-primary" /> Tải lên biên lai giao dịch <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed border-border/60 rounded-xl p-4 text-center hover:bg-muted/30 transition-colors relative">
                  <input 
                    type="file" 
                    accept="image/*,.pdf" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
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
                      <span className="text-xs">Định dạng hỗ trợ: JPG, PNG, PDF</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 text-sm text-amber-700 bg-amber-50 p-4 rounded-xl border border-amber-200/50 w-full dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="leading-relaxed text-xs">
                  <strong>Lưu ý quan trọng:</strong> Sau khi chuyển khoản thành công, vui lòng tải biên lai lên và nhấn xác nhận. Admin sẽ đối soát giao dịch trong vòng 24h.
                </p>
              </div>
            </div>
            
            <div className="p-4 border-t border-border/50 bg-muted/10 flex flex-col sm:flex-row gap-3 shrink-0">
              <Button variant="outline" className="flex-1" onClick={handleCloseModal}>
                Hủy bỏ
              </Button>
              <Button 
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md" 
                onClick={handleConfirmTransfer}
                disabled={!receiptFile}
              >
                Tôi đã chuyển khoản
              </Button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
