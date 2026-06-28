"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared";
import { DollarSign, CreditCard, Receipt, Clock, CheckCircle2, AlertCircle, ArrowRight, X, QrCode, UploadCloud, Users } from "lucide-react";
import { useState } from "react";
import { MOCK_STUDENTS } from "@/lib/mock-data";

// Generate some mock invoices specifically for parent "p1"
const PARENT_INVOICES = [
  { id: "INV-2025-05-01", child_id: "s1", title: "Học phí Toán cao cấp - Tháng 5", amount: 1500000, due_date: "2025-05-15", status: "pending" },
  { id: "INV-2025-05-02", child_id: "s1", title: "Tài liệu ôn thi cuối kỳ", amount: 350000, due_date: "2025-05-20", status: "pending" },
  { id: "INV-2025-05-03", child_id: "s4", title: "Học phí Hóa học cơ bản - Tháng 5", amount: 1200000, due_date: "2025-05-15", status: "pending" },
  { id: "INV-2025-04-01", child_id: "s1", title: "Học phí Toán cao cấp - Tháng 4", amount: 1500000, due_date: "2025-04-15", status: "paid", paid_at: "2025-04-12" },
  { id: "INV-2025-04-02", child_id: "s4", title: "Học phí Hóa học cơ bản - Tháng 4", amount: 1200000, due_date: "2025-04-15", status: "paid", paid_at: "2025-04-13" },
];

