"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BookOpen,
  BookOpenCheck,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  FileClock,
  GraduationCap,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  UserRoundPlus,
  X,
  XCircle,
} from "lucide-react";
import PortalLayout from "@/components/layout/PortalLayout";
import StudentNotes from "@/components/teacher/students/StudentNotes";
import { StudentGuardianPanel } from "@/components/guardians/StudentGuardianManager";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/shared";
import { useTeacherContext } from "@/hooks/useTeacherContext";
import {
  deleteExamScore,
  saveExamScore,
  updateExamScore,
} from "@/lib/storage";
import {
  fetchTeacherStudentProfile,
  type StudentActiveGoal,
  type StudentClassMetrics,
  type StudentScoreRecord,
  type StudentWorkspaceProfile,
  type StudentWorkspaceTab,
} from "@/lib/teacher-student-workspace";
import { toLocalDateKey } from "@/lib/utils";

const TAB_ITEMS: { value: StudentWorkspaceTab; label: string; Icon: React.ElementType }[] = [
  { value: "overview", label: "Tổng quan", Icon: Sparkles },
  { value: "scores", label: "Học tập & điểm", Icon: TrendingUp },
  { value: "attendance", label: "Chuyên cần", Icon: CalendarCheck2 },
  { value: "homework", label: "Bài tập", Icon: BookOpenCheck },
  { value: "notes", label: "Ghi chú", Icon: MessageSquare },
  { value: "family", label: "Gia đình", Icon: UserRoundPlus },
];

