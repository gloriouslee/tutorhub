"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  BellRing,
  BookOpenCheck,
  CalendarCheck2,
  FileText,
  Flag,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/shared";

type Goal = {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  progressPercent: number;
  status: string;
  periodEnd: string;
};
type WeeklySummary = {
  attendance?: { present?: number; late?: number; absent?: number; total?: number };
  homework?: { assigned?: number; submitted?: number };
  scores?: { count?: number; average?: number | null };
  completedLessons?: number;
  xpEarned?: number;
  feedback?: string[];
};
type ChildGrowth = {
  studentId: string;
  studentName: string;
  avatarUrl: string | null;
  xp: { total: number; level: number; progressPercent: number };
  badges: { id: string; title: string; description: string }[];
  goals: Goal[];
  weakTopics: { id: string; topic: string; masteryPercent: number }[];
  reports: {
    id: string;
    weekStart: string;
    weekEnd: string;
    summary: WeeklySummary;
    teacherComment: string | null;
    deliveryStatus: string;
    deliveredAt: string | null;
  }[];
};
type ParentGrowthPayload = { children: ChildGrowth[] };

export default function ParentGrowthPanel() {
  const [data, setData] = useState<ParentGrowthPayload | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/parent/learning-growth", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("unavailable");
      const payload = await response.json() as ParentGrowthPayload;
      setData(payload);
      setActiveId((current) => current ?? payload.children[0]?.studentId ?? null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const child = useMemo(
    () => data?.children.find((item) => item.studentId === activeId) ?? data?.children[0] ?? null,
    [activeId, data],
  );
  const report = child?.reports[0] ?? null;
  const summary = report?.summary;
  const goals = child?.goals.filter((goal) => goal.status === "active" || goal.status === "completed") ?? [];

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;
  if (!data || data.children.length === 0 || !child) return null;

  const reportStats = [
    { label: "Chuyên cần", value: summary?.attendance?.total ? `${(summary.attendance.present ?? 0) + (summary.attendance.late ?? 0)}/${summary.attendance.total}` : "—", icon: CalendarCheck2, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30" },
    { label: "Bài đã nộp", value: `${summary?.homework?.submitted ?? 0}/${summary?.homework?.assigned ?? 0}`, icon: BookOpenCheck, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
    { label: "Điểm TB", value: summary?.scores?.average != null ? `${summary.scores.average}/10` : "—", icon: TrendingUp, color: "text-violet-600 bg-violet-100 dark:bg-violet-900/30" },
    { label: "XP tuần", value: `+${summary?.xpEarned ?? 0}`, icon: Sparkles, color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30" },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-teal-600" />
            <h2 className="text-xl font-bold">Báo cáo học tập & mục tiêu</h2>
            {report?.deliveryStatus === "delivered" && <Badge className="border-0 bg-teal-100 text-teal-700">Thông báo tuần</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Bản tổng hợp tự động từ dữ liệu học tập thực tế của con.</p>
        </div>
        {data.children.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {data.children.map((item) => (
              <button key={item.studentId} type="button" onClick={() => setActiveId(item.studentId)} className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold transition ${item.studentId === child.studentId ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                <Avatar size="sm"><AvatarFallback name={item.studentName} /></Avatar>{item.studentName.split(" ").slice(-1)[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/20 dark:to-emerald-950/20">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-teal-600" /> Báo cáo tuần của {child.studentName}</CardTitle>
              {report && <span className="text-xs text-muted-foreground">{new Date(report.weekStart).toLocaleDateString("vi-VN")} – {new Date(report.weekEnd).toLocaleDateString("vi-VN")}</span>}
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-5">
            {!report ? (
              <div className="py-8 text-center"><BellRing className="mx-auto mb-3 h-9 w-9 text-muted-foreground/35" /><p className="font-semibold">Chưa có báo cáo tuần đầu tiên</p><p className="mt-1 text-sm text-muted-foreground">Báo cáo được tự động gửi vào Parent Portal mỗi sáng thứ Hai.</p></div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {reportStats.map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-border p-3 text-center">
                      <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg ${stat.color}`}><stat.icon className="h-4 w-4" /></div>
                      <p className="mt-2 text-xl font-black">{stat.value}</p><p className="text-[11px] text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl bg-muted/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nhận xét giáo viên</p>
                  <p className="mt-2 text-sm leading-relaxed">{report.teacherComment || summary?.feedback?.[0] || "Chưa có nhận xét bổ sung trong tuần này."}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-0 bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between"><div><p className="text-sm text-white/70">Nỗ lực tích lũy</p><p className="mt-1 text-3xl font-black">{child.xp.total} XP</p><p className="mt-1 text-xs text-white/70">Cấp độ {child.xp.level}</p></div><Star className="h-8 w-8 text-amber-300" /></div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-amber-300" style={{ width: `${child.xp.progressPercent}%` }} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Flag className="h-4 w-4 text-primary" /> Mục tiêu đang theo dõi</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {goals.length === 0 ? <p className="py-3 text-center text-sm text-muted-foreground">Con chưa đặt mục tiêu cá nhân.</p> : goals.slice(0, 3).map((goal) => (
                <div key={goal.id}>
                  <div className="mb-2 flex items-center justify-between gap-3"><p className="truncate text-xs font-semibold">{goal.title}</p><span className="text-xs font-bold text-primary">{goal.progressPercent}%</span></div>
                  <ProgressBar value={goal.progressPercent} size="sm" />
                </div>
              ))}
              {child.badges.length > 0 && <div className="flex flex-wrap gap-2 border-t border-border pt-3">{child.badges.slice(0, 3).map((badge) => <Badge key={badge.id} variant="secondary"><Award className="mr-1 h-3 w-3 text-amber-500" />{badge.title}</Badge>)}</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
