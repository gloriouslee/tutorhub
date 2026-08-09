"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import FileSubmissionGradingView from "@/components/teacher/FileSubmissionGradingView";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Edit3,
  FileText,
  GraduationCap,
  Loader2,
  Map as MapIcon,
  NotebookPen,
  PenSquare,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import {
  formatDate,
  type Homework,
  type Submission,
} from "./classDetail.types";

interface Student {
  id: string;
  full_name: string;
}

type FilterKey = "grading" | "waiting" | "graded" | "all";
type TypeFilter = "all" | "file" | "exam";
type SortKey = "priority" | "due" | "newest";

type HomeworkMetrics = {
  homework: Homework;
  assignedStudents: Student[];
  homeworkSubmissions: Submission[];
  submittedCount: number;
  pendingCount: number;
  gradedCount: number;
  returnedCount: number;
  missingCount: number;
  totalAssigned: number;
  completionPct: number;
};

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "grading", label: "Cần chấm" },
  { key: "waiting", label: "Chờ học sinh" },
  { key: "graded", label: "Đã xử lý" },
  { key: "all", label: "Tất cả" },
];

const EXAM_STATUS_META = {
  open: { label: "Đang mở", className: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" },
  closed: { label: "Đã đóng", className: "border-border bg-muted text-muted-foreground" },
  draft: { label: "Bản nháp", className: "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300" },
} as const;

function dueAt(value: string) {
  const due = new Date(value);
  due.setHours(23, 59, 59, 999);
  return due.getTime();
}

function dueMeta(value: string) {
  const days = Math.ceil((dueAt(value) - Date.now()) / 86_400_000);
  if (days < 0) return { label: "Quá hạn", className: "text-rose-600 dark:text-rose-400" };
  if (days === 0) return { label: "Hết hạn hôm nay", className: "text-amber-600 dark:text-amber-400" };
  if (days <= 3) return { label: `Còn ${days} ngày`, className: "text-orange-600 dark:text-orange-400" };
  return { label: formatDate(value), className: "text-muted-foreground" };
}

function fileNameFromUrl(url: string) {
  try {
    return decodeURIComponent(url.split("?")[0].split("/").pop() || "Tải đề bài");
  } catch {
    return "Tải đề bài";
  }
}

function matchesFilter(item: HomeworkMetrics, filter: FilterKey) {
  if (filter === "all") return true;
  if (filter === "grading") return item.pendingCount > 0;
  if (filter === "waiting") return item.returnedCount > 0 || item.missingCount > 0;
  return item.pendingCount === 0
    && item.returnedCount === 0
    && item.missingCount === 0
    && item.totalAssigned > 0;
}

function HomeworkSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="h-40 animate-pulse rounded-2xl bg-muted/70" />
      <div className="h-20 animate-pulse rounded-2xl bg-muted/60" />
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-32 animate-pulse rounded-2xl bg-muted/50" />
      ))}
      <span className="sr-only">Đang tải bài tập và bài nộp…</span>
    </div>
  );
}