const ATTENDANCE = {
  present: { label: "Có mặt", Icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" },
  late: { label: "Đi trễ", Icon: Clock, className: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300" },
  absent: { label: "Vắng", Icon: XCircle, className: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" },
  excused: { label: "Có phép", Icon: AlertTriangle, className: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300" },
} as const;

const GOAL_METRICS = [
  { value: "homework_completed", label: "Số bài tập hoàn thành", suffix: "bài" },
  { value: "average_score", label: "Điểm trung bình", suffix: "/10" },
  { value: "attendance_rate", label: "Tỷ lệ chuyên cần", suffix: "%" },
  { value: "lessons_completed", label: "Nội dung hoàn thành", suffix: "bài" },
  { value: "xp_earned", label: "XP tích lũy", suffix: "XP" },
] as const;

function validTab(value: string | null): StudentWorkspaceTab {
  if (value === "comments") return "notes";
  if (value === "guardians") return "family";
  return TAB_ITEMS.some((item) => item.value === value) ? value as StudentWorkspaceTab : "overview";
}

function tone(value: number | null, good = 85) {
  if (value === null) return "text-muted-foreground";
  if (value >= good) return "text-emerald-600 dark:text-emerald-400";
  if (value >= good - 15) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function percentageLabel(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function ProfileSkeleton() {
  return <div className="mx-auto max-w-7xl space-y-5" role="status" aria-label="Đang tải hồ sơ học viên"><div className="h-8 w-48 animate-pulse rounded bg-muted" /><div className="h-40 animate-pulse rounded-2xl bg-muted" /><div className="h-12 animate-pulse rounded-xl bg-muted" /><div className="grid gap-4 md:grid-cols-3"><div className="h-48 animate-pulse rounded-2xl bg-muted" /><div className="h-48 animate-pulse rounded-2xl bg-muted" /><div className="h-48 animate-pulse rounded-2xl bg-muted" /></div></div>;
}

function scopedMetrics(profile: StudentWorkspaceProfile, classId: string): StudentClassMetrics {
  return classId !== "all" && profile.classMetrics[classId] ? profile.classMetrics[classId] : profile;
}

function goalDefaults(profile: StudentWorkspaceProfile, classId: string, goal?: StudentActiveGoal | null) {
  const start = toLocalDateKey(new Date());
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);
  return {
    goalId: goal?.id ?? "",
    classId: goal?.classId ?? (classId !== "all" ? classId : profile.classes[0]?.id ?? ""),
    title: goal?.title ?? "",
    metric: goal?.metric ?? "homework_completed",
    targetValue: goal?.targetValue ? String(goal.targetValue) : "",
    periodStart: start,
    periodEnd: goal?.periodEnd ?? toLocalDateKey(endDate),
  };
}

export default function StudentProfile({ studentId }: { studentId: string }) {
  const { teacherName } = useTeacherContext();
  const [profile, setProfile] = useState<StudentWorkspaceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<StudentWorkspaceTab>("overview");
  const [classId, setClassId] = useState("all");
  const [attendanceLimit, setAttendanceLimit] = useState(20);
  const [showScoreForm, setShowScoreForm] = useState(false);
  const [scoreBusy, setScoreBusy] = useState("");
  const [scoreError, setScoreError] = useState("");
  const [editingScoreId, setEditingScoreId] = useState("");
  const [scoreForm, setScoreForm] = useState({ examName: "", score: "", maxScore: "10", date: toLocalDateKey(new Date()), classId: "" });
  const [reporting, setReporting] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState("");
  const [goalForm, setGoalForm] = useState({ goalId: "", classId: "", title: "", metric: "homework_completed", targetValue: "", periodStart: "", periodEnd: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextProfile = await fetchTeacherStudentProfile(studentId);
      setProfile(nextProfile);
      setScoreForm((current) => ({ ...current, classId: current.classId || nextProfile.classes[0]?.id || "" }));
    } catch (loadError) {
      setError(loadError instanceof Error && loadError.message === "student_not_found" ? "Không tìm thấy học viên trong các lớp bạn phụ trách." : "Không thể tải hồ sơ học viên. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTab(validTab(params.get("tab")));
    setClassId(params.get("class") || "all");
    const syncFromHistory = () => {
      const current = new URLSearchParams(window.location.search);
      setTab(validTab(current.get("tab")));
      setClassId(current.get("class") || "all");
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  function updateLocation(nextTab: StudentWorkspaceTab, nextClassId = classId) {
    setTab(nextTab);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", nextTab);
    if (nextClassId === "all") params.delete("class");
    else params.set("class", nextClassId);
    window.history.pushState(null, "", `/teacher/students/${encodeURIComponent(studentId)}?${params.toString()}`);
  }

  function changeClass(nextClassId: string) {
    setClassId(nextClassId);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    if (nextClassId === "all") params.delete("class");
    else params.set("class", nextClassId);
    window.history.replaceState(null, "", `/teacher/students/${encodeURIComponent(studentId)}?${params.toString()}`);
  }

  async function submitScore(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;
    const score = Number(scoreForm.score);
    const maxScore = Number(scoreForm.maxScore);
    if (!scoreForm.examName.trim() || !scoreForm.classId || !scoreForm.date || !Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0 || score > maxScore) {
      setScoreError("Hãy nhập tên bài, lớp, ngày và điểm hợp lệ (điểm không vượt tổng điểm).");
      return;
    }
    setScoreBusy(editingScoreId || "create");
    setScoreError("");
    try {
      const record = { class_id: scoreForm.classId, exam_name: scoreForm.examName.trim(), score, max_score: maxScore, exam_date: scoreForm.date };
      if (editingScoreId) await updateExamScore(editingScoreId, record);
      else await saveExamScore({ ...record, student_id: profile.id });
      setShowScoreForm(false);
      setEditingScoreId("");
      setScoreForm((current) => ({ ...current, examName: "", score: "" }));
      await load();
    } catch {
      setScoreError("Không thể lưu điểm. Vui lòng thử lại.");
    } finally {
      setScoreBusy("");
    }
  }

  function editScore(score: StudentScoreRecord) {
    setEditingScoreId(score.id);
    setScoreForm({ examName: score.title, score: String(score.score), maxScore: String(score.maxScore), date: score.recordedAt.slice(0, 10), classId: score.classId });
    setShowScoreForm(true);
    setScoreError("");
  }

  async function removeScore(score: StudentScoreRecord) {
    if (!window.confirm(`Xóa điểm “${score.title}”? Thao tác này không thể hoàn tác.`)) return;
    setScoreBusy(score.id);
    setScoreError("");
    try {
      await deleteExamScore(score.id);
      await load();
    } catch {
      setScoreError("Không thể xóa điểm. Vui lòng thử lại.");
    } finally {
      setScoreBusy("");
    }
  }

  async function generateReport() {
    setReporting(true);
    setReportMessage("");
    try {
      const response = await fetch("/api/teacher/learning-support", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate_weekly_reports", studentId }) });
      if (!response.ok) throw new Error("failed");
      const result = await response.json() as { generated: number };
      setReportMessage(result.generated > 0 ? "Đã tạo báo cáo và gửi vào Parent Portal." : "Chưa có dữ liệu phù hợp để tạo báo cáo.");
      await load();
    } catch {
      setReportMessage("Không thể tạo báo cáo lúc này.");
    } finally {
      setReporting(false);
    }
  }

  function openGoalEditor(goal?: StudentActiveGoal | null) {
    if (!profile) return;
    setGoalForm(goalDefaults(profile, classId, goal));
    setGoalError("");
    setShowGoalForm(true);
  }

  async function saveGoal(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;
    const targetValue = Number(goalForm.targetValue);
    if (!goalForm.title.trim() || !goalForm.classId || !Number.isFinite(targetValue) || targetValue <= 0 || !goalForm.periodStart || !goalForm.periodEnd) {
      setGoalError("Hãy nhập đầy đủ tên, lớp, chỉ số, mục tiêu và thời gian.");
      return;
    }
    setGoalSaving(true);
    setGoalError("");
    try {
      const response = await fetch("/api/teacher/students", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_goal", studentId, ...goalForm, targetValue }) });
      if (!response.ok) throw new Error("failed");
      setShowGoalForm(false);
      await load();
    } catch {
      setGoalError("Không thể lưu mục tiêu. Kiểm tra thời gian tối đa 90 ngày rồi thử lại.");
    } finally {
      setGoalSaving(false);
    }
  }

  if (loading) return <PortalLayout role="teacher" userName={teacherName || "Giáo viên"} pageTitle="Hồ sơ học viên"><ProfileSkeleton /></PortalLayout>;
  if (error || !profile) return <PortalLayout role="teacher" userName={teacherName || "Giáo viên"} pageTitle="Hồ sơ học viên"><div className="mx-auto max-w-xl py-20 text-center"><AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" /><h1 className="text-lg font-bold">Chưa mở được hồ sơ</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p><div className="mt-5 flex justify-center gap-2"><Button asChild variant="outline"><Link href="/teacher/students">Về danh sách</Link></Button><Button type="button" onClick={() => void load()}>Thử lại</Button></div></div></PortalLayout>;

  const metrics = scopedMetrics(profile, classId);
  const classMap = new Map(profile.classes.map((item) => [item.id, item]));
  const scores = profile.scores.filter((item) => classId === "all" || item.classId === classId);
  const attendance = profile.attendance.filter((item) => classId === "all" || item.classId === classId);
  const homework = profile.homework.filter((item) => classId === "all" || item.classId === classId);
  const chartData = [...scores].slice(0, 10).reverse().map((item) => ({ name: new Date(item.recordedAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }), score: item.value10, title: item.title }));
  const present = attendance.filter((item) => item.status === "present").length;
  const late = attendance.filter((item) => item.status === "late").length;
  const absent = attendance.filter((item) => item.status === "absent").length;
  const excused = attendance.filter((item) => item.status === "excused").length;
  const selectedClassId = classId !== "all" ? classId : profile.classes[0]?.id ?? "";

  return (
    <PortalLayout role="teacher" userName={teacherName || "Giáo viên"} pageTitle={profile.fullName}>
      <main className="mx-auto max-w-7xl space-y-5">
        <Link href={classId === "all" ? "/teacher/students" : `/teacher/students?class=${encodeURIComponent(classId)}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Quay lại danh sách</Link>

        <Card className="overflow-hidden border-border/70"><CardContent className="p-5 md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-4"><UserAvatar name={profile.fullName} src={profile.avatarUrl} size="xl" className="ring-4 ring-primary/10" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-black md:text-2xl">{profile.fullName}</h1>{profile.risk ? <Badge variant="destructive">Cần hỗ trợ</Badge> : <Badge variant="success">Đang ổn định</Badge>}</div><p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><GraduationCap className="h-4 w-4" />{profile.grade || "Chưa có khối"} · {profile.school || "Chưa có trường"}</p><div className="mt-2 flex flex-wrap gap-1.5">{profile.classes.map((item) => <Badge key={item.id} variant="outline" className="gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}{item.package ? ` · ${item.package}` : ""}</Badge>)}</div></div></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[470px]">{[
              { label: "Điểm TB", value: metrics.averageScore?.toFixed(1) ?? "—", className: tone(metrics.averageScore === null ? null : metrics.averageScore * 10) },
              { label: "Chuyên cần", value: percentageLabel(metrics.attendanceRate), className: tone(metrics.attendanceRate) },
              { label: "Đúng giờ", value: percentageLabel(metrics.punctualityRate), className: tone(metrics.punctualityRate) },
              { label: "BT đúng hạn", value: percentageLabel(metrics.homeworkOnTimeRate), className: tone(metrics.homeworkOnTimeRate) },
            ].map((item) => <div key={item.label} className="rounded-xl bg-muted/55 px-3 py-3 text-center"><p className={`text-xl font-black ${item.className}`}>{item.value}</p><p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{item.label}</p></div>)}</div>
          </div>
          <div className="mt-5 flex flex-col gap-3 border-t border-border/60 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <select aria-label="Phạm vi lớp học" value={classId} onChange={(event) => changeClass(event.target.value)} className="h-9 rounded-xl border border-input bg-background px-3 text-sm"><option value="all">Tổng hợp tất cả lớp</option>{profile.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link href={`/teacher/homework?action=create&class=${encodeURIComponent(selectedClassId)}&student=${encodeURIComponent(profile.id)}`}><BookOpen className="mr-1.5 h-3.5 w-3.5" />Giao bài</Link></Button><Button asChild size="sm" variant="outline"><Link href={`/teacher/announcements?class=${encodeURIComponent(selectedClassId)}&student=${encodeURIComponent(profile.id)}`}><Send className="mr-1.5 h-3.5 w-3.5" />Gửi thông báo</Link></Button><Button type="button" size="sm" variant="outline" onClick={() => openGoalEditor(profile.activeGoal)}><Target className="mr-1.5 h-3.5 w-3.5" />{profile.activeGoal ? "Điều chỉnh mục tiêu" : "Tạo mục tiêu"}</Button><Button type="button" size="sm" disabled={reporting} onClick={() => void generateReport()}>{reporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileClock className="mr-1.5 h-3.5 w-3.5" />}Báo cáo tuần</Button></div>
          </div>
          {reportMessage && <p className="mt-3 text-right text-xs font-medium text-primary" role="status">{reportMessage}</p>}
        </CardContent></Card>

        {showGoalForm && <Card className="border-primary/30 bg-primary/5"><CardContent className="p-5"><form onSubmit={saveGoal} className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="font-bold">{goalForm.goalId ? "Điều chỉnh mục tiêu" : "Tạo mục tiêu học tập"}</h2><p className="mt-1 text-xs text-muted-foreground">Giáo viên, học viên và phụ huynh cùng theo dõi tiến độ trên server.</p></div><Button type="button" size="icon" variant="ghost" aria-label="Đóng form mục tiêu" onClick={() => setShowGoalForm(false)}><X className="h-4 w-4" /></Button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><label className="space-y-1 text-xs font-medium text-muted-foreground xl:col-span-2">Tên mục tiêu<input value={goalForm.title} onChange={(event) => setGoalForm((current) => ({ ...current, title: event.target.value }))} placeholder="VD: Hoàn thành 3 bài trong tuần" className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground" /></label><label className="space-y-1 text-xs font-medium text-muted-foreground">Lớp<select value={goalForm.classId} onChange={(event) => setGoalForm((current) => ({ ...current, classId: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground">{profile.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="space-y-1 text-xs font-medium text-muted-foreground">Chỉ số<select value={goalForm.metric} onChange={(event) => setGoalForm((current) => ({ ...current, metric: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground">{GOAL_METRICS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="space-y-1 text-xs font-medium text-muted-foreground">Mục tiêu<input type="number" min="0.1" step="0.1" value={goalForm.targetValue} onChange={(event) => setGoalForm((current) => ({ ...current, targetValue: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground" /></label><label className="space-y-1 text-xs font-medium text-muted-foreground">Bắt đầu<input type="date" value={goalForm.periodStart} onChange={(event) => setGoalForm((current) => ({ ...current, periodStart: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground" /></label><label className="space-y-1 text-xs font-medium text-muted-foreground">Kết thúc<input type="date" value={goalForm.periodEnd} onChange={(event) => setGoalForm((current) => ({ ...current, periodEnd: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground" /></label></div>{goalError && <p className="text-sm text-red-600" role="alert">{goalError}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setShowGoalForm(false)}>Hủy</Button><Button type="submit" disabled={goalSaving}>{goalSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Lưu mục tiêu</Button></div></form></CardContent></Card>}

        <Tabs.Root value={tab} onValueChange={(value) => updateLocation(value as StudentWorkspaceTab)}>
          <Tabs.List aria-label="Các phần trong hồ sơ học viên" className="flex gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1">
            {TAB_ITEMS.map(({ value, label, Icon }) => <Tabs.Trigger key={value} value={value} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-muted-foreground outline-none transition data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:ring-2 focus-visible:ring-ring"><Icon className="h-3.5 w-3.5" />{label}</Tabs.Trigger>)}
          </Tabs.List>

          <Tabs.Content value="overview" className="mt-5 space-y-4 outline-none">
            {profile.risk && <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"><CardContent className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start"><div className="rounded-xl bg-red-100 p-2.5 text-red-600 dark:bg-red-950"><AlertTriangle className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-black">Việc cần ưu tiên</h2><Badge variant="destructive">{profile.risk.priority === "high" ? "Ưu tiên cao" : profile.risk.priority === "medium" ? "Cần theo dõi" : "Lưu ý"}</Badge></div><div className="mt-3 grid gap-2 md:grid-cols-2">{profile.risk.signals.map((signal) => <button key={`${signal.type}-${signal.title}`} type="button" onClick={() => updateLocation(signal.type === "homework" ? "homework" : signal.type === "absence" || signal.type === "late" ? "attendance" : "scores")} className="rounded-xl border border-red-200/70 bg-background/70 p-3 text-left hover:border-red-400"><p className="text-sm font-bold">{signal.title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{signal.detail}</p></button>)}</div></div></div></CardContent></Card>}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[
              { label: "Điểm trung bình", value: metrics.averageScore?.toFixed(1) ?? "—", sub: `${metrics.assessmentCount} bài đánh giá`, pct: metrics.averageScore === null ? 0 : metrics.averageScore * 10 },
              { label: "Chuyên cần", value: percentageLabel(metrics.attendanceRate), sub: `${metrics.absences} vắng · ${metrics.lates} trễ`, pct: metrics.attendanceRate ?? 0 },
              { label: "Bài đúng hạn", value: percentageLabel(metrics.homeworkOnTimeRate), sub: `${metrics.missingHomework} thiếu · ${metrics.lateHomework} trễ`, pct: metrics.homeworkOnTimeRate ?? 0 },
              { label: "Điểm kinh nghiệm", value: `${profile.xp.total} XP`, sub: `Cấp ${profile.xp.level} · ${profile.badges.length} huy hiệu`, pct: profile.xp.progressPercent },
            ].map((item) => <Card key={item.label}><CardContent className="space-y-3 p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{item.label}</p><p className="text-3xl font-black">{item.value}</p><ProgressBar value={item.pct} size="sm" /><p className="text-xs text-muted-foreground">{item.sub}</p></CardContent></Card>)}</div>

            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <Card><CardHeader><CardTitle className="flex items-center justify-between gap-3 text-base"><span className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" />Mục tiêu hiện tại</span><Button type="button" size="sm" variant="ghost" onClick={() => openGoalEditor(profile.activeGoal)}>{profile.activeGoal ? <Pencil className="mr-1 h-3.5 w-3.5" /> : <Plus className="mr-1 h-3.5 w-3.5" />}{profile.activeGoal ? "Điều chỉnh" : "Tạo mới"}</Button></CardTitle></CardHeader><CardContent>{profile.activeGoal ? <div className="space-y-3"><div className="flex items-end justify-between gap-3"><div><p className="font-bold">{profile.activeGoal.title}</p><p className="mt-1 text-xs text-muted-foreground">Đến {new Date(profile.activeGoal.periodEnd).toLocaleDateString("vi-VN")}</p></div><p className="text-2xl font-black text-primary">{profile.activeGoal.progressPercent}%</p></div><ProgressBar value={profile.activeGoal.progressPercent} /><p className="text-xs text-muted-foreground">Hiện tại {profile.activeGoal.currentValue} / mục tiêu {profile.activeGoal.targetValue}</p></div> : <div className="rounded-xl border-2 border-dashed border-border py-8 text-center"><Target className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" /><p className="text-sm font-semibold">Chưa có mục tiêu đang hoạt động</p><p className="mt-1 text-xs text-muted-foreground">Tạo mục tiêu tuần để cả ba bên cùng theo dõi.</p></div>}</CardContent></Card>
              <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Award className="h-4 w-4 text-amber-500" />Huy hiệu gần đây</CardTitle></CardHeader><CardContent>{profile.badges.length ? <div className="space-y-3">{profile.badges.slice(0, 3).map((badge) => <div key={badge.id} className="flex items-start gap-3 rounded-xl bg-muted/45 p-3"><span className="rounded-xl bg-amber-100 p-2 text-amber-600"><Award className="h-4 w-4" /></span><div><p className="text-sm font-bold">{badge.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{badge.description}</p></div></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Huy hiệu sẽ xuất hiện khi học viên duy trì hoạt động tích cực.</p>}</CardContent></Card>
            </div>

            <Card><CardHeader><CardTitle className="text-base">Nội dung cần củng cố</CardTitle></CardHeader><CardContent>{profile.weakTopics.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{profile.weakTopics.slice(0, 6).map((topic) => <div key={topic.id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{topic.topic}</p><p className="mt-1 text-xs text-muted-foreground">{classMap.get(topic.classId)?.name} · sai {topic.incorrectQuestions}/{topic.totalQuestions} câu</p></div><span className={`font-black ${tone(topic.masteryPercent)}`}>{Math.round(topic.masteryPercent)}%</span></div><ProgressBar value={topic.masteryPercent} size="sm" className="mt-3" />{topic.recommendedResources[0]?.title && <Link href={`/teacher/classes/${encodeURIComponent(topic.classId)}?tab=curriculum`} className="mt-3 inline-flex items-center text-xs font-semibold text-primary hover:underline">Đề xuất: {topic.recommendedResources[0].title}<ExternalLink className="ml-1 h-3 w-3" /></Link>}</div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Chưa có bài thi online đủ dữ liệu phân tích theo chủ đề.</p>}</CardContent></Card>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{profile.classes.map((item) => { const classMetrics = profile.classMetrics[item.id]; return <Card key={item.id}><CardContent className="space-y-3 p-4"><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} /><p className="font-bold">{item.name}</p></div><div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/45 p-3 text-center"><div><p className="font-black">{classMetrics.averageScore?.toFixed(1) ?? "—"}</p><p className="text-[10px] text-muted-foreground">Điểm</p></div><div><p className="font-black">{percentageLabel(classMetrics.attendanceRate)}</p><p className="text-[10px] text-muted-foreground">Chuyên cần</p></div><div><p className="font-black">{percentageLabel(classMetrics.homeworkOnTimeRate)}</p><p className="text-[10px] text-muted-foreground">Đúng hạn</p></div></div><Button asChild size="sm" variant="outline" className="w-full"><Link href={`/teacher/classes/${encodeURIComponent(item.id)}`}>Mở lớp học</Link></Button></CardContent></Card>; })}</div>
          </Tabs.Content>

          <Tabs.Content value="scores" className="mt-5 space-y-4 outline-none">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black">Điểm số thống nhất</h2><p className="mt-1 text-xs text-muted-foreground">Bao gồm điểm giáo viên nhập và kết quả bài thi online.</p></div><Button type="button" size="sm" onClick={() => { setShowScoreForm(true); setEditingScoreId(""); setScoreError(""); setScoreForm({ examName: "", score: "", maxScore: "10", date: toLocalDateKey(new Date()), classId: selectedClassId }); }}><Plus className="mr-1.5 h-4 w-4" />Thêm điểm</Button></div>
            {showScoreForm && <Card className="border-primary/30 bg-primary/5"><CardContent className="p-5"><form onSubmit={submitScore} className="space-y-4"><div className="flex items-center justify-between"><h3 className="font-bold">{editingScoreId ? "Sửa điểm kiểm tra" : "Nhập điểm mới"}</h3><Button type="button" size="icon" variant="ghost" aria-label="Đóng form điểm" onClick={() => { setShowScoreForm(false); setEditingScoreId(""); }}><X className="h-4 w-4" /></Button></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2">Tên bài<input value={scoreForm.examName} maxLength={200} onChange={(event) => setScoreForm((current) => ({ ...current, examName: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground" /></label><label className="space-y-1 text-xs font-medium text-muted-foreground">Điểm<input type="number" min="0" step="0.1" value={scoreForm.score} onChange={(event) => setScoreForm((current) => ({ ...current, score: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground" /></label><label className="space-y-1 text-xs font-medium text-muted-foreground">Tổng điểm<input type="number" min="0.1" step="0.1" value={scoreForm.maxScore} onChange={(event) => setScoreForm((current) => ({ ...current, maxScore: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground" /></label><label className="space-y-1 text-xs font-medium text-muted-foreground">Ngày<input type="date" value={scoreForm.date} onChange={(event) => setScoreForm((current) => ({ ...current, date: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground" /></label><label className="space-y-1 text-xs font-medium text-muted-foreground xl:col-span-2">Lớp<select value={scoreForm.classId} onChange={(event) => setScoreForm((current) => ({ ...current, classId: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground">{profile.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>{scoreError && <p className="text-sm text-red-600" role="alert">{scoreError}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setShowScoreForm(false)}>Hủy</Button><Button type="submit" disabled={Boolean(scoreBusy)}>{scoreBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingScoreId ? "Lưu sửa đổi" : "Lưu điểm"}</Button></div></form></CardContent></Card>}
            {!showScoreForm && scoreError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{scoreError}</p>}
            {scores.length > 1 && <Card><CardHeader><CardTitle className="text-base">Xu hướng điểm gần đây</CardTitle></CardHeader><CardContent className="h-64 p-4"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} /><YAxis domain={[0, 10]} fontSize={11} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => [`${Number(value).toFixed(1)}/10`, "Điểm"]} labelFormatter={(label, payload) => payload?.[0]?.payload?.title ? `${payload[0].payload.title} · ${label}` : label} /><Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></CardContent></Card>}
            <Card><CardContent className="p-0">{scores.length === 0 ? <div className="py-14 text-center text-sm text-muted-foreground">Chưa có kết quả đánh giá trong phạm vi này.</div> : <div className="divide-y divide-border/70">{scores.map((score) => <div key={`${score.source}-${score.id}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{score.title}</p><Badge variant={score.source === "online" ? "purple" : "info"}>{score.source === "online" ? "Bài thi online" : "Giáo viên nhập"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{classMap.get(score.classId)?.name} · {new Date(score.recordedAt).toLocaleDateString("vi-VN")}</p></div><div className="flex items-center justify-between gap-3 sm:justify-end"><div className="text-right"><p className={`text-xl font-black ${tone(score.value10 * 10)}`}>{score.score}/{score.maxScore}</p><p className="text-[10px] text-muted-foreground">{score.value10.toFixed(2)}/10</p></div>{score.reviewHref && <Button asChild size="icon" variant="ghost"><Link href={score.reviewHref} aria-label={`Xem bài ${score.title}`}><ExternalLink className="h-4 w-4" /></Link></Button>}{score.canDelete && <><Button type="button" size="icon" variant="ghost" aria-label={`Sửa điểm ${score.title}`} onClick={() => editScore(score)}><Edit3 className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" className="text-red-600" disabled={scoreBusy === score.id} aria-label={`Xóa điểm ${score.title}`} onClick={() => void removeScore(score)}>{scoreBusy === score.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></>}</div></div>)}</div>}</CardContent></Card>
          </Tabs.Content>

          <Tabs.Content value="attendance" className="mt-5 space-y-4 outline-none">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{[
              { label: "Có mặt", value: present, meta: ATTENDANCE.present }, { label: "Đi trễ", value: late, meta: ATTENDANCE.late }, { label: "Vắng", value: absent, meta: ATTENDANCE.absent }, { label: "Có phép", value: excused, meta: ATTENDANCE.excused },
            ].map(({ label, value, meta }) => <Card key={label}><CardContent className="flex items-center gap-3 p-4"><span className={`rounded-xl p-2 ${meta.className}`}><meta.Icon className="h-4 w-4" /></span><div><p className="text-xl font-black">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div></CardContent></Card>)}<Card className="col-span-2 sm:col-span-1"><CardContent className="p-4 text-center"><p className={`text-xl font-black ${tone(metrics.punctualityRate)}`}>{percentageLabel(metrics.punctualityRate)}</p><p className="text-[10px] text-muted-foreground">Tỷ lệ đúng giờ</p></CardContent></Card></div>
            <div className="flex justify-end"><Button asChild size="sm" variant="outline"><Link href={`/teacher/attendance?class=${encodeURIComponent(selectedClassId)}`}><Pencil className="mr-1.5 h-3.5 w-3.5" />Cập nhật chuyên cần</Link></Button></div>
            <Card><CardContent className="p-0">{attendance.length === 0 ? <div className="py-14 text-center text-sm text-muted-foreground">Chưa có dữ liệu chuyên cần.</div> : <div className="divide-y divide-border/70">{attendance.slice(0, attendanceLimit).map((record) => { const meta = ATTENDANCE[record.status]; return <div key={`${record.classId}-${record.date}`} className="flex items-center gap-3 p-4"><span className={`rounded-xl p-2 ${meta.className}`}><meta.Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{new Date(`${record.date}T12:00:00+07:00`).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</p><p className="mt-0.5 text-xs text-muted-foreground">{classMap.get(record.classId)?.name}</p></div><Badge variant="outline" className={meta.className}>{meta.label}</Badge></div>; })}{attendance.length > attendanceLimit && <div className="p-4 text-center"><Button type="button" size="sm" variant="outline" onClick={() => setAttendanceLimit((value) => value + 20)}>Xem thêm</Button></div>}</div>}</CardContent></Card>
          </Tabs.Content>

          <Tabs.Content value="homework" className="mt-5 space-y-4 outline-none">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
              { label: "Đúng hạn", value: homework.filter((item) => item.status === "on_time").length, className: "text-emerald-600" }, { label: "Nộp trễ", value: homework.filter((item) => item.status === "late").length, className: "text-amber-600" }, { label: "Đang thiếu", value: homework.filter((item) => item.status === "missing").length, className: "text-red-600" }, { label: "Sắp đến hạn", value: homework.filter((item) => item.status === "upcoming").length, className: "text-blue-600" },
            ].map((item) => <Card key={item.label}><CardContent className="p-4 text-center"><p className={`text-2xl font-black ${item.className}`}>{item.value}</p><p className="mt-1 text-xs text-muted-foreground">{item.label}</p></CardContent></Card>)}</div>
            <div className="flex justify-end"><Button asChild size="sm"><Link href={`/teacher/homework?action=create&class=${encodeURIComponent(selectedClassId)}&student=${encodeURIComponent(profile.id)}`}><Plus className="mr-1.5 h-4 w-4" />Giao bài luyện tập</Link></Button></div>
            {homework.length === 0 ? <div className="rounded-2xl border-2 border-dashed border-border py-14 text-center text-sm text-muted-foreground">Chưa có bài tập trong phạm vi này.</div> : <div className="space-y-3">{homework.map((item) => { const statusMeta = item.status === "on_time" ? { label: "Đúng hạn", variant: "success" as const } : item.status === "late" ? { label: "Nộp trễ", variant: "warning" as const } : item.status === "missing" ? { label: "Quá hạn chưa nộp", variant: "destructive" as const } : { label: "Chưa đến hạn", variant: "info" as const }; return <Card key={item.id}><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><span className="rounded-xl bg-violet-50 p-2.5 text-violet-600 dark:bg-violet-950/30"><BookOpen className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{item.title}</p><Badge variant={statusMeta.variant}>{statusMeta.label}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{classMap.get(item.classId)?.name} · Hạn {new Date(item.dueAt).toLocaleString("vi-VN")}</p>{item.submittedAt && <p className="mt-1 text-xs text-muted-foreground">Nộp {new Date(item.submittedAt).toLocaleString("vi-VN")}{item.score !== null ? ` · ${item.score} điểm` : ""}</p>}{item.feedback && <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs italic">“{item.feedback}”</p>}</div><Button asChild size="sm" variant="outline"><Link href={item.gradingHref}>{item.submissionId ? "Mở bài nộp" : "Quản lý bài"}<ExternalLink className="ml-1.5 h-3.5 w-3.5" /></Link></Button></CardContent></Card>; })}</div>}
          </Tabs.Content>

          <Tabs.Content value="notes" className="mt-5 outline-none"><StudentNotes studentId={profile.id} classId={classId === "all" ? selectedClassId : classId} /></Tabs.Content>

          <Tabs.Content value="family" className="mt-5 space-y-4 outline-none">
            <StudentGuardianPanel studentId={profile.id} studentName={profile.fullName} />
            <Card><CardHeader><CardTitle className="flex flex-col gap-3 text-base sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2"><FileClock className="h-4 w-4 text-indigo-600" />Báo cáo tuần đã gửi</span><Button type="button" size="sm" disabled={reporting} onClick={() => void generateReport()}>{reporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Tạo báo cáo mới</Button></CardTitle></CardHeader><CardContent>{profile.reports.length ? <div className="divide-y divide-border/70">{profile.reports.slice(0, 8).map((report) => <div key={report.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Tuần {new Date(report.weekStart).toLocaleDateString("vi-VN")} – {new Date(report.weekEnd).toLocaleDateString("vi-VN")}</p><p className="mt-1 text-xs text-muted-foreground">{report.teacherComment || "Tổng hợp chuyên cần, bài tập, điểm, tiến độ và mục tiêu."}</p></div><Badge variant={report.deliveryStatus === "delivered" ? "success" : report.deliveryStatus === "failed" ? "destructive" : "warning"}>{report.deliveryStatus === "delivered" ? "Đã gửi" : report.deliveryStatus === "failed" ? "Gửi lỗi" : "Đang chờ"}</Badge></div>)}</div> : <div className="py-10 text-center"><FileClock className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" /><p className="text-sm font-semibold">Chưa có báo cáo tuần</p><p className="mt-1 text-xs text-muted-foreground">Tạo báo cáo để phụ huynh theo dõi trên Parent Portal.</p></div>}</CardContent></Card>
          </Tabs.Content>
        </Tabs.Root>
      </main>
    </PortalLayout>
  );
}
