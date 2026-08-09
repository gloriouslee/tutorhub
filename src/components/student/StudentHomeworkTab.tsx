"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SubmissionRecord } from "@/lib/supabase/submissions";
import { formatDate } from "@/lib/utils";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  Loader2,
  MessageSquareText,
  NotebookPen,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  TimerOff,
} from "lucide-react";

export interface StudentClassHomeworkItem {
  id: string;
  class_id: string;
  title: string;
  description?: string;
  due_date: string;
  created_at?: string;
  assigned_to?: string[] | null;
  kind?: "file" | "exam";
  exam_done?: boolean;
  exam_score?: number;
  exam_total?: number;
}

type HomeworkState = "loading" | "todo" | "overdue" | "returned" | "submitted" | "graded" | "done";
type FilterKey = "todo" | "returned" | "submitted" | "done" | "all";
type TypeFilter = "all" | "file" | "exam";
type SortKey = "priority" | "due" | "newest";

type ResolvedHomework = {
  homework: StudentClassHomeworkItem;
  submission?: SubmissionRecord;
  state: HomeworkState;
  daysLeft: number;
  label: string;
  score?: string;
};

const STATE_PRIORITY: Record<HomeworkState, number> = {
  returned: 0,
  overdue: 1,
  todo: 2,
  loading: 3,
  submitted: 4,
  graded: 5,
  done: 5,
};

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "todo", label: "Cần làm" },
  { key: "returned", label: "Cần làm lại" },
  { key: "submitted", label: "Chờ chấm" },
  { key: "done", label: "Đã xong" },
  { key: "all", label: "Tất cả" },
];

function dueAt(value: string) {
  const due = new Date(value);
  due.setHours(23, 59, 59, 999);
  return due.getTime();
}

function daysUntil(value: string) {
  return Math.ceil((dueAt(value) - Date.now()) / 86_400_000);
}

function submittedAt(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function matchesFilter(item: ResolvedHomework, filter: FilterKey) {
  if (filter === "all") return true;
  if (filter === "todo") return item.state === "todo" || item.state === "overdue" || item.state === "loading";
  if (filter === "done") return item.state === "graded" || item.state === "done";
  return item.state === filter;
}

function stateStyles(state: HomeworkState) {
  if (state === "returned") return {
    card: "border-rose-200 bg-rose-50/35 dark:border-rose-900/60 dark:bg-rose-950/10",
    icon: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
    badge: "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
  };
  if (state === "overdue") return {
    card: "border-orange-200 dark:border-orange-900/60",
    icon: "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
    badge: "border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
  };
  if (state === "graded" || state === "done") return {
    card: "border-emerald-200/80 dark:border-emerald-900/50",
    icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
    badge: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  };
  if (state === "submitted") return {
    card: "border-blue-200/80 dark:border-blue-900/50",
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    badge: "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  };
  return {
    card: "border-border",
    icon: "bg-primary/10 text-primary",
    badge: "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  };
}

function actionFor(item: ResolvedHomework, classId: string) {
  const homework = item.homework;
  if (homework.kind === "exam") {
    return {
      href: `/student/classes/${classId}/exam/${homework.id}`,
      label: homework.exam_done ? "Xem kết quả" : item.state === "overdue" ? "Xem chi tiết" : "Làm bài",
      primary: !homework.exam_done && item.state !== "overdue",
      disabled: false,
    };
  }
  if (item.state === "loading") return { href: "", label: "Đang cập nhật", primary: false, disabled: true };
  const needsSubmission = item.state === "todo" || item.state === "overdue" || item.state === "returned";
  const action = needsSubmission ? "submit" : "detail";
  return {
    href: `/student/homework?classId=${encodeURIComponent(classId)}&homeworkId=${encodeURIComponent(homework.id)}&action=${action}`,
    label: item.state === "returned"
      ? "Sửa và nộp lại"
      : needsSubmission
        ? "Nộp bài"
        : item.state === "graded"
          ? "Xem kết quả"
          : "Xem bài nộp",
    primary: needsSubmission,
    disabled: false,
  };
}

function HomeworkSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="h-36 animate-pulse rounded-2xl bg-muted/70" />
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-32 animate-pulse rounded-2xl bg-muted/50" />
      ))}
      <span className="sr-only">Đang tải bài tập…</span>
    </div>
  );
}

