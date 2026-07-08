"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaymentBadge, SectionHeader } from "@/components/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate, formatCurrency, toLocalDateKey } from "@/lib/utils";
import { DollarSign, AlertCircle, CheckCircle2, Plus, X, Receipt, RotateCcw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useState, useEffect } from "react";
import {
  getPayments, savePayments, getStudents,
  getInvoices, updateInvoiceStatus, type TuitionInvoice,
} from "@/lib/storage";
import { Payment, Student } from "@/types";
import { Input } from "@/components/ui/input";

// Hàng hiển thị hợp nhất: sổ học phí admin (Payment) + hóa đơn giáo viên phát
// hành / phụ huynh–học viên nộp biên lai (TuitionInvoice, kv "tutorhub_invoices").
interface LedgerRow {
  id: string;
  source: "payment" | "invoice";
  student_id: string;
  description: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: "paid" | "pending" | "overdue" | "pending_verification";
  submitted_by?: "student" | "parent";
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<TuitionInvoice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    student_id: "",
    amount: "",
    description: "Học phí tháng này",
    due_date: toLocalDateKey(new Date()),
  });

  useEffect(() => {
    async function loadData() {
      const [p, inv, s] = await Promise.all([
        getPayments(),
        getInvoices(),
        getStudents(),
      ]);
      setPayments(p);
      setInvoices(inv);
      setStudents(s);
    }
    loadData();
  }, []);

  const todayKey = toLocalDateKey(new Date());

  // Hợp nhất hai nguồn thành một sổ cái
  const rows: LedgerRow[] = [
    ...payments.map<LedgerRow>(p => ({
      id: p.id, source: "payment",
      student_id: p.student_id, description: p.description ?? "Học phí",
      amount: p.amount, due_date: p.due_date, paid_date: p.paid_date ?? null,
      status: p.payment_status === "paid" ? "paid"
        : (p.payment_status === "overdue" || p.due_date < todayKey) ? "overdue"
        : "pending",
    })),
    ...invoices.map<LedgerRow>(inv => ({
      id: inv.id, source: "invoice",
      student_id: inv.child_id, description: inv.title,
      amount: inv.amount, due_date: inv.due_date, paid_date: inv.paid_at ?? null,
      status: inv.status === "paid" ? "paid"
        : inv.status === "pending_verification" ? "pending_verification"
        : inv.due_date < todayKey ? "overdue"
        : "pending",
      submitted_by: inv.submitted_by,
    })),
  ].sort((a, b) => b.due_date.localeCompare(a.due_date));

  // Biên lai đang chờ admin xác nhận (phụ huynh/học viên đã nộp)
  const awaitingVerification = rows.filter(r => r.status === "pending_verification");

  const totalCollected = rows.filter(r => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  const totalPending = rows.filter(r => r.status === "pending" || r.status === "pending_verification").reduce((s, r) => s + r.amount, 0);
  const totalOverdue = rows.filter(r => r.status === "overdue").reduce((s, r) => s + r.amount, 0);

  // Last 5 calendar months of collected revenue — cả hai nguồn
  const monthlyData = Array.from({ length: 5 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (4 - i));
    const y = d.getFullYear();
    const m = d.getMonth();
    const collected = rows
      .filter(r => r.status === "paid")
      .filter(r => {
        const pd = new Date(r.paid_date || r.due_date);
        return pd.getFullYear() === y && pd.getMonth() === m;
      })
      .reduce((s, r) => s + r.amount, 0);
    return { month: `Th.${m + 1}`, collected };
  });

  const handleMarkPaid = async (row: LedgerRow) => {
    if (row.source === "payment") {
      const updated = payments.map(p =>
        p.id === row.id
          ? { ...p, payment_status: "paid" as const, paid_date: toLocalDateKey(new Date()) }
          : p
      );
      setPayments(updated);
      await savePayments(updated);
    } else {
      await updateInvoiceStatus(row.id, "paid", row.submitted_by ?? "parent");
      setInvoices(await getInvoices());
    }
  };

  // Từ chối biên lai — trả hóa đơn về trạng thái chờ thanh toán
  const handleRejectReceipt = async (row: LedgerRow) => {
    await updateInvoiceStatus(row.id, "pending", row.submitted_by ?? "parent");
    setInvoices(await getInvoices());
  };

  const handleOpenAddModal = () => {
    const defaultStudent = students[0]?.id || "";
    setFormData({
      student_id: defaultStudent,
      amount: "1200000",
      description: `Học phí Tháng ${new Date().getMonth() + 1}`,
      due_date: toLocalDateKey(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)),
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.student_id) return;
    if (!(Number(formData.amount) > 0)) {
      alert("Số tiền phải lớn hơn 0.");
      return;
    }

    const newPayment: Payment = {
      id: `pay${payments.length + 1}-${Math.floor(Math.random() * 1000)}`,
      student_id: formData.student_id,
      amount: Number(formData.amount),
      description: formData.description,
      due_date: formData.due_date,
      payment_status: "pending",
      created_at: toLocalDateKey(new Date()),
    };

    const updated = [newPayment, ...payments];
    setPayments(updated);
    await savePayments(updated);
    setIsModalOpen(false);
  };

  return (
    <PortalLayout role="admin" userName="Admin User" pageTitle="Quản lý Học phí">
      <div className="space-y-6">
        <SectionHeader
          title="Học phí & Thanh toán"
          subtitle="Theo dõi và quản lý học phí của tất cả học viên"
          action={
            <Button variant="gradient" onClick={handleOpenAddModal}>
              <Plus className="h-4 w-4 mr-1" /> Ghi nhận học phí
            </Button>
          }
        />

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Đã thu", value: formatCurrency(totalCollected), icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800" },
            { label: "Chờ thanh toán", value: formatCurrency(totalPending), icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" },
            { label: "Quá hạn", value: formatCurrency(totalOverdue), icon: AlertCircle, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`rounded-2xl p-5 ${bg} animate-fade-in`}>
              <div className="flex items-center gap-3">
                <Icon className={`h-6 w-6 ${color}`} />
                <div>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Biên lai chờ xác nhận — phụ huynh/học viên vừa nộp */}
        {awaitingVerification.length > 0 && (
          <Card className="border-violet-200 dark:border-violet-800/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-violet-500" />
                <CardTitle className="text-sm">Biên lai chờ xác nhận ({awaitingVerification.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {awaitingVerification.map(row => {
                const student = students.find(s => s.id === row.student_id);
                return (
                  <div key={row.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-violet-200/60 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-900/10">
                    <Avatar size="sm"><AvatarFallback name={student?.full_name ?? "?"} /></Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{row.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {student?.full_name ?? row.student_id} · {formatCurrency(row.amount)} · {row.submitted_by === "parent" ? "Phụ huynh nộp" : "Học viên nộp"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="gradient" onClick={() => handleMarkPaid(row)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Xác nhận đã thu
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleRejectReceipt(row)}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Từ chối
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Chart */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Doanh thu theo tháng</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} barSize={36}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000000).toFixed(0)}tr`} />
                <Tooltip contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12 }} formatter={(v: any) => [formatCurrency(v), "Đã thu"]} cursor={{ fill: "rgb(var(--muted))" }} />
                <Bar dataKey="collected" fill="#e11d48" radius={[6, 6, 0, 0]} name="Đã thu" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payments table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Tất cả giao dịch học phí</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    {["Học viên", "Mô tả", "Số tiền", "Hạn nộp", "Ngày nộp", "Trạng thái", "Thao tác"].map(h => (
                      <th key={h} className="text-left p-4 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                        Chưa có giao dịch nào.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, i) => {
                      const student = students.find(s => s.id === row.student_id);
                      return (
                        <tr key={`${row.source}_${row.id}`} className="hover:bg-muted/30 transition-colors animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Avatar size="sm"><AvatarFallback name={student?.full_name ?? "?"} /></Avatar>
                              <span className="text-sm font-semibold text-foreground">{student?.full_name ?? row.student_id}</span>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">{row.description}</td>
                          <td className="p-4 text-sm font-semibold text-foreground">{formatCurrency(row.amount)}</td>
                          <td className="p-4 text-sm text-muted-foreground">{formatDate(row.due_date)}</td>
                          <td className="p-4 text-sm text-muted-foreground">{row.paid_date ? formatDate(row.paid_date) : "—"}</td>
                          <td className="p-4">
                            {row.status === "pending_verification" ? (
                              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                                Chờ xác nhận
                              </span>
                            ) : (
                              <PaymentBadge status={row.status} />
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {row.status === "paid" ? (
                                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Đã thu
                                </span>
                              ) : row.status === "pending_verification" ? (
                                <>
                                  <Button size="sm" variant="gradient" onClick={() => handleMarkPaid(row)}>
                                    Xác nhận
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleRejectReceipt(row)}>
                                    Từ chối
                                  </Button>
                                </>
                              ) : (
                                <Button size="sm" variant="gradient" onClick={() => handleMarkPaid(row)}>
                                  Xác nhận đã thu
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Record Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-scale-up">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-bold text-foreground mb-4">Ghi nhận Học phí mới</h3>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Học viên *</label>
                <select
                  required
                  className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={formData.student_id}
                  onChange={e => setFormData({ ...formData, student_id: e.target.value })}
                >
                  <option value="" disabled>Chọn học viên</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.grade})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Số tiền (VND) *</label>
                <Input
                  required
                  type="number"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="VD: 1200000"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Mô tả giao dịch *</label>
                <Input
                  required
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="VD: Học phí Tháng 6"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Hạn thanh toán *</label>
                <Input
                  required
                  type="date"
                  value={formData.due_date}
                  onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" variant="gradient">
                  Ghi nhận
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
