"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  BookOpenCheck,
  BrainCircuit,
  CalendarCheck2,
  Flag,
  Loader2,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/shared";

type Goal = {
  id: string;
  title: string;
  metric: string;
  targetValue: number;
  currentValue: number;
  progressPercent: number;
  periodEnd: string;
  status: "active" | "completed" | "cancelled" | "expired";
};
type WeakTopic = {
  id: string;
  classId: string;
  topic: string;
  masteryPercent: number;
  incorrectQuestions: number;
  totalQuestions: number;
  lastExamTitle: string | null;
  recommendedResources: { title?: string; lessonId?: string; type?: string }[];
};
type GrowthPayload = {
  xp: { total: number; level: number; currentLevelXp: number; nextLevelXp: number; progressPercent: number };
  badges: { id: string; title: string; description: string; icon: string; awardedAt: string }[];
  goals: Goal[];
  weakTopics: WeakTopic[];
};

const METRICS = {
  homework_completed: { label: "Bài tập hoàn thành", suffix: "bài", icon: BookOpenCheck },
  average_score: { label: "Điểm trung bình", suffix: "điểm", icon: TrendingUp },
  attendance_rate: { label: "Tỷ lệ chuyên cần", suffix: "%", icon: CalendarCheck2 },
  lessons_completed: { label: "Nội dung hoàn thành", suffix: "bài", icon: Target },
  xp_earned: { label: "XP tích lũy", suffix: "XP", icon: Sparkles },
} as const;

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function StudentGrowthPanel() {
  const [data, setData] = useState<GrowthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [title, setTitle] = useState("Hoàn thành mục tiêu tuần");
  const [metric, setMetric] = useState<keyof typeof METRICS>("homework_completed");
  const [targetValue, setTargetValue] = useState(3);
  const [periodStart, setPeriodStart] = useState(() => dateOffset(0));
  const [periodEnd, setPeriodEnd] = useState(() => dateOffset(6));

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/student/learning-growth", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("unavailable");
      setData(await response.json() as GrowthPayload);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeGoals = useMemo(
    () => data?.goals.filter((goal) => goal.status === "active" || goal.status === "completed") ?? [],
    [data],
  );

  async function createGoal() {
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/student/learning-growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ title, metric, targetValue, periodStart, periodEnd, classId: null }),
      });
      if (!response.ok) throw new Error("create_failed");
      setFormOpen(false);
      await load();
    } catch {
      setFormError("Không thể tạo mục tiêu. Hãy kiểm tra nội dung và thời hạn.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelGoal(goalId: string) {
    const response = await fetch(`/api/student/learning-growth?goalId=${encodeURIComponent(goalId)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (response.ok) {
      setData((current) => current ? {
        ...current,
        goals: current.goals.map((goal) => goal.id === goalId ? { ...goal, status: "cancelled" } : goal),
      } : current);
    }
  }

  if (loading) return <div className="h-72 animate-pulse rounded-3xl bg-muted" />;
  if (error || !data) return null;

  return (
    <section id="learning-growth" className="scroll-mt-24 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            <h2 className="text-2xl font-bold">Hành trình phát triển</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">XP ghi nhận nỗ lực học tập, tách biệt hoàn toàn với điểm số học thuật.</p>
        </div>
        <Button type="button" size="sm" onClick={() => setFormOpen((open) => !open)}>
          {formOpen ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {formOpen ? "Đóng" : "Đặt mục tiêu tuần"}
        </Button>
      </div>

      {formOpen && (
        <Card className="border-violet-200 bg-violet-50/40 dark:border-violet-900 dark:bg-violet-950/15">
          <CardContent className="p-4 md:p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_120px_150px_150px]">
              <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
                Tên mục tiêu
                <input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-violet-400/40" />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
                Chỉ số
                <select value={metric} onChange={(event) => setMetric(event.target.value as keyof typeof METRICS)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-violet-400/40">
                  {Object.entries(METRICS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
                Mục tiêu
                <input type="number" min={1} max={10000} value={targetValue} onChange={(event) => setTargetValue(Math.max(1, Number(event.target.value) || 1))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-violet-400/40" />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
                Bắt đầu
                <input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-violet-400/40" />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
                Kết thúc
                <input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-violet-400/40" />
              </label>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              {formError && <p className="mr-auto text-xs font-medium text-red-600">{formError}</p>}
              <Button type="button" disabled={saving || title.trim().length < 3 || !periodStart || !periodEnd} onClick={() => void createGoal()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Lưu mục tiêu
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 text-white shadow-xl shadow-violet-500/15">
          <CardContent className="relative p-6">
            <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <div className="flex items-start justify-between">
                <div><p className="text-sm font-semibold text-white/70">Cấp độ hiện tại</p><p className="mt-1 text-5xl font-black">Lv.{data.xp.level}</p></div>
                <div className="rounded-2xl bg-white/15 p-3"><Award className="h-7 w-7 text-amber-300" /></div>
              </div>
              <p className="mt-6 text-2xl font-black">{data.xp.total} XP</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-amber-300" style={{ width: `${data.xp.progressPercent}%` }} /></div>
              <p className="mt-2 text-xs text-white/70">{data.xp.currentLevelXp}/{data.xp.nextLevelXp} XP để lên cấp tiếp theo</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Flag className="h-4 w-4 text-primary" /> Mục tiêu cá nhân</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {activeGoals.length === 0 ? (
              <div className="py-6 text-center"><Target className="mx-auto mb-2 h-8 w-8 text-muted-foreground/35" /><p className="text-sm text-muted-foreground">Đặt một mục tiêu nhỏ để bắt đầu tuần mới.</p></div>
            ) : activeGoals.slice(0, 4).map((goal) => {
              const config = METRICS[goal.metric as keyof typeof METRICS] ?? METRICS.homework_completed;
              const GoalIcon = config.icon;
              return (
                <div key={goal.id} className="rounded-xl border border-border p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary"><GoalIcon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="text-sm font-bold">{goal.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{config.label} · đến {new Date(goal.periodEnd).toLocaleDateString("vi-VN")}</p></div>
                        {goal.status === "completed" ? <Badge className="border-0 bg-emerald-100 text-emerald-700">Hoàn thành</Badge> : <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Hủy mục tiêu" onClick={() => void cancelGoal(goal.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                      </div>
                      <ProgressBar value={goal.progressPercent} size="sm" className="mt-3" />
                      <p className="mt-1.5 text-right text-xs font-semibold text-primary">{goal.currentValue}/{goal.targetValue} {config.suffix}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Award className="h-4 w-4 text-amber-500" /> Huy hiệu đã nhận</CardTitle></CardHeader>
          <CardContent>
            {data.badges.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Hoàn thành hoạt động để mở khóa huy hiệu đầu tiên.</p> : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.badges.slice(0, 6).map((badge) => (
                  <div key={badge.id} className="flex items-start gap-3 rounded-xl bg-amber-50/70 p-3 dark:bg-amber-950/15">
                    <div className="rounded-full bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/40"><Award className="h-4 w-4" /></div>
                    <div><p className="text-sm font-bold">{badge.title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{badge.description}</p></div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><BrainCircuit className="h-4 w-4 text-violet-600" /> Nội dung nên ôn lại</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.weakTopics.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Chưa có chủ đề yếu từ các bài kiểm tra.</p> : data.weakTopics.slice(0, 4).map((topic) => (
              <div key={topic.id} className="rounded-xl border border-border p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-sm font-bold">{topic.topic}</p><p className="mt-0.5 text-xs text-muted-foreground">Sai {topic.incorrectQuestions}/{topic.totalQuestions} câu{topic.lastExamTitle ? ` · ${topic.lastExamTitle}` : ""}</p></div>
                  <Badge variant="outline">Nắm vững {Math.round(topic.masteryPercent)}%</Badge>
                </div>
                {topic.recommendedResources.length > 0 && <div className="mt-3 flex flex-wrap gap-2">
                  {topic.recommendedResources.slice(0, 3).map((resource, index) => (
                    <Link key={`${resource.lessonId}-${index}`} href={`/student/classes/${encodeURIComponent(topic.classId)}?tab=curriculum`} className="rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 dark:bg-violet-950/30 dark:text-violet-300">{resource.title ?? "Mở nội dung ôn tập"}</Link>
                  ))}
                </div>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
