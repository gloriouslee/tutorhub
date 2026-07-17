"use client";

import { Users, BookOpen, DollarSign, GraduationCap, Loader2 } from "lucide-react";
import StatCard from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LearningModeBadge } from "@/components/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useState, useEffect } from "react";
import { getInvoicesRaw, type TuitionInvoice } from "@/lib/storage";
import {
  loadAnalyticsData, computeKpis, revenueTrend, attendanceTrend, learningModeDist,
  type AnalyticsData,
} from "@/lib/analytics";

const AXIS = { fontSize: 11, fill: "rgb(var(--muted-foreground))" };
const TOOLTIP = { background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12 };
const INV_STATUS: Record<string, { label: string; cls: string }> = {
  paid:                 { label: "Đã thu",     cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  pending:              { label: "Chờ thu",    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  pending_verification: { label: "Chờ xác minh", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
};

export default function AdminDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [invoices, setInvoices] = useState<TuitionInvoice[]>([]);

  useEffect(() => {
    loadAnalyticsData().then(setData);
    getInvoicesRaw().then(setInvoices);
  }, []);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-3">Đang tải dữ liệu…</p>
      </div>
    );
  }

  const { students, teachers, classes } = data;
  const kpis = computeKpis(data);
  const totalRevenue = kpis.totalRevenue;

  const pieData = learningModeDist(data);
  const revenueChartData = revenueTrend(data, 5);
  const attendanceChartData = attendanceTrend(data, 5).map(d => ({ month: d.month, diemDanh: d.coMat }));

  const paidInvoices    = invoices.filter(i => i.status === "paid");
  const pendingInvoices = invoices.filter(i => i.status !== "paid");
  const pendingRevenue  = pendingInvoices.reduce((s, i) => s + i.amount, 0);
  const recentInvoices  = [...invoices].sort((a, b) => (b.paid_at ?? b.due_date).localeCompare(a.paid_at ?? a.due_date)).slice(0, 5);
  const studentName = (id: string) => students.find(s => s.id === id)?.full_name ?? id;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg animate-fade-in"
        style={{ background: "linear-gradient(135deg, #e11d48 0%, #be185d 100%)" }}>
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-white/70 text-sm font-medium">Tổng quan Quản trị ⚙️</p>
          <h2 className="text-2xl font-bold mt-1">Trung tâm Điều hành TutorHub</h2>
          <div className="flex items-center gap-6 mt-3">
            <div><p className="text-2xl font-bold">{students.length}</p><p className="text-white/60 text-xs">Học viên</p></div>
            <div className="w-px h-8 bg-white/20" />
            <div><p className="text-2xl font-bold">{teachers.length}</p><p className="text-white/60 text-xs">Giáo viên</p></div>
            <div className="w-px h-8 bg-white/20" />
            <div><p className="text-2xl font-bold">{classes.length}</p><p className="text-white/60 text-xs">Lớp học</p></div>
            <div className="w-px h-8 bg-white/20" />
            <div><p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p><p className="text-white/60 text-xs">Doanh thu</p></div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Tổng học viên"  value={students.length}          icon={GraduationCap} iconBg="bg-rose-100 dark:bg-rose-900/30"    iconColor="text-rose-600"    delay={0} />
        <StatCard title="Giáo viên"      value={teachers.length}          icon={Users}         iconBg="bg-pink-100 dark:bg-pink-900/30"    iconColor="text-pink-600"    delay={100} />
        <StatCard title="Lớp đang hoạt động" value={classes.length}      icon={BookOpen}      iconBg="bg-fuchsia-100 dark:bg-fuchsia-900/30" iconColor="text-fuchsia-600" delay={200} />
        <StatCard title="Tổng doanh thu" value={formatCurrency(totalRevenue)} icon={DollarSign} iconBg="bg-purple-100 dark:bg-purple-900/30" iconColor="text-purple-600" delay={300} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in delay-100">
        {/* Revenue bar chart */}
        <Card className="md:col-span-2 border border-border">
          <CardHeader><CardTitle className="text-sm">Xu hướng doanh thu</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueChartData} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000000).toFixed(0)}tr`} />
                <Tooltip contentStyle={TOOLTIP} formatter={(v: any) => [formatCurrency(v), "Doanh thu"]} cursor={{ fill: "rgb(var(--muted))" }} />
                <Bar dataKey="doanhThu" fill="#e11d48" radius={[6, 6, 0, 0]} name="Doanh thu" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card className="border border-border">
          <CardHeader><CardTitle className="text-sm">Học viên theo hình thức</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8}
                  formatter={val => <span style={{ fontSize: 11, color: "rgb(var(--muted-foreground))" }}>{val}</span>} />
                <Tooltip contentStyle={TOOLTIP} formatter={(v: any, name: any) => [v, name]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in delay-200">
        {/* Recent students */}
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Học viên mới đăng ký</CardTitle>
              <Link href="/admin/students">
                <Button size="sm" variant="outline">Xem tất cả</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {students.slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted transition-colors">
                  <Avatar size="sm"><AvatarFallback name={s.full_name} /></Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">{s.grade} · {s.school}</p>
                  </div>
                  <LearningModeBadge mode={s.learning_type} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment overview (from real invoices) */}
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Tình hình Học phí</CardTitle>
              <div className="text-xs font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-lg">
                {formatCurrency(pendingRevenue)} chờ thu
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Chưa có hóa đơn học phí nào</p>
            ) : (
              <div className="space-y-2">
                {recentInvoices.map(inv => {
                  const st = INV_STATUS[inv.status] ?? INV_STATUS.pending;
                  return (
                    <div key={inv.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted transition-colors">
                      <Avatar size="sm"><AvatarFallback name={studentName(inv.child_id)} /></Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{studentName(inv.child_id)}</p>
                        <p className="text-xs text-muted-foreground truncate">{inv.title} · Hạn {formatDate(inv.due_date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(inv.amount)}</p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attendance + Teachers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in delay-300">
        {/* Attendance line chart */}
        <Card className="border border-border">
          <CardHeader><CardTitle className="text-sm">Xu hướng Điểm danh (%)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={attendanceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                <Tooltip contentStyle={TOOLTIP} formatter={(v: any) => [`${v}%`, "Có mặt"]} />
                <Line type="monotone" dataKey="diemDanh" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Có mặt %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Teachers */}
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Giáo viên</CardTitle>
              <Link href="/admin/teachers">
                <Button size="sm" variant="outline">Quản lý</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {teachers.slice(0, 4).map(t => {
              const teacherClasses = classes.filter(c => data.teacherOf[c.id] === t.id);
              const totalStudents  = teacherClasses.reduce((s, c) => s + (c.student_ids?.length ?? 0), 0);
              return (
                <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted transition-colors">
                  <Avatar size="sm"><AvatarFallback name={t.full_name} /></Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.full_name}</p>
                    <p className="text-xs text-muted-foreground">{t.specialization}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-foreground">{teacherClasses.length} lớp</p>
                    <p className="text-[10px] text-muted-foreground">{totalStudents} học viên</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
