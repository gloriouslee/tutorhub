"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaymentBadge, SectionHeader } from "@/components/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate, formatCurrency } from "@/lib/utils";
import { DollarSign, AlertCircle, CheckCircle2, Plus, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useState, useEffect } from "react";
import { getPayments, savePayments, getStudents } from "@/lib/storage";
import { Payment, Student } from "@/types";
import { Input } from "@/components/ui/input";

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    student_id: "",
    amount: "",
    description: "Học phí tháng này",
    due_date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    async function loadData() {
      const [p, s] = await Promise.all([
        getPayments(),
        getStudents(),
      ]);
      setPayments(p);
      setStudents(s);
    }
    loadData();
  }, []);

  const totalCollected = payments.filter(p => p.payment_status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter(p => p.payment_status === "pending").reduce((s, p) => s + p.amount, 0);
  const totalOverdue = payments.filter(p => p.payment_status === "overdue").reduce((s, p) => s + p.amount, 0);

  const monthlyData = [
    { month: "Th.1", collected: 3200000 },
    { month: "Th.2", collected: 4400000 },
    { month: "Th.3", collected: 3600000 },
    { month: "Th.4", collected: 4200000 },
    { month: "Th.5", collected: totalCollected },
  ];

  const handleMarkPaid = async (id: string) => {
    const updated = payments.map(p =>
      p.id === id
        ? { ...p, payment_status: "paid" as const, paid_date: new Date().toISOString().split("T")[0] }
        : p
    );
    setPayments(updated);
    await savePayments(updated);
  };

  const handleOpenAddModal = () => {
    const defaultStudent = students[0]?.id || "";
    setFormData({
      student_id: defaultStudent,
      amount: "1200000",
      description: "Học phí Tháng 6",
      due_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().split("T")[0],
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.student_id) return;

    const newPayment: Payment = {
      id: `pay${payments.length + 1}-${Math.floor(Math.random() * 1000)}`,
      student_id: formData.student_id,
      amount: Number(formData.amount),
      description: formData.description,
      due_date: formData.due_date,
      payment_status: "pending",
      created_at: new Date().toISOString().split("T")[0],
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
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                        Chưa có giao dịch nào.
                      </td>
                    </tr>
                  ) : (
                    payments.map((pay, i) => {
                      const student = students.find(s => s.id === pay.student_id);
                      return (
                        <tr key={pay.id} className="hover:bg-muted/30 transition-colors animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Avatar size="sm"><AvatarFallback name={student?.full_name ?? "?"} /></Avatar>
                              <span className="text-sm font-semibold text-foreground">{student?.full_name ?? "Không xác định"}</span>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">{pay.description}</td>
                          <td className="p-4 text-sm font-semibold text-foreground">{formatCurrency(pay.amount)}</td>
                          <td className="p-4 text-sm text-muted-foreground">{formatDate(pay.due_date)}</td>
                          <td className="p-4 text-sm text-muted-foreground">{pay.paid_date ? formatDate(pay.paid_date) : "—"}</td>
                          <td className="p-4"><PaymentBadge status={pay.payment_status} /></td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {pay.payment_status !== "paid" ? (
                                <Button size="sm" variant="gradient" onClick={() => handleMarkPaid(pay.id)}>
                                  Xác nhận đã thu
                                </Button>
                              ) : (
                                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Đã thu
                                </span>
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