export default function ParentPaymentsPage() {
  const [invoices, setInvoices] = useState(PARENT_INVOICES);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const children = MOCK_STUDENTS.filter(s => s.parent_id === "p1");
  const getChildName = (id: string) => children.find(c => c.id === id)?.full_name || "Học viên";
  
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
    <PortalLayout role="parent" userName="Trần Văn Minh" pageTitle="Thanh toán">
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        <SectionHeader 
          title="Thanh toán Học phí" 
          subtitle="Quản lý và thanh toán học phí cho các con một cách tiện lợi, an toàn." 
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Main Total Card */}
            <Card className="overflow-hidden border-0 shadow-lg relative animate-fade-in group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute top-0 right-0 p-8 opacity-10 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
                <DollarSign className="w-40 h-40" />
              </div>
              <CardContent className="p-8 relative z-10 text-white">
                <p className="text-indigo-100 font-medium mb-1">Tổng học phí cần thanh toán</p>
                <div className="flex items-end gap-4 mb-6">
                  <h2 className="text-4xl sm:text-5xl font-black tracking-tight drop-shadow-sm">{formatVND(totalPending)}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-8">
                  <Button 
                    size="lg" 
                    className="bg-white text-indigo-600 hover:bg-indigo-50 border-0 font-bold px-8 shadow-[0_4px_20px_rgba(255,255,255,0.3)] transition-all hover:shadow-[0_8px_30px_rgba(255,255,255,0.4)] hover:-translate-y-1 rounded-xl" 
                    onClick={() => {
                      if (totalPending > 0) {
                        setSelectedInvoice({ id: "ALL", title: "Thanh toán gộp tất cả hóa đơn", amount: totalPending });
                      }
                    }}
                  >
                    <CreditCard className="h-5 w-5 mr-2" /> Thanh toán gộp tất cả
                  </Button>
                  <Button size="lg" className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md transition-all hover:-translate-y-1 rounded-xl">
                    <Receipt className="h-5 w-5 mr-2" /> Lịch sử thanh toán
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Pending Invoices List */}
            <div className="space-y-4 animate-fade-in delay-100">
              <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                <AlertCircle className="h-5 w-5 text-amber-500" /> Cần thanh toán
              </h3>
              
              {pendingInvoices.length > 0 ? (
                <div className="space-y-4">
                  {pendingInvoices.map((invoice) => (
                    <Card key={invoice.id} className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow border-t-0 border-r-0 border-b-0 group">
                      <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-card to-card hover:from-amber-50/50 dark:hover:from-amber-950/20">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{invoice.id}</span>
                            <Badge variant="warning" className="text-[10px] uppercase font-bold">Chưa thanh toán</Badge>
                            <span className="flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                              <Users className="h-3 w-3" /> {getChildName(invoice.child_id)}
                            </span>
                          </div>
                          <h4 className="font-bold text-foreground text-base group-hover:text-primary transition-colors">{invoice.title}</h4>
                          <p className="text-sm text-amber-600 dark:text-amber-500 mt-1.5 flex items-center gap-1.5 font-medium">
                            <Clock className="h-4 w-4" /> Hạn chót: {new Date(invoice.due_date).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0 border-t border-border sm:border-0 pt-4 sm:pt-0">
                          <span className="text-xl font-black text-foreground">{formatVND(invoice.amount)}</span>
                          <Button size="sm" variant="gradient" className="w-full sm:w-auto font-bold rounded-lg shadow-sm" onClick={() => setSelectedInvoice(invoice)}>
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

            {/* Paid Invoices (History preview) */}
            {paidInvoices.length > 0 && (
              <div className="space-y-4 pt-4 animate-fade-in delay-200">
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Giao dịch gần đây
                </h3>
                <Card className="border border-border/50 shadow-sm overflow-hidden">
                  <div className="divide-y divide-border/50">
                    {paidInvoices.map(invoice => (
                      <div key={invoice.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div>
                          <p className="font-semibold text-sm text-foreground mb-1">{invoice.title}</p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span>Mã: {invoice.id}</span>
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              Học viên: {getChildName(invoice.child_id)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm text-foreground">{formatVND(invoice.amount)}</p>
                          <Badge variant="outline" className="mt-1 text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800">
                            Đã thanh toán
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 bg-muted/20 border-t border-border/50 text-center">
                    <Button variant="link" className="text-xs text-primary h-auto p-0 font-medium">Xem tất cả lịch sử</Button>
                  </div>
                </Card>
              </div>
            )}
          </div>

          {/* Right Sidebar Info */}
          <div className="space-y-6 animate-fade-in delay-300">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                <CardTitle className="text-base flex items-center gap-2 font-bold">
                  <CreditCard className="h-4 w-4 text-primary" /> Phương thức hỗ trợ
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors cursor-pointer">
                  <div className="h-10 w-14 bg-[#005BAA] rounded-lg flex items-center justify-center text-white font-black text-xs shadow-inner">VNPay</div>
                  <span className="text-sm font-semibold">Cổng thanh toán VNPay</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors cursor-pointer">
                  <div className="h-10 w-14 bg-[#A50064] rounded-lg flex items-center justify-center text-white font-black text-xs shadow-inner">MoMo</div>
                  <span className="text-sm font-semibold">Ví điện tử MoMo</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors cursor-pointer">
                  <div className="h-10 w-14 bg-slate-800 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-inner">BANK</div>
                  <span className="text-sm font-semibold">Chuyển khoản VietQR</span>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl mt-4 border border-blue-100 dark:border-blue-900/50">
                  <p className="text-xs text-blue-700 dark:text-blue-400 font-medium text-center leading-relaxed">
                    Tất cả giao dịch được mã hóa 256-bit và bảo mật an toàn tuyệt đối.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-100 dark:border-amber-900/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-500 font-bold">
                  <AlertCircle className="h-4 w-4" /> Chính sách thanh toán
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <ul className="text-sm text-foreground/80 space-y-3 font-medium">
                  <li className="flex gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <span>Học phí cần được hoàn tất thanh toán trước ngày 15 hàng tháng.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <span>Gia đình có từ 2 bé theo học sẽ được tự động giảm 15% vào tổng hóa đơn.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <span>Nếu cần xuất hóa đơn VAT, vui lòng liên hệ Ban Giáo vụ sau khi thanh toán.</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl shadow-2xl border-0 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold mb-1">Thanh toán hóa đơn</h3>
                <p className="text-indigo-100 text-sm font-medium">{selectedInvoice.title}</p>
              </div>
              <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 rounded-full h-8 w-8" onClick={handleCloseModal}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* QR Code Section */}
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="text-center w-full bg-muted/30 p-4 rounded-xl border border-border">
                    <p className="text-sm text-muted-foreground font-medium mb-1">Số tiền thanh toán</p>
                    <p className="text-3xl font-black text-primary">{formatVND(selectedInvoice.amount)}</p>
                  </div>
                  
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-border inline-block">
                    {/* Using the updated account number here just like in the student portal */}
                    <img 
                      src={`https://img.vietqr.io/image/MB-12604051999-print.png?amount=${selectedInvoice.amount}&addInfo=${encodeURIComponent(`PHU HUYNH THANH TOAN ${selectedInvoice.id}`)}`} 
                      alt="VietQR" 
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-bold flex items-center justify-center gap-1.5 text-foreground"><QrCode className="h-4 w-4" /> Quét mã để thanh toán</p>
                    <p className="text-xs text-muted-foreground font-medium">Hỗ trợ mọi ứng dụng ngân hàng và ví điện tử</p>
                  </div>
                </div>

                {/* Bank Details & Upload Section */}
                <div className="space-y-6 flex flex-col justify-center">
                  <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
                    <h4 className="text-sm font-bold mb-3 border-b border-border pb-2">Chuyển khoản thủ công</h4>
                    <div className="space-y-2.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ngân hàng:</span>
                        <span className="font-bold">MB Bank</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Số tài khoản:</span>
                        <span className="font-bold text-primary text-base">12604051999</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tên tài khoản:</span>
                        <span className="font-bold">TUTORHUB CENTER</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nội dung:</span>
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded font-bold">PH THANH TOAN {selectedInvoice.id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <UploadCloud className="h-4 w-4" /> Tải lên biên lai
                    </h4>
                    <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${receiptFile ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {receiptFile ? (
                          <>
                            <CheckCircle2 className="w-8 h-8 text-primary mb-2" />
                            <p className="text-sm font-bold text-primary">{receiptFile.name}</p>
                          </>
                        ) : (
                          <>
                            <UploadCloud className="w-8 h-8 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground font-medium"><span className="font-semibold text-primary">Nhấn để chọn</span> hoặc kéo thả ảnh</p>
                            <p className="text-xs text-muted-foreground mt-1">PNG, JPG (Tối đa 5MB)</p>
                          </>
                        )}
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                        if (e.target.files && e.target.files[0]) setReceiptFile(e.target.files[0]);
                      }} />
                    </label>
                  </div>

                  <Button 
                    className="w-full h-12 text-base font-bold shadow-md hover:shadow-lg transition-all" 
                    variant="gradient"
                    disabled={!receiptFile}
                    onClick={handleConfirmTransfer}
                  >
                    Xác nhận đã chuyển khoản
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PortalLayout>
  );
}
