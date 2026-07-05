"use client";

import { useState } from "react";
import { Users, DollarSign, CheckSquare, TrendingUp, Bell, ArrowRight, AlertCircle } from "lucide-react";
import StatCard from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaymentBadge, ProgressBar, SectionHeader } from "@/components/shared";
import { MOCK_STUDENTS, MOCK_CLASSES, MOCK_PAYMENTS, MOCK_NOTIFICATIONS, MOCK_EXAM_SCORES, MOCK_ATTENDANCE, ATTENDANCE_CHART_DATA, STUDENT_SCORE_DATA } from "@/lib/mock-data";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const DAY_VI: Record<string, string> = {
  Monday: "Thứ Hai", Tuesday: "Thứ Ba", Wednesday: "Thứ Tư",
  Thursday: "Thứ Năm", Friday: "Thứ Sáu", Saturday: "Thứ Bảy", Sunday: "Chủ Nhật",
};

const PARENT_NAME = "Trần Văn Minh";
const myChildren = MOCK_STUDENTS.filter((s) => s.parent_id === "p1");

export default function ParentDashboard() {
  const [activeChild, setActiveChild] = useState(myChildren[0]);
  const childPayments = MOCK_PAYMENTS.filter((p) => p.student_id === activeChild?.id);
  const parentNotifications = MOCK_NOTIFICATIONS.filter(
    (n) => n.target_role === "parent" || n.target_role === "all"
  );

  // Computed stats
  const allChildIds = myChildren.map(c => c.id);
  const allAttendance = MOCK_ATTENDANCE.filter(a => allChildIds.includes(a.student_id));
  const attRate = allAttendance.length > 0
    ? Math.round(allAttendance.filter(a => a.status === "present").length / allAttendance.length * 100)
    : 0;
  const allScores = MOCK_EXAM_SCORES.filter(e => allChildIds.includes(e.student_id));
  const avgScore = allScores.length > 0
    ? (allScores.reduce((s, e) => s + e.score, 0) / allScores.length).toFixed(1)
    : "—";
  const pendingPayments = MOCK_PAYMENTS.filter(p => allChildIds.includes(p.student_id) && p.payment_status !== "paid");
  const pendingTotal = pendingPayments.reduce((s, p) => s + p.amount, 0);
  const nextDue = pendingPayments.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg animate-fade-in"
        style={{ background: "linear-gradient(135deg, #14b8a6 0%, #059669 100%)" }}>
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-white/70 text-sm font-medium">Xin chào 👋</p>
          <h2 className="text-2xl font-bold mt-1">{PARENT_NAME}</h2>
          <p className="text-white/60 text-sm mt-1">
            Đang theo dõi {myChildren.length} con
            {nextDue ? ` · Học phí hạn ${new Date(nextDue.due_date).toLocaleDateString("vi-VN")}` : ""}
          </p>
          <Link href="/parent/payments">
            <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0 mt-4">
              Xem học phí <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Child selector */}
      {myChildren.length > 1 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground font-medium">Đang xem:</span>
          <div className="flex items-center gap-2 flex-wrap">
            {myChildren.map((child) => (
              <button
                key={child.id}
                onClick={() => setActiveChild(child)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                  activeChild?.id === child.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                <Avatar size="sm"><AvatarFallback name={child.full_name} /></Avatar>
                {child.full_name.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Số con" value={myChildren.length} icon={Users} iconBg="bg-teal-100 dark:bg-teal-900/30" iconColor="text-teal-600" delay={0} />
        <StatCard title="Tỉ lệ chuyên cần" value={`${attRate}%`} icon={CheckSquare} iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600" delay={100} />
        <StatCard title="Điểm trung bình" value={avgScore} icon={TrendingUp} iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-600" delay={200} />
        <StatCard title="Học phí chờ đóng" value={formatCurrency(pendingTotal)} icon={DollarSign} iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600" delay={300} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress & Payments */}
        <div className="lg:col-span-2 space-y-4 animate-fade-in delay-100">
          <SectionHeader
            title={`Tiến độ của ${activeChild?.full_name ?? "con"}`}
            subtitle={`${activeChild?.grade} · ${activeChild?.school}`}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Điểm theo môn học</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {STUDENT_SCORE_DATA.map((s) => (
                  <ProgressBar
                    key={s.subject}
                    label={s.subject}
                    value={s.score}
                    color={s.score >= 90 ? "bg-emerald-500" : s.score >= 75 ? "bg-indigo-500" : "bg-amber-500"}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Lịch sử điểm danh</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={ATTENDANCE_CHART_DATA} barSize={8}>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 11 }} cursor={{ fill: "rgb(var(--muted))" }} />
                    <Bar dataKey="present" fill="#10b981" radius={[3, 3, 0, 0]} name="Có mặt" />
                    <Bar dataKey="absent" fill="#ef4444" radius={[3, 3, 0, 0]} name="Vắng mặt" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Payment history */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Lịch sử Học phí</CardTitle>
                <Link href="/parent/payments"><Button size="sm" variant="outline">Thanh toán</Button></Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {childPayments.length > 0 ? childPayments.map((pay) => (
                  <div key={pay.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted transition-colors">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                      pay.payment_status === "paid" ? "bg-emerald-100 dark:bg-emerald-900/30" :
                      pay.payment_status === "overdue" ? "bg-red-100 dark:bg-red-900/30" : "bg-amber-100 dark:bg-amber-900/30"
                    }`}>
                      <DollarSign className={`h-4 w-4 ${
                        pay.payment_status === "paid" ? "text-emerald-600" :
                        pay.payment_status === "overdue" ? "text-red-600" : "text-amber-600"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{pay.description}</p>
                      <p className="text-xs text-muted-foreground">Hạn {formatDate(pay.due_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(pay.amount)}</p>
                      <PaymentBadge status={pay.payment_status} />
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Chưa có giao dịch nào.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notifications + Schedule */}
        <div className="space-y-4 animate-fade-in delay-200">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Thông báo</CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {parentNotifications.slice(0, 4).map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors cursor-pointer ${
                    !n.is_read ? "bg-accent/60" : "hover:bg-muted"
                  }`}
                >
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                    !n.is_read ? "bg-primary/10" : "bg-muted"
                  }`}>
                    {n.title.includes("Alert") ? (
                      <AlertCircle className={`h-3.5 w-3.5 ${!n.is_read ? "text-primary" : "text-muted-foreground"}`} />
                    ) : (
                      <Bell className={`h-3.5 w-3.5 ${!n.is_read ? "text-primary" : "text-muted-foreground"}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-semibold text-foreground truncate">{n.title}</p>
                      {!n.is_read && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.content}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Lớp học sắp tới</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {MOCK_CLASSES.filter(cls => (cls.student_ids ?? []).some(id => allChildIds.includes(id))).slice(0, 4).map((cls) => (
                <div key={cls.id} className="flex items-center gap-3 py-1.5">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cls.color ?? "#6366f1" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{cls.class_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {DAY_VI[cls.schedule[0]?.day] ?? cls.schedule[0]?.day} · {cls.schedule[0]?.start_time}–{cls.schedule[0]?.end_time}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
