"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PortalLayout from "@/components/layout/PortalLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar, SectionHeader } from "@/components/shared";
import StudentScopeBar, {
  ALL_STUDENT_SCOPE,
  classMatchesStudentScope,
  useStudentWorkspaceScope,
} from "@/components/student/StudentScopeBar";
import { useStudentContext } from "@/hooks/useStudentContext";
import { getExamResult, getStudentCurriculum, type StoredExamScore } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronDown,
  CircleGauge,
  ExternalLink,
  GraduationCap,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ResultSource = "teacher" | "online";
type TimeRange = "all" | "30" | "90" | "365";

type ResultRecord = StoredExamScore & {
  source: ResultSource;
  reviewHref?: string;
};

type LearningGoal = {
  id: string;
  classId: string | null;
  title: string;
  metric: string;
  targetValue: number;
  currentValue: number;
  progressPercent: number;
  periodStart: string;
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
  goals: LearningGoal[];
  weakTopics: WeakTopic[];
};

const RANGE_LABELS: Record<TimeRange, string> = {
  all: "Toàn bộ thời gian",
  "30": "30 ngày gần đây",
  "90": "90 ngày gần đây",
  "365": "12 tháng gần đây",
};

function norm(score: { score: number; max_score: number }) {
  if (!score.max_score) return 0;
  return Number(((score.score / score.max_score) * 10).toFixed(1));
}

