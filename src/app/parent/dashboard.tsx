"use client";

import { useState, useEffect, useMemo } from "react";
import { Users, DollarSign, CheckSquare, TrendingUp, Bell, ArrowRight, AlertCircle } from "lucide-react";
import StatCard from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaymentBadge, ProgressBar, SectionHeader } from "@/components/shared";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useParentContext } from "@/hooks/useParentContext";
import {
  loadChildrenAttendance, attendanceRate, loadChildScores, averageScore,
  type ChildAttendanceRecord,
} from "@/lib/parent-data";
import { getInvoices, getNotifications, type TuitionInvoice, type StoredExamScore } from "@/lib/storage";
import type { Notification } from "@/types";

const DAY_VI: Record<string, string> = {
  Monday: "Thứ Hai", Tuesday: "Thứ Ba", Wednesday: "Thứ Tư",
  Thursday: "Thứ Năm", Friday: "Thứ Sáu", Saturday: "Thứ Bảy", Sunday: "Chủ Nhật",
};

// Trạng thái hiển thị cho hóa đơn thật: quá hạn khi chưa thanh toán và trễ hạn.
function invoiceBadgeStatus(inv: TuitionInvoice): "paid" | "pending" | "overdue" {
  if (inv.status === "paid") return "paid";
  return new Date(inv.due_date).getTime() < Date.now() ? "overdue" : "pending";
}

// Đọc danh sách id đã đọc/đã xóa của trang thông báo phụ huynh (localStorage).
function parseIdSet(key: string): Set<string> {
  try { return new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]")); }
  catch { return new Set<string>(); }
}