export default function StudentHomeworkTab({
  classId,
  homework,
  submissions,
  studentId,
  assignmentsLoading,
  assignmentsRefreshing,
  submissionsLoading,
}: {
  classId: string;
  homework: StudentClassHomeworkItem[];
  submissions: SubmissionRecord[];
  studentId: string;
  assignmentsLoading: boolean;
  assignmentsRefreshing: boolean;
  submissionsLoading: boolean;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<SortKey>("priority");

  const resolved = useMemo<ResolvedHomework[]>(() => homework.map((item) => {
    const submission = submissions.find((candidate) => (
      candidate.homework_id === item.id && candidate.student_id === studentId
    ));
    const daysLeft = daysUntil(item.due_date);

    if (item.kind === "exam") {
      if (item.exam_done) return {
        homework: item,
        state: "done",
        daysLeft,
        label: "Đã hoàn thành",
        score: item.exam_score != null ? `${item.exam_score}/${item.exam_total ?? 10}` : undefined,
      };
      return {
        homework: item,
        state: daysLeft < 0 ? "overdue" : "todo",
        daysLeft,
        label: daysLeft < 0 ? "Quá hạn" : daysLeft === 0 ? "Hạn hôm nay" : `Còn ${daysLeft} ngày`,
      };
    }

    if (submissionsLoading) return { homework: item, submission, state: "loading", daysLeft, label: "Đang cập nhật" };
    if (submission?.status === "returned") return { homework: item, submission, state: "returned", daysLeft, label: "Cần làm lại" };
    if (submission?.status === "graded") return {
      homework: item,
      submission,
      state: "graded",
      daysLeft,
      label: "Đã chấm",
      score: submission.score != null ? `${submission.score}/10` : undefined,
    };
    if (submission) return { homework: item, submission, state: "submitted", daysLeft, label: "Chờ chấm" };
    return {
      homework: item,
      state: daysLeft < 0 ? "overdue" : "todo",
      daysLeft,
      label: daysLeft < 0 ? "Quá hạn" : daysLeft === 0 ? "Hạn hôm nay" : `Còn ${daysLeft} ngày`,
    };
  }), [homework, studentId, submissions, submissionsLoading]);

  const counts = useMemo(() => ({
    all: resolved.length,
    todo: resolved.filter((item) => matchesFilter(item, "todo")).length,
    returned: resolved.filter((item) => item.state === "returned").length,
    submitted: resolved.filter((item) => item.state === "submitted").length,
    done: resolved.filter((item) => matchesFilter(item, "done")).length,
  }), [resolved]);

  const completedCount = resolved.filter((item) => (
    item.state === "submitted" || item.state === "graded" || item.state === "done"
  )).length;
  const completionPct = resolved.length > 0 ? Math.round((completedCount / resolved.length) * 100) : 0;
  const priorityItem = [...resolved]
    .filter((item) => item.state === "returned" || item.state === "overdue" || item.state === "todo")
    .sort((a, b) => STATE_PRIORITY[a.state] - STATE_PRIORITY[b.state] || dueAt(a.homework.due_date) - dueAt(b.homework.due_date))[0];

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
        return STATE_PRIORITY[a.state] - STATE_PRIORITY[b.state]
          || dueAt(a.homework.due_date) - dueAt(b.homework.due_date);
      });
  }, [filter, query, resolved, sort, typeFilter]);

  if (assignmentsLoading || (homework.length === 0 && assignmentsRefreshing)) return <HomeworkSkeleton />;

  if (homework.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center">
          <NotebookPen className="mx-auto h-11 w-11 text-muted-foreground/25" />
          <p className="mt-3 text-sm font-semibold text-foreground">Lớp này chưa có bài tập nào</p>
          <p className="mt-1 text-xs text-muted-foreground">Bài tập mới từ giáo viên sẽ xuất hiện tại đây.</p>
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
              <Badge variant="outline" className="border-primary/20 bg-background/70 text-[10px] uppercase tracking-wide text-primary">Trung tâm bài tập</Badge>
              {assignmentsRefreshing && <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Đang bổ sung dữ liệu</span>}
            </div>
            <h2 className="mt-3 text-xl font-bold text-foreground">Bạn đã hoàn thành {completedCount}/{resolved.length} bài</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ưu tiên bài bị trả lại và bài gần đến hạn trước.</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-primary/10">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completionPct}%` }} />
              </div>
              <span className="text-xs font-bold text-primary">{completionPct}%</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="min-w-[82px] rounded-xl border border-border/70 bg-background/75 px-3 py-2.5 text-center">
              <p className="text-xl font-bold text-foreground">{counts.todo}</p>
              <p className="text-[10px] font-medium text-muted-foreground">Cần làm</p>
            </div>
            <div className="min-w-[82px] rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2.5 text-center dark:border-rose-900 dark:bg-rose-950/20">
              <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{counts.returned}</p>
              <p className="text-[10px] font-medium text-rose-700/70 dark:text-rose-400/75">Làm lại</p>
            </div>
            <div className="min-w-[82px] rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2.5 text-center dark:border-blue-900 dark:bg-blue-950/20">
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{counts.submitted}</p>
              <p className="text-[10px] font-medium text-blue-700/70 dark:text-blue-400/75">Chờ chấm</p>
            </div>
          </div>
        </div>

        {priorityItem && !submissionsLoading && (
          <div className="flex flex-col gap-3 border-t border-primary/15 bg-background/45 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Ưu tiên tiếp theo</p>
                <p className="truncate text-sm font-semibold text-foreground">{priorityItem.homework.title}</p>
              </div>
            </div>
            <Button asChild size="sm" variant={actionFor(priorityItem, classId).primary ? "gradient" : "outline"}>
              <Link href={actionFor(priorityItem, classId).href}>{actionFor(priorityItem, classId).label}<ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
        )}
      </section>

      <div className="space-y-3 rounded-2xl border border-border bg-card p-3 sm:p-4">
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Lọc trạng thái bài tập">
          {FILTERS.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={filter === item.key}
              key={item.key}
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
            <Search className="mx-auto h-9 w-9 text-muted-foreground/25" />
            <p className="mt-3 text-sm font-semibold text-foreground">Không tìm thấy bài tập phù hợp</p>
            <button type="button" className="mt-2 text-xs font-semibold text-primary hover:underline" onClick={() => { setQuery(""); setTypeFilter("all"); setFilter("all"); }}>Xóa bộ lọc</button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayed.map((item) => {
            const homeworkItem = item.homework;
            const styles = stateStyles(item.state);
            const action = actionFor(item, classId);
            const TypeIcon = homeworkItem.kind === "exam" ? GraduationCap : FileText;
            const StateIcon = item.state === "returned"
              ? RotateCcw
              : item.state === "overdue"
                ? TimerOff
                : item.state === "graded" || item.state === "done"
                  ? CheckCircle2
                  : item.state === "submitted"
                    ? Send
                    : item.state === "loading"
                      ? Loader2
                      : Clock3;

            return (
              <Card key={homeworkItem.id} className={`overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md ${styles.card}`}>
                <CardContent className="p-0">
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start gap-2">
                        <h3 className="min-w-0 flex-1 text-sm font-bold leading-snug text-foreground sm:text-base">{homeworkItem.title}</h3>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${styles.badge}`}>
                          <StateIcon className={`h-3 w-3 ${item.state === "loading" ? "animate-spin" : ""}`} />{item.label}{item.score ? ` · ${item.score}` : ""}
                        </span>
                      </div>
                      {homeworkItem.description && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">{homeworkItem.description}</p>}

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Hạn nộp <strong className="font-semibold text-foreground">{formatDate(homeworkItem.due_date)}</strong></span>
                        <span className="flex items-center gap-1.5"><TypeIcon className="h-3.5 w-3.5" />{homeworkItem.kind === "exam" ? "Làm trên hệ thống" : "Nộp bài bằng file"}</span>
                        {item.submission?.submitted_at && <span className="flex items-center gap-1.5"><Send className="h-3.5 w-3.5" />Đã nộp {submittedAt(item.submission.submitted_at)}</span>}
                      </div>

                      {item.submission?.feedback && (
                        <div className={`mt-3 rounded-xl border p-3 text-xs ${item.state === "returned" ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300"}`}>
                          <p className="flex items-center gap-1.5 font-bold"><MessageSquareText className="h-3.5 w-3.5" />Nhận xét của giáo viên</p>
                          <p className="mt-1 leading-relaxed">{item.submission.feedback}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center sm:self-center">
                      {action.disabled ? (
                        <Button size="sm" variant="outline" className="w-full sm:w-auto" disabled><Loader2 className="h-3.5 w-3.5 animate-spin" />{action.label}</Button>
                      ) : (
                        <Button asChild size="sm" variant={action.primary ? "gradient" : "outline"} className="w-full sm:w-auto">
                          <Link href={action.href}>{action.label}<ArrowRight className="h-3.5 w-3.5" /></Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {submissionsLoading && homework.length > 0 && (
        <div className="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />Đang cập nhật trạng thái bài nộp…
        </div>
      )}
    </div>
  );
}
