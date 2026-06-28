"use client";

import { Users, BookOpen, DollarSign, GraduationCap } from "lucide-react";
import StatCard from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaymentBadge, LearningModeBadge } from "@/components/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useState, useEffect } from "react";
import { getStudents, getTeachers, getClasses, getPayments, getAttendance } from "@/lib/storage";

const MONTHS = ["Th.1", "Th.2", "Th.3", "Th.4", "Th.5", "Th.6", "Th.7", "Th.8", "Th.9", "Th.10", "Th.11", "Th.12"];

export default function AdminDashboard() {
  const [students,   setStudents]   = useState<any[]>([]);
  const [teachers,   setTeachers]   = useState<any[]>([]);
  const [classes,    setClasses]    = useState<any[]>([]);
  const [payments,   setPayments]   = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const [s, t, c, p, a] = await Promise.all([
        getStudents(), getTeachers(), getClasses(), getPayments(), getAttendance(),
      ]);
      setStudents(s); setTeachers(t); setClasses(c); setPayments(p); setAttendance(a);
    }
    loadData();
  }, []);

  const totalRevenue   = payments.filter(p => p.payment_status === "paid").reduce((s, p) => s + p.amount, 0);
  const pendingRevenue = payments.filter(p => p.payment_status !== "paid").reduce((s, p) => s + p.amount, 0);

  const onlineCount  = students.filter(s => s.learning_type === "online").length;
  const offlineCount = students.filter(s => s.learning_type === "offline").length;
  const hybridCount  = students.filter(s => s.learning_type === "hybrid").length;

  const pieData = [
    { name: "Trực tuyến", value: onlineCount  || 1, color: "#3b82f6" },
    { name: "Tại lớp",    value: offlineCount || 1, color: "#8b5cf6" },
    { name: "Kết hợp",    value: hybridCount  || 1, color: "#14b8a6" },
  ];

  const revenueChartData = [
    { month: "Th.1", doanhThu: 84000000, mucTieu: 90000000 },
    { month: "Th.2", doanhThu: 92000000, mucTieu: 90000000 },
    { month: "Th.3", doanhThu: 78000000, mucTieu: 90000000 },
    { month: "Th.4", doanhThu: 96000000, mucTieu: 90000000 },
    { month: "Th.5", doanhThu: totalRevenue || 89000000, mucTieu: 95000000 },
  ];

  const attendanceChartData = [
    { month: "Th.1", diemDanh: 88 },
    { month: "Th.2", diemDanh: 92 },
    { month: "Th.3", diemDanh: 85 },
    { month: "Th.4", diemDanh: 90 },
    { month: "Th.5", diemDanh: 93 },
  ];

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
        <StatCard title="Tổng học viên"  value={students.length}          icon={GraduationCap} iconBg="bg-rose-100 dark:bg-rose-900/30"    iconColor="text-rose-600"    delay={0}   trend={{ value: 12, label: "so với tháng trước" }} />
        <StatCard title="Giáo viên"      value={teachers.length}          icon={Users}         iconBg="bg-pink-100 dark:bg-pink-900/30"    iconColor="text-pink-600"    delay={100} />
        <StatCard title="Lớp đang hoạt động" value={classes.length}      icon={BookOpen}      iconBg="bg-fuchsia-100 dark:bg-fuchsia-900/30" iconColor="text-fuchsia-600" delay={200} />
        <StatCard title="Doanh thu tháng" value={formatCurrency(totalRevenue)} icon={DollarSign} iconBg="bg-purple-100 dark:bg-purple-900/30" iconColor="text-purple-600" delay={300} trend={{ value: 8, label: "so với tháng trước" }} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in delay-100">
        {/* Revenue bar chart */}
        <Card className="md:col-span-2 border border-border">
          <CardHeader><CardTitle className="text-sm">Doanh thu vs Mục tiêu</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueChartData} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v / 1000000).toFixed(0)}tr`} />
                <Tooltip
                  contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: any) => [formatCurrency(v)]}
                  cursor={{ fill: "rgb(var(--muted))" }}
                />
                <Bar dataKey="doanhThu" fill="#e11d48" radius={[6, 6, 0, 0]} name="Doanh thu" />
                <Bar dataKey="mucTieu"  fill="rgb(var(--muted))" radius={[6, 6, 0, 0]} name="Mục tiêu" />
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
                <Tooltip
                  contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: any, name: any) => [v, name]}
                />
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

        {/* Payment overview */}
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
            <div className="space-y-2">
              {payments.slice(0, 5).map(pay => {
                const student = students.find(s => s.id === pay.student_id);
                return (
                  <div key={pay.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted transition-colors">
                    <Avatar size="sm"><AvatarFallback name={student?.full_name ?? "?"} /></Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{student?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{pay.description} · Hạn {formatDate(pay.due_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(pay.amount)}</p>
                      <PaymentBadge status={pay.payment_status} />
                    </div>
                  </div>
                );
              })}
            </div>
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
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${v}%`} domain={[70, 100]} />
                <Tooltip
                  contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: any) => [`${v}%`, "Có mặt"]}
                />
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
              const teacherClasses   = classes.filter(c => c.tutor_id === t.id);
              const totalStudents    = teacherClasses.reduce((s: number, c: any) => s + (c.student_ids?.length ?? 4), 0);
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