export default function ParentDashboard() {
  const { parentName, children, ready } = useParentContext();
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [attendance,    setAttendance]    = useState<ChildAttendanceRecord[]>([]);
  const [scoresByChild, setScoresByChild] = useState<Record<string, StoredExamScore[]>>({});
  const [invoices,      setInvoices]      = useState<TuitionInvoice[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const activeChild = children.find(c => c.id === activeChildId) ?? children[0];

  useEffect(() => {
    if (!ready) return;
    const ids = children.map(c => c.id);

    // Điểm danh thật (giáo viên lưu) + mock nền — cho toàn bộ các con
    loadChildrenAttendance(ids).then(setAttendance);

    // Điểm thi thật (giáo viên nhập + bài thi online) theo từng con
    Promise.all(
      children.map(async c =>
        [c.id, await loadChildScores(c.id, c.classes.map(cl => cl.id))] as const
      )
    ).then(entries => setScoresByChild(Object.fromEntries(entries)));

    // Hóa đơn học phí thật (kho chung tutorhub_invoices)
    getInvoices().then(all => setInvoices(all.filter(inv => ids.includes(inv.child_id))));

    // Thông báo gửi tới phụ huynh — trừ đã đọc/đã xóa (giống trang thông báo)
    getNotifications().then(all => {
      const readIds    = parseIdSet("tutorhub_parent_notif_read");
      const deletedIds = parseIdSet("tutorhub_parent_notif_deleted");
      setNotifications(
        all
          .filter(n => (n.target_role === "parent" || n.target_role === "all") && !deletedIds.has(n.id))
          .map(n => (readIds.has(n.id) ? { ...n, is_read: true } : n))
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
      );
    });
  }, [ready, children]);

  // Computed stats — dữ liệu thật, "—" khi chưa có bản ghi
  const attRate = attendanceRate(attendance);
  const avgScore = averageScore(Object.values(scoresByChild).flat());
  const childPayments   = invoices.filter(inv => inv.child_id === activeChild?.id);
  const pendingPayments = invoices.filter(inv => inv.status === "pending");
  const pendingTotal    = pendingPayments.reduce((s, p) => s + p.amount, 0);
  const nextDue = [...pendingPayments].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  // Điểm theo bài thi gần nhất của con đang xem — chuẩn hoá thang 10
  const activeScores = scoresByChild[activeChild?.id ?? ""] ?? [];
  const scoreBars = activeScores.slice(0, 4).map(s => ({
    id:    s.id,
    label: s.exam_name,
    score10: s.max_score && s.max_score !== 10 ? Math.round((s.score / s.max_score) * 100) / 10 : s.score,
  }));

  // Lịch sử điểm danh theo tháng của con đang xem — từ bản ghi thật
  const attendanceChartData = useMemo(() => {
    const byMonth = new Map<string, { present: number; absent: number }>();
    for (const r of attendance.filter(a => a.student_id === activeChild?.id)) {
      const key = r.date.slice(0, 7); // YYYY-MM
      const e = byMonth.get(key) ?? { present: 0, absent: 0 };
      if (r.status === "present" || r.status === "late") e.present++;
      else if (r.status === "absent") e.absent++;
      byMonth.set(key, e);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-5)
      .map(([k, v]) => ({ month: `T${parseInt(k.slice(5), 10)}`, ...v }));
  }, [attendance, activeChild?.id]);

  // Lớp sắp tới — từ lớp thật đã resolve của các con (dedupe theo id)
  const upcomingClasses = useMemo(() => {
    const seen = new Set<string>();
    return children.flatMap(c => c.classes).filter(cls => {
      if (seen.has(cls.id)) return false;
      seen.add(cls.id);
      return true;
    });
  }, [children]);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg animate-fade-in"
        style={{ background: "linear-gradient(135deg, #14b8a6 0%, #059669 100%)" }}>
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-white/70 text-sm font-medium">Xin chào 👋</p>
          <h2 className="text-2xl font-bold mt-1">{parentName}</h2>
          <p className="text-white/60 text-sm mt-1">
            Đang theo dõi {children.length} con
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
      {children.length > 1 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground font-medium">Đang xem:</span>
          <div className="flex items-center gap-2 flex-wrap">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => setActiveChildId(child.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                  activeChild?.id === child.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                <Avatar size="sm"><AvatarFallback name={child.name} /></Avatar>
                {child.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Số con" value={children.length} icon={Users} iconBg="bg-teal-100 dark:bg-teal-900/30" iconColor="text-teal-600" delay={0} />
        <StatCard title="Tỉ lệ chuyên cần" value={attRate != null ? `${attRate}%` : "—"} icon={CheckSquare} iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600" delay={100} />
        <StatCard title="Điểm trung bình" value={avgScore != null ? avgScore.toFixed(1) : "—"} icon={TrendingUp} iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-600" delay={200} />
        <StatCard title="Học phí chờ đóng" value={formatCurrency(pendingTotal)} icon={DollarSign} iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600" delay={300} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress & Payments */}
        <div className="lg:col-span-2 space-y-4 animate-fade-in delay-100">
          <SectionHeader
            title={`Tiến độ của ${activeChild?.name ?? "con"}`}
            subtitle={[activeChild?.grade, activeChild?.school].filter(Boolean).join(" · ") || "Hồ sơ học viên"}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Điểm bài thi gần đây</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {scoreBars.length > 0 ? scoreBars.map((s) => (
                  <ProgressBar
                    key={s.id}
                    label={s.label}
                    value={Math.round(s.score10 * 10)}
                    color={s.score10 >= 9 ? "bg-emerald-500" : s.score10 >= 7.5 ? "bg-indigo-500" : "bg-amber-500"}
                  />
                )) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Chưa có điểm thi nào.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Lịch sử điểm danh</CardTitle></CardHeader>
              <CardContent>
                {attendanceChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={attendanceChartData} barSize={8}>
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 11 }} cursor={{ fill: "rgb(var(--muted))" }} />
                      <Bar dataKey="present" fill="#10b981" radius={[3, 3, 0, 0]} name="Có mặt" />
                      <Bar dataKey="absent" fill="#ef4444" radius={[3, 3, 0, 0]} name="Vắng mặt" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Chưa có dữ liệu điểm danh.</p>
                )}
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
                {childPayments.length > 0 ? childPayments.map((pay) => {
                  const status = invoiceBadgeStatus(pay);
                  return (
                    <div key={pay.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted transition-colors">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                        status === "paid" ? "bg-emerald-100 dark:bg-emerald-900/30" :
                        status === "overdue" ? "bg-red-100 dark:bg-red-900/30" : "bg-amber-100 dark:bg-amber-900/30"
                      }`}>
                        <DollarSign className={`h-4 w-4 ${
                          status === "paid" ? "text-emerald-600" :
                          status === "overdue" ? "text-red-600" : "text-amber-600"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{pay.title}</p>
                        <p className="text-xs text-muted-foreground">Hạn {formatDate(pay.due_date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(pay.amount)}</p>
                        <PaymentBadge status={status} />
                      </div>
                    </div>
                  );
                }) : (
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
              {notifications.length > 0 ? notifications.slice(0, 4).map((n) => (
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
              )) : (
                <p className="text-sm text-muted-foreground text-center py-4">Không có thông báo nào.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Lớp học sắp tới</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {upcomingClasses.length > 0 ? upcomingClasses.slice(0, 4).map((cls) => (
                <div key={cls.id} className="flex items-center gap-3 py-1.5">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cls.color ?? "#6366f1" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{cls.class_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {DAY_VI[cls.schedule?.[0]?.day] ?? cls.schedule?.[0]?.day ?? "Lịch đang cập nhật"}
                      {cls.schedule?.[0] ? ` · ${cls.schedule[0].start_time}–${cls.schedule[0].end_time}` : ""}
                    </p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground text-center py-4">Chưa có lớp học nào.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