export default function HomeworkTab({
  classId,
  homeworks,
  submissions,
  students = [],
  onNewHomework,
  onEditHomework,
  onDeleteHomework,
  onGradeExam,
  assignmentsRefreshing = false,
  submissionsLoading = false,
  onSubmissionGraded,
}: {
  classId: string;
  homeworks: Homework[];
  submissions: Submission[];
  students?: Student[];
  onNewHomework: () => void;
  onEditHomework: (homework: Homework) => void;
  onDeleteHomework: (id: string) => void;
  onGradeExam?: (lessonId: string) => void;
  assignmentsRefreshing?: boolean;
  submissionsLoading?: boolean;
  onSubmissionGraded?: (submissionId: string, patch: Partial<Submission>) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<SortKey>("priority");

  const resolved = useMemo<HomeworkMetrics[]>(() => homeworks.map((homework) => {
    const assignedStudents = homework.assigned_to && homework.assigned_to.length > 0
      ? students.filter((student) => homework.assigned_to?.includes(student.id))
      : students;
    const latestSubmissionByStudent = new Map<string, Submission>();
    submissions
      .filter((submission) => submission.homework_id === homework.id)
      .forEach((submission) => {
        const current = latestSubmissionByStudent.get(submission.student_id);
        if (!current || (submission.submitted_at ?? "") >= (current.submitted_at ?? "")) {
          latestSubmissionByStudent.set(submission.student_id, submission);
        }
      });
    const homeworkSubmissions = [...latestSubmissionByStudent.values()];
    const isExam = homework.kind === "exam";
    const examResults = homework.exam_results ?? {};
    const submittedCount = isExam ? Object.keys(examResults).length : homeworkSubmissions.length;
    const pendingCount = isExam
      ? 0
      : homeworkSubmissions.filter((submission) => submission.status !== "returned" && submission.score == null).length;
    const gradedCount = isExam
      ? Object.keys(examResults).length
      : homeworkSubmissions.filter((submission) => submission.status === "graded" || submission.score != null).length;
    const returnedCount = isExam
      ? 0
      : homeworkSubmissions.filter((submission) => submission.status === "returned").length;
    const totalAssigned = assignedStudents.length;
    const missingCount = Math.max(0, totalAssigned - submittedCount);
    const completionPct = totalAssigned > 0 ? Math.round((submittedCount / totalAssigned) * 100) : 0;

    return {
      homework,
      assignedStudents,
      homeworkSubmissions,
      submittedCount,
      pendingCount,
      gradedCount,
      returnedCount,
      missingCount,
      totalAssigned,
      completionPct,
    };
  }), [homeworks, students, submissions]);

  const counts = useMemo(() => ({
    grading: resolved.filter((item) => item.pendingCount > 0).length,
    waiting: resolved.filter((item) => item.returnedCount > 0 || item.missingCount > 0).length,
    graded: resolved.filter((item) => matchesFilter(item, "graded")).length,
    all: resolved.length,
  }), [resolved]);

  const totalPending = resolved.reduce((sum, item) => sum + item.pendingCount, 0);
  const totalReturned = resolved.reduce((sum, item) => sum + item.returnedCount, 0);
  const expectedSubmissions = resolved.reduce((sum, item) => sum + item.totalAssigned, 0);
  const receivedSubmissions = resolved.reduce((sum, item) => sum + item.submittedCount, 0);
  const submissionRate = expectedSubmissions > 0
    ? Math.round((receivedSubmissions / expectedSubmissions) * 100)
    : 0;
  const priorityItem = [...resolved]
    .filter((item) => item.pendingCount > 0)
    .sort((a, b) => b.pendingCount - a.pendingCount || dueAt(a.homework.due_date) - dueAt(b.homework.due_date))[0];

  const displayed = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi-VN");
    return resolved
      .filter((item) => matchesFilter(item, filter))
      .filter((item) => typeFilter === "all" || (item.homework.kind ?? "file") === typeFilter)
      .filter((item) => !normalized
        || item.homework.title.toLocaleLowerCase("vi-VN").includes(normalized)
        || item.homework.description?.toLocaleLowerCase("vi-VN").includes(normalized))
      .sort((a, b) => {
        if (sort === "due") return dueAt(a.homework.due_date) - dueAt(b.homework.due_date);
        if (sort === "newest") return (b.homework.created_at ?? "").localeCompare(a.homework.created_at ?? "");
        return b.pendingCount - a.pendingCount
          || b.returnedCount - a.returnedCount
          || dueAt(a.homework.due_date) - dueAt(b.homework.due_date);
      });
  }, [filter, query, resolved, sort, typeFilter]);

  if (homeworks.length === 0 && assignmentsRefreshing) return <HomeworkSkeleton />;

  if (homeworks.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center">
          <NotebookPen className="mx-auto h-11 w-11 text-muted-foreground/25" />
          <p className="mt-3 text-sm font-semibold text-foreground">Lớp này chưa có bài tập nào</p>
          <p className="mt-1 text-xs text-muted-foreground">Giao bài đầu tiên hoặc thêm bài tập vào lộ trình học.</p>
          <Button size="sm" variant="gradient" className="mt-4" onClick={onNewHomework}>
            <Plus className="h-4 w-4" /> Giao bài mới
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.11] via-card to-card shadow-sm">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/20 bg-background/70 text-[10px] uppercase tracking-wide text-primary">
                Trung tâm chấm bài
              </Badge>
              {assignmentsRefreshing && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Đang bổ sung dữ liệu
                </span>
              )}
            </div>
            <h2 className="mt-3 text-xl font-bold text-foreground">
              {submissionsLoading
                ? "Đang cập nhật trạng thái bài nộp…"
                : totalPending > 0
                  ? `${totalPending} bài nộp đang chờ chấm`
                  : "Không còn bài nộp nào chờ chấm"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Theo dõi tiến độ nộp bài, xử lý bài cần chấm và học sinh cần nhắc ngay tại đây.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-primary/10">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${submissionRate}%` }} />
                </div>
                <span className="shrink-0 text-xs font-bold text-primary">{submissionRate}% đã nộp</span>
              </div>
              <Button size="sm" variant="gradient" onClick={onNewHomework}>
                <Plus className="h-4 w-4" /> Giao bài mới
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="min-w-[82px] rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-center dark:border-amber-900 dark:bg-amber-950/20">
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{submissionsLoading ? "…" : totalPending}</p>
              <p className="text-[10px] font-medium text-amber-700/70 dark:text-amber-400/75">Cần chấm</p>
            </div>
            <div className="min-w-[82px] rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2.5 text-center dark:border-rose-900 dark:bg-rose-950/20">
              <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{submissionsLoading ? "…" : totalReturned}</p>
              <p className="text-[10px] font-medium text-rose-700/70 dark:text-rose-400/75">Chờ làm lại</p>
            </div>
            <div className="min-w-[82px] rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-center dark:border-emerald-900 dark:bg-emerald-950/20">
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{receivedSubmissions}</p>
              <p className="text-[10px] font-medium text-emerald-700/70 dark:text-emerald-400/75">Lượt đã nộp</p>
            </div>
          </div>
        </div>

        {priorityItem && !submissionsLoading && (
          <div className="flex flex-col gap-3 border-t border-primary/15 bg-background/45 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <Clock3 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Ưu tiên chấm tiếp theo</p>
                <p className="truncate text-sm font-semibold text-foreground">{priorityItem.homework.title} · {priorityItem.pendingCount} bài chờ</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setFilter("grading");
                setExpandedId(priorityItem.homework.id);
                requestAnimationFrame(() => document.getElementById(`teacher-homework-${priorityItem.homework.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
              }}
            >
              Chấm ngay <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </section>

      <div className="space-y-3 rounded-2xl border border-border bg-card p-3 sm:p-4">
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Lọc trạng thái bài tập của lớp">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition ${filter === item.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/70 text-muted-foreground hover:bg-muted"}`}
            >
              {item.label} <span className="ml-1 opacity-75">{submissionsLoading && item.key !== "all" ? "…" : counts[item.key]}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm bài tập…"
              className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            />
          </label>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)} className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground outline-none">
            <option value="all">Mọi loại bài</option>
            <option value="file">Bài nộp file</option>
            <option value="exam">Bài trên hệ thống</option>
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground outline-none">
            <option value="priority">Ưu tiên cần xử lý</option>
            <option value="due">Hạn gần nhất</option>
            <option value="newest">Giao gần đây</option>
          </select>
        </div>
      </div>

      {displayed.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500/35" />
            <p className="mt-3 text-sm font-semibold text-foreground">
              {filter === "grading" ? "Không còn bài nào chờ chấm" : "Không tìm thấy bài tập phù hợp"}
            </p>
            <button type="button" className="mt-2 text-xs font-semibold text-primary hover:underline" onClick={() => { setFilter("all"); setQuery(""); setTypeFilter("all"); }}>
              Xem tất cả bài tập
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayed.map((item) => {
            const homework = item.homework;
            const isExam = homework.kind === "exam";
            const isExpanded = expandedId === homework.id;
            const due = dueMeta(homework.due_date);
            const examMeta = EXAM_STATUS_META[homework.exam_status ?? "draft"];
            const TypeIcon = isExam ? GraduationCap : FileText;
            const progressTone = item.completionPct >= 80 ? "bg-emerald-500" : item.completionPct >= 50 ? "bg-blue-500" : "bg-amber-500";

            return (
              <Card id={`teacher-homework-${homework.id}`} key={homework.id} className={`overflow-hidden transition hover:shadow-md ${item.pendingCount > 0 ? "border-amber-200 dark:border-amber-900/60" : "border-border"}`}>
                <CardContent className="p-0">
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isExam ? "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400" : "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"}`}>
                      <TypeIcon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start gap-2">
                        <h3 className="min-w-0 flex-1 text-sm font-bold leading-snug text-foreground sm:text-base">{homework.title}</h3>
                        {isExam ? (
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${examMeta.className}`}>
                            <PenSquare className="h-3 w-3" /> {examMeta.label}
                          </span>
                        ) : item.pendingCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                            <Clock3 className="h-3 w-3" /> {item.pendingCount} bài cần chấm
                          </span>
                        ) : item.returnedCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-100 px-2.5 py-1 text-[10px] font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
                            <RotateCcw className="h-3 w-3" /> {item.returnedCount} chờ làm lại
                          </span>
                        ) : item.missingCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                            <Users className="h-3 w-3" /> {item.missingCount} chưa nộp
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Đã xử lý
                          </span>
                        )}
                      </div>

                      {homework.description && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">{homework.description}</p>}

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                        <span className={`flex items-center gap-1.5 font-medium ${isExam ? "text-muted-foreground" : due.className}`}>
                          <CalendarDays className="h-3.5 w-3.5" /> {isExam ? `Mở từ ${formatDate(homework.due_date)}` : due.label}
                        </span>
                        <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{homework.assigned_to?.length ? `${item.totalAssigned} học sinh chỉ định` : "Cả lớp"}</span>
                        {homework.source === "curriculum" && <span className="flex items-center gap-1.5"><MapIcon className="h-3.5 w-3.5" />Từ lộ trình</span>}
                        {!isExam && homework.file_url && (
                          <a href={homework.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
                            <Download className="h-3.5 w-3.5" /> {fileNameFromUrl(homework.file_url)}
                          </a>
                        )}
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className={`h-full rounded-full transition-all ${progressTone}`} style={{ width: `${item.completionPct}%` }} />
                          </div>
                          <span className="shrink-0 text-[11px] font-semibold text-foreground">{item.submittedCount}/{item.totalAssigned || "—"} đã nộp</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                          {item.gradedCount > 0 && <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{item.gradedCount} đã chấm</span>}
                          {item.returnedCount > 0 && <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700 dark:bg-rose-950 dark:text-rose-300">{item.returnedCount} chờ làm lại</span>}
                          {item.missingCount > 0 && <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">{item.missingCount} chưa nộp</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:self-center">
                      {isExam ? (
                        <Button size="sm" variant="outline" onClick={() => onGradeExam?.(homework.id)}>
                          Xem & chấm <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button size="sm" variant={item.pendingCount > 0 ? "gradient" : "outline"} onClick={() => setExpandedId(isExpanded ? null : homework.id)}>
                          {item.pendingCount > 0 ? `Chấm ${item.pendingCount} bài` : "Xem bài nộp"}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {homework.source !== "curriculum" && !isExam && (
                        <>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" title="Chỉnh sửa" onClick={() => onEditHomework(homework)}>
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500 hover:bg-rose-50" title="Xóa bài tập" onClick={() => onDeleteHomework(homework.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {isExpanded && !isExam && (
                    <FileSubmissionGradingView
                      classId={classId}
                      homeworkTitle={homework.title}
                      submissions={item.homeworkSubmissions}
                      assignedStudents={item.assignedStudents}
                      loading={submissionsLoading}
                      onClose={() => setExpandedId(null)}
                      onGraded={(submissionId, patch) => onSubmissionGraded?.(submissionId, patch)}
                    />
                  )}

                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {submissionsLoading && homeworks.length > 0 && (
        <div className="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang cập nhật trạng thái bài nộp…
        </div>
      )}
    </div>
  );
}
