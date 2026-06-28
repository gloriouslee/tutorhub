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

export default function AdminDashboard() {
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const [s, t, c, p, a] = await Promise.all([
        getStudents(),
        getTeachers(),
        getClasses(),
        getPayments(),
        getAttendance(),
      ]);
      setStudents(s);
      setTeachers(t);
      setClasses(c);
      setPayments(p);
      setAttendance(a);
    }
    loadData();
  }, []);

  const totalRevenue = payments.filter(p => p.payment_status === "paid").reduce((s, p) => s + p.amount, 0);
  const pendingRevenue = payments.filter(p => p.payment_status !== "paid").reduce((s, p) => s + p.amount, 0);

  const onlineCount = students.filter(s => s.learning_type === "online").length;
  const offlineCount = students.filter(s => s.learning_type === "offline").length;
  const hybridCount = students.filter(s => s.learning_type === "hybrid").length;

  const pieData = [
    { name: "Online", value: onlineCount || 1, color: "#3b82f6" },
    { name: "Offline", value: offlineCount || 1, color: "#8b5cf6" },
    { name: "Hybrid", value: hybridCount || 1, color: "#14b8a6" },
  ];

  const revenueChartData = [
    { month: "Jan", revenue: 84000000, target: 90000000 },
    { month: "Feb", revenue: 92000000, target: 90000000 },
    { month: "Mar", revenue: 78000000, target: 90000000 },
    { month: "Apr", revenue: 96000000, target: 90000000 },
    { month: "May", revenue: totalRevenue || 89000000, target: 95000000 },
  ];

  const attendanceChartData = [
    { month: "Jan", present: 88 },
    { month: "Feb", present: 92 },
    { month: "Mar", present: 85 },
    { month: "Apr", present: 90 },
    { month: "May", present: 93 },
  ];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg animate-fade-in"
        style={{ background: "linear-gradient(135deg, #e11d48 0%, #be185d 100%)" }}>
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-white/70 text-sm font-medium">Admin Overview ⚙️</p>
          <h2 className="text-2xl font-bold mt-1">TutorHub Control Center</h2>
          <div className="flex items-center gap-6 mt-3">
            <div><p className="text-2xl font-bold">{students.length}</p><p className="text-white/60 text-xs">Students</p></div>
            <div className="w-px h-8 bg-white/20" />
            <div><p className="text-2xl font-bold">{teachers.length}</p><p className="text-white/60 text-xs">Teachers</p></div>
            <div className="w-px h-8 bg-white/20" />
            <div><p className="text-2xl font-bold">{classes.length}</p><p className="text-white/60 text-xs">Classes</p></div>
            <div className="w-px h-8 bg-white/20" />
            <div><p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p><p className="text-white/60 text-xs">Revenue</p></div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Students" value={students.length} icon={GraduationCap} iconBg="bg-rose-100 dark:bg-rose-900/30" iconColor="text-rose-600" delay={0} trend={{ value: 12, label: "vs last month" }} />
        <StatCard title="Total Teachers" value={teachers.length} icon={Users} iconBg="bg-pink-100 dark:bg-pink-900/30" iconColor="text-pink-600" delay={100} />
        <StatCard title="Active Classes" value={classes.length} icon={BookOpen} iconBg="bg-fuchsia-100 dark:bg-fuchsia-900/30" iconColor="text-fuchsia-600" delay={200} />
        <StatCard title="Monthly Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign} iconBg="bg-purple-100 dark:bg-purple-900/30" iconColor="text-purple-600" delay={300} trend={{ value: 8, label: "vs last month" }} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in delay-100">
        <Card className="md:col-span-2 border border-border">
          <CardHeader><CardTitle className="text-sm">Revenue vs Target</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueChartData} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12 }} formatter={(v: any) => formatCurrency(v)} cursor={{ fill: "rgb(var(--muted))" }} />
                <Bar dataKey="revenue" fill="#e11d48" radius={[6, 6, 0, 0]} name="Revenue" />
                <Bar dataKey="target" fill="rgb(var(--muted))" radius={[6, 6, 0, 0]} name="Target" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader><CardTitle className="text-sm">Students by Mode</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8} formatter={(val) => <span style={{ fontSize: 11, color: "rgb(var(--muted-foreground))" }}>{val}</span>} />
                <Tooltip contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12 }} />
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
              <CardTitle className="text-sm">Recent Students</CardTitle>
              <Link href="/admin/students">
                <Button size="sm" variant="outline">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {students.slice(0, 5).map((s) => (
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

        {/* Payment status */}
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Payment Overview</CardTitle>
              <div className="text-xs font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-lg">
                {formatCurrency(pendingRevenue)} pending
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {payments.slice(0, 5).map((pay) => {
                const student = students.find(s => s.id === pay.student_id);
                return (
                  <div key={pay.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted transition-colors">
                    <Avatar size="sm"><AvatarFallback name={student?.full_name ?? "?"} /></Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{student?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{pay.description} · Due {formatDate(pay.due_date)}</p>
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
        <Card className="border border-border">
          <CardHeader><CardTitle className="text-sm">Attendance Trends</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={attendanceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Present %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Teachers</CardTitle>
              <Link href="/admin/teachers">
                <Button size="sm" variant="outline">Manage</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {teachers.slice(0, 4).map((t) => {
              const teacherClasses = classes.filter(c => c.tutor_id === t.id);
              return (
                <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted transition-colors">
                  <Avatar size="sm"><AvatarFallback name={t.full_name} /></Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.full_name}</p>
                    <p className="text-xs text-muted-foreground">{t.specialization}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-foreground">{teacherClasses.length} classes</p>
                    <p className="text-[10px] text-muted-foreground">{teacherClasses.length * 4} students</p>
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