function gradeLabel(score10: number): { label: string; variant: "success" | "info" | "warning" | "default" | "destructive" } {
  if (score10 >= 9) return { label: "Xuất sắc", variant: "success" };
  if (score10 >= 8) return { label: "Giỏi", variant: "info" };
  if (score10 >= 6.5) return { label: "Khá", variant: "default" };
  if (score10 >= 5) return { label: "Trung bình", variant: "warning" };
  return { label: "Cần cố gắng", variant: "destructive" };
}

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function fetchGrowth() {
  const response = await fetch("/api/student/learning-growth", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("growth_unavailable");
  return response.json() as Promise<GrowthPayload>;
}

function ResultsLoadingState({ studentName }: { studentName: string }) {
  return (
    <PortalLayout role="student" userName={studentName} pageTitle="Điểm & phân tích">
      <div className="mx-auto max-w-6xl space-y-5" role="status" aria-live="polite">
        <div className="h-16 animate-pulse rounded-2xl bg-muted" />
        <div className="h-20 animate-pulse rounded-2xl bg-muted/80" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-muted/70" />)}
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="h-96 animate-pulse rounded-2xl bg-muted/60" />
          <div className="h-96 animate-pulse rounded-2xl bg-muted/50" />
        </div>
        <span className="sr-only">Đang tải kết quả học tập…</span>
      </div>
    </PortalLayout>
  );
}

export default function StudentScoresPage() {
  const { studentId, studentName, myClasses, ready } = useStudentContext();
  const { scope, setScope } = useStudentWorkspaceScope(myClasses);
  const membershipKey = myClasses.map((item) => item.id).join(",");
  const [storedScores, setStoredScores] = useState<ResultRecord[]>([]);
  const [onlineScores, setOnlineScores] = useState<ResultRecord[]>([]);
  const [growth, setGrowth] = useState<GrowthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [growthUnavailable, setGrowthUnavailable] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [showAll, setShowAll] = useState(false);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [goalTarget, setGoalTarget] = useState(8);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!studentId) {
      setStoredScores([]);
      setOnlineScores([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setGrowthUnavailable(false);

    void (async () => {
      try {
        const storedRequest = fetch(`/api/exam-scores?student_ref=${encodeURIComponent(studentId)}`, {
          cache: "no-store",
          credentials: "same-origin",
        }).then(async (response) => {
          if (!response.ok) throw new Error("scores_unavailable");
          return response.json() as Promise<StoredExamScore[]>;
        });

        const classResultsRequest = Promise.all(myClasses.map(async (cls) => {
          const chapters = await getStudentCurriculum(cls.id);
          const examLessons = chapters
            .flatMap((chapter) => chapter.sessions)
            .flatMap((session) => session.lessons)
            .filter((lesson) => lesson.type === "exam");
          const results = await Promise.all(examLessons.map((lesson) => (
            getExamResult(cls.id, lesson.id, studentId).catch(() => null)
          )));
          return examLessons.flatMap<ResultRecord>((lesson, index) => {
            const result = results[index];
            if (!result) return [];
            const manualScore = Object.values(result.manual_scores ?? {}).reduce((sum, value) => sum + value, 0);
            return [{
              id: `tutorhub_exam_result_${cls.id}_${lesson.id}_${studentId}`,
              student_id: studentId,
              class_id: cls.id,
              exam_name: lesson.title ?? "Bài kiểm tra trực tuyến",
              score: result.score + manualScore,
              max_score: result.total,
              exam_date: result.submitted_at,
              source: "online",
              reviewHref: `/student/classes/${encodeURIComponent(cls.id)}/exam/${encodeURIComponent(lesson.id)}`,
            }];
          });
        }));

        const growthRequest = fetchGrowth().catch(() => null);
        const [stored, classResults, growthPayload] = await Promise.all([
          storedRequest,
          classResultsRequest,
          growthRequest,
        ]);
        if (cancelled) return;
        setStoredScores(stored.map((score) => ({ ...score, source: "teacher" })));
        setOnlineScores(classResults.flat());
        setGrowth(growthPayload);
        setGrowthUnavailable(!growthPayload);
      } catch {
        if (!cancelled) {
          setLoadError("Không thể tải đầy đủ kết quả học tập. Vui lòng thử lại.");
          setStoredScores([]);
          setOnlineScores([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [membershipKey, myClasses, ready, reloadVersion, studentId]);

  useEffect(() => {
    setShowAll(false);
  }, [scope.classId, scope.teacherId, timeRange]);

  const allScores = useMemo(() => {
    const combined = [...storedScores, ...onlineScores];
    const seen = new Set<string>();
    return combined
      .filter((score) => {
        const key = `${score.class_id}:${score.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime());
  }, [onlineScores, storedScores]);

  const visibleClasses = useMemo(
    () => myClasses.filter((cls) => classMatchesStudentScope(cls, scope)),
    [myClasses, scope],
  );
  const visibleClassIds = useMemo(() => new Set(visibleClasses.map((cls) => cls.id)), [visibleClasses]);
  const filtered = useMemo(() => {
    const cutoff = timeRange === "all" ? null : Date.now() - Number(timeRange) * 86_400_000;
    return allScores.filter((score) => (
      visibleClassIds.has(score.class_id)
      && (cutoff === null || new Date(score.exam_date).getTime() >= cutoff)
    ));
  }, [allScores, timeRange, visibleClassIds]);
  const displayed = showAll ? filtered : filtered.slice(0, 8);

  const avgScore = filtered.length
    ? Number((filtered.reduce((sum, score) => sum + norm(score), 0) / filtered.length).toFixed(1))
    : null;
  const highestScore = filtered.length ? Math.max(...filtered.map(norm)) : null;
  const lowestScore = filtered.length ? Math.min(...filtered.map(norm)) : null;
  const latestScore = filtered[0] ? norm(filtered[0]) : null;
  const previousScore = filtered[1] ? norm(filtered[1]) : null;
  const trendDelta = latestScore !== null && previousScore !== null
    ? Number((latestScore - previousScore).toFixed(1))
    : null;

  const trendData = [...filtered]
    .sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime())
    .slice(-10)
    .map((score) => ({
      id: score.id,
      label: shortDate(score.exam_date),
      score: norm(score),
      title: score.exam_name,
    }));

  const classBreakdown = visibleClasses.flatMap((cls) => {
    const records = filtered.filter((score) => score.class_id === cls.id);
    if (records.length === 0) return [];
    const average = Number((records.reduce((sum, score) => sum + norm(score), 0) / records.length).toFixed(1));
    return [{ cls, records: records.length, average, best: Math.max(...records.map(norm)) }];
  });
  const classesWithoutScores = Math.max(0, visibleClasses.length - classBreakdown.length);

  const weakTopics = useMemo(() => (
    growth?.weakTopics
      .filter((topic) => visibleClassIds.has(topic.classId))
      .sort((a, b) => a.masteryPercent - b.masteryPercent)
      .slice(0, 4) ?? []
  ), [growth, visibleClassIds]);

  const goalScopeClassId = scope.classId !== ALL_STUDENT_SCOPE ? scope.classId : null;
  const isTeacherAggregateScope = scope.teacherId !== ALL_STUDENT_SCOPE && scope.classId === ALL_STUDENT_SCOPE;
  const activeScoreGoal = isTeacherAggregateScope ? undefined : growth?.goals
    .filter((goal) => (
      goal.metric === "average_score"
      && (goal.status === "active" || (goal.status === "completed" && goal.periodEnd >= dateOffset(0)))
      && goal.classId === goalScopeClassId
    ))
    .sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || b.periodEnd.localeCompare(a.periodEnd))[0];

  async function createScoreGoal() {
    const target = Math.min(10, Math.max(1, Math.round(goalTarget * 10) / 10));
    setSavingGoal(true);
    setGoalError("");
    try {
      const response = await fetch("/api/student/learning-growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          title: `Đạt điểm trung bình ${target}/10 trong tuần`,
          metric: "average_score",
          targetValue: target,
          periodStart: dateOffset(0),
          periodEnd: dateOffset(6),
          classId: goalScopeClassId,
        }),
      });
      if (!response.ok) throw new Error("goal_create_failed");
      setGrowth(await fetchGrowth());
      setGrowthUnavailable(false);
      setGoalFormOpen(false);
    } catch {
      setGoalError("Chưa thể lưu mục tiêu. Vui lòng thử lại.");
    } finally {
      setSavingGoal(false);
    }
  }

  if (!ready || loading) return <ResultsLoadingState studentName={studentName} />;

  return (
    <PortalLayout role="student" userName={studentName} pageTitle="Điểm & phân tích">
      <div className="mx-auto max-w-6xl space-y-5 pb-10">
        <SectionHeader
          title="Điểm & phân tích học tập"
          subtitle="Xem kết quả, nhận diện nội dung còn yếu và chọn hành động cải thiện tiếp theo."
        />

        <StudentScopeBar classes={myClasses} scope={scope} onChange={setScope} />

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-primary" />Khoảng thời gian</div>
          <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Lọc kết quả theo thời gian">
            {(Object.keys(RANGE_LABELS) as TimeRange[]).map((range) => (
              <button key={range} type="button" aria-pressed={timeRange === range} onClick={() => setTimeRange(range)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition ${timeRange === range ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>{RANGE_LABELS[range]}</button>
            ))}
          </div>
        </div>

        {loadError && (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" /><p>{loadError}</p></div>
            <Button type="button" size="sm" variant="outline" onClick={() => setReloadVersion((value) => value + 1)}><RefreshCw className="h-3.5 w-3.5" />Thử lại</Button>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/15">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-white/75">Điểm trung bình</p><p className="mt-2 text-4xl font-black">{avgScore ?? "—"}{avgScore !== null && <span className="text-lg font-normal text-white/65">/10</span>}</p></div><div className="rounded-xl bg-white/15 p-2.5"><Trophy className="h-5 w-5" /></div></div>
              <p className="mt-3 text-xs text-white/70">{filtered.length > 0 ? `${filtered.length} kết quả · cao nhất ${highestScore} · thấp nhất ${lowestScore}` : "Chưa có kết quả trong phạm vi này"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-muted-foreground">Kết quả gần nhất</p><p className="mt-2 text-3xl font-black">{latestScore ?? "—"}{latestScore !== null && <span className="text-base font-normal text-muted-foreground">/10</span>}</p></div><div className={`rounded-xl p-2.5 ${trendDelta !== null && trendDelta < 0 ? "bg-rose-100 text-rose-600 dark:bg-rose-950" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-950"}`}>{trendDelta !== null && trendDelta < 0 ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}</div></div>
              <p className={`mt-3 text-xs font-medium ${trendDelta === null ? "text-muted-foreground" : trendDelta < 0 ? "text-rose-600" : trendDelta > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>{trendDelta === null ? "Cần ít nhất 2 kết quả để so sánh" : trendDelta === 0 ? "Không đổi so với bài trước" : `${trendDelta > 0 ? "+" : ""}${trendDelta} điểm so với bài trước`}</p>
            </CardContent>
          </Card>

          <Card className="border-amber-200/70 dark:border-amber-900/60">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-1.5 text-sm font-semibold"><Target className="h-4 w-4 text-amber-500" />Mục tiêu điểm theo phạm vi</p><p className="mt-1 text-xs text-muted-foreground">Theo tuần · đồng bộ với giáo viên và phụ huynh</p></div>{activeScoreGoal?.status === "completed" && <Badge className="border-0 bg-emerald-100 text-emerald-700">Đã đạt</Badge>}</div>
              {activeScoreGoal ? (
                <div className="mt-4"><div className="mb-2 flex items-end justify-between"><p className="text-2xl font-black">{activeScoreGoal.currentValue}<span className="text-sm font-normal text-muted-foreground">/{activeScoreGoal.targetValue}</span></p><span className="text-xs font-bold text-primary">{activeScoreGoal.progressPercent}%</span></div><ProgressBar value={activeScoreGoal.progressPercent} size="sm" showValue={false} /><Link href="/student#learning-growth" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Quản lý mục tiêu<ArrowRight className="h-3 w-3" /></Link></div>
              ) : goalFormOpen ? (
                <div className="mt-3"><label className="text-xs font-semibold text-muted-foreground">Điểm trung bình muốn đạt<input type="number" min={1} max={10} step={0.1} value={goalTarget} onChange={(event) => setGoalTarget(Number(event.target.value) || 1)} className="mt-1.5 h-9 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-400/30" /></label>{goalError && <p className="mt-2 text-xs text-red-600">{goalError}</p>}<div className="mt-3 flex gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setGoalFormOpen(false)}>Hủy</Button><Button type="button" size="sm" disabled={savingGoal} onClick={() => void createScoreGoal()}>{savingGoal && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Lưu mục tiêu</Button></div></div>
              ) : isTeacherAggregateScope ? (
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Chọn một lớp cụ thể để đặt mục tiêu được tính đúng theo phạm vi.</p>
              ) : (
                <Button type="button" size="sm" variant="outline" className="mt-4" disabled={growthUnavailable} onClick={() => setGoalFormOpen(true)}><Target className="h-3.5 w-3.5" />{growthUnavailable ? "Chưa thể tải mục tiêu" : "Đặt mục tiêu điểm"}</Button>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 space-y-3" aria-labelledby="score-results-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 id="score-results-title" className="text-lg font-bold">Kết quả bài kiểm tra</h2><p className="text-xs text-muted-foreground">Chọn một bài trực tuyến để xem đáp án, nhận xét và làm lại.</p></div>
              <Badge variant="outline">{filtered.length} kết quả</Badge>
            </div>

            <Card className="overflow-hidden">
              <div className="hidden grid-cols-12 gap-3 border-b border-border bg-muted/30 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:grid">
                <div className="col-span-5">Bài kiểm tra</div><div className="col-span-2 text-center">Ngày</div><div className="col-span-2 text-center">Điểm</div><div className="col-span-3 text-right">Kết quả</div>
              </div>
              {filtered.length === 0 ? (
                <CardContent className="py-14 text-center"><GraduationCap className="mx-auto h-10 w-10 text-muted-foreground/25" /><p className="mt-3 text-sm font-semibold">Chưa có kết quả trong phạm vi này</p><p className="mt-1 text-xs text-muted-foreground">Hãy thử chọn khoảng thời gian khác hoặc hoàn thành bài kiểm tra đầu tiên.</p><Button asChild size="sm" variant="outline" className="mt-4"><Link href="/student/homework">Mở bài tập<ArrowRight className="h-3.5 w-3.5" /></Link></Button></CardContent>
              ) : (
                <div className="divide-y divide-border/60">
                  {displayed.map((score) => {
                    const cls = myClasses.find((item) => item.id === score.class_id);
                    const score10 = norm(score);
                    const grade = gradeLabel(score10);
                    return (
                      <article key={`${score.class_id}:${score.id}`} className="p-4 transition hover:bg-muted/20">
                        <div className="grid gap-3 md:grid-cols-12 md:items-center">
                          <div className="min-w-0 md:col-span-5"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: cls?.color ?? "var(--primary)" }}><GraduationCap className="h-4 w-4" /></div><div className="min-w-0"><h3 className="truncate text-sm font-bold">{score.exam_name}</h3><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{cls?.class_name ?? "Lớp học"}{cls?.tutor_name ? ` · ${cls.tutor_name}` : ""}</p><Badge variant="outline" className="mt-1.5 px-1.5 py-0 text-[9px]">{score.source === "online" ? "Trực tuyến" : "Giáo viên nhập"}</Badge></div></div></div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground md:col-span-2 md:block md:text-center"><span className="md:hidden">Ngày kiểm tra</span><span>{formatDate(score.exam_date)}</span></div>
                          <div className="flex items-center justify-between md:col-span-2 md:block md:text-center"><span className="text-xs text-muted-foreground md:hidden">Điểm</span><span className={`text-lg font-black ${score10 >= 8 ? "text-emerald-600" : score10 < 5 ? "text-rose-600" : "text-foreground"}`}>{score.score}<span className="text-xs font-normal text-muted-foreground">/{score.max_score}</span></span></div>
                          <div className="flex items-center justify-between gap-2 md:col-span-3 md:justify-end"><Badge variant={grade.variant} className="text-[10px]">{grade.label}</Badge>{score.reviewHref ? <Button asChild size="sm" variant="outline"><Link href={score.reviewHref}>Xem phân tích<ExternalLink className="h-3.5 w-3.5" /></Link></Button> : <span className="text-[10px] text-muted-foreground">Kết quả từ giáo viên</span>}</div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </Card>

            {filtered.length > 8 && (
              <Button type="button" variant="outline" className="w-full" onClick={() => setShowAll((value) => !value)}><ChevronDown className={`h-4 w-4 transition ${showAll ? "rotate-180" : ""}`} />{showAll ? "Thu gọn" : `Xem thêm ${filtered.length - 8} kết quả`}</Button>
            )}
          </section>

          <aside className="space-y-4" aria-label="Phân tích kết quả">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><CircleGauge className="h-4 w-4 text-primary" />Xu hướng điểm</CardTitle></CardHeader>
              <CardContent className="pt-2">
                {trendData.length >= 2 ? (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 208 }}>
                      <LineChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} formatter={(value) => [`${value}/10`, "Điểm"]} labelFormatter={(_, payload) => payload?.[0]?.payload?.title ?? "Bài kiểm tra"} />
                        <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--primary))" }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div className="py-8 text-center"><TrendingUp className="mx-auto h-8 w-8 text-muted-foreground/25" /><p className="mt-2 text-xs text-muted-foreground">Cần ít nhất 2 kết quả để vẽ xu hướng.</p></div>}
              </CardContent>
            </Card>

            <Card className="border-violet-200/70 dark:border-violet-900/60">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><BrainCircuit className="h-4 w-4 text-violet-600" />Nội dung cần cải thiện</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {growthUnavailable ? (
                  <div className="py-5 text-center"><AlertCircle className="mx-auto h-7 w-7 text-muted-foreground/30" /><p className="mt-2 text-xs text-muted-foreground">Chưa thể tải phân tích điểm yếu.</p></div>
                ) : weakTopics.length === 0 ? (
                  <div className="py-5 text-center"><Check className="mx-auto h-7 w-7 text-emerald-500/50" /><p className="mt-2 text-xs text-muted-foreground">Chưa phát hiện chủ đề yếu trong phạm vi này.</p></div>
                ) : weakTopics.map((topic) => (
                  <div key={topic.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-bold">{topic.topic}</p><p className="mt-0.5 text-[11px] text-muted-foreground">Sai {topic.incorrectQuestions}/{topic.totalQuestions} câu{topic.lastExamTitle ? ` · ${topic.lastExamTitle}` : ""}</p></div><Badge variant="outline" className="shrink-0 text-[9px]">Nắm vững {Math.round(topic.masteryPercent)}%</Badge></div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(0, Math.min(100, topic.masteryPercent))}%` }} /></div>
                    {topic.recommendedResources[0] && <Link href={`/student/classes/${encodeURIComponent(topic.classId)}?tab=curriculum`} className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300"><Sparkles className="h-3 w-3" />Ôn: {topic.recommendedResources[0].title ?? "Nội dung được đề xuất"}<ArrowRight className="h-3 w-3" /></Link>}
                  </div>
                ))}
              </CardContent>
            </Card>

            {classBreakdown.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><BookOpen className="h-4 w-4 text-primary" />Theo từng lớp</CardTitle></CardHeader>
                <CardContent className="space-y-4 pt-0">
                  {classBreakdown.map(({ cls, records, average, best }) => (
                    <div key={cls.id} className="space-y-1.5"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{cls.class_name}</p><p className="text-[11px] text-muted-foreground">{records} bài · cao nhất {best}</p></div><p className="shrink-0 text-sm font-bold text-primary">{average}/10</p></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${average * 10}%` }} /></div></div>
                  ))}
                  {classesWithoutScores > 0 && <p className="border-t border-border pt-3 text-[11px] text-muted-foreground">{classesWithoutScores} lớp chưa có kết quả — không tính là 0 điểm.</p>}
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      </div>
    </PortalLayout>
  );
}
