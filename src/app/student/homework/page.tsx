"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { HomeworkLoadingState } from "@/components/shared/HomeworkLoadingState";
import { useStudentContext } from "@/hooks/useStudentContext";
import StudentScopeBar, {
  classMatchesStudentScope,
  useStudentWorkspaceScope,
} from "@/components/student/StudentScopeBar";
import {
  FileText, Clock, CheckCircle2, Upload, Calendar,
  AlertCircle, X, Check, Download, Loader2, Star, NotebookPen, PenSquare, PlayCircle,
  ArrowRight, RefreshCw, RotateCcw, Search, SlidersHorizontal,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  uploadSubmissionFile,
  insertSubmission,
  getSubmissionsByStudent,
  type SubmissionRecord,
} from "@/lib/supabase/submissions";
import { getTeacherHomework, getStudentCurriculum, getExamResult, isAssignedToStudent } from "@/lib/storage";

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCEPTED = ".pdf,.doc,.docx,.jpg,.jpeg,.png";
const MAX_MB   = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysLeft(due: string) {
  return Math.ceil((new Date(due).setHours(23, 59, 59) - Date.now()) / 86400000);
}

type FilterTab = "todo" | "returned" | "submitted" | "done" | "all";
type TypeFilter = "all" | "file" | "exam";
type SortKey = "priority" | "due" | "newest";

const STATE_PRIORITY: Record<FilterTab, number> = {
  returned: 0,
  todo: 1,
  submitted: 2,
  done: 3,
  all: 4,
};

interface HomeworkItem {
  id: string;
  class_id: string;
  title: string;
  description?: string;
  due_date: string;
  created_at?: string;
  assigned_to?: string[] | null;
  file_url?: string; // file đề bài giáo viên đính kèm (link hoặc upload)
  kind?: "file" | "exam"; // "exam" = làm câu hỏi trên hệ thống
  exam_done?: boolean;    // đã làm bài thi chưa (kind exam)
  exam_score?: number;    // điểm đạt (kind exam)
  exam_total?: number;    // điểm tối đa (kind exam)
}

function assignmentKey(homework: Pick<HomeworkItem, "class_id" | "id">) {
  return `${homework.class_id}:${homework.id}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StudentHomeworkPage() {
  const router = useRouter();
  const {
    studentId: STUDENT_ID,
    studentName: STUDENT_NAME,
    myClasses,
    ready,
  } = useStudentContext();
  const { scope, setScope } = useStudentWorkspaceScope(myClasses);
  const myClassIds = myClasses.map(c => c.id);
  const [teacherHw,    setTeacherHw]    = useState<HomeworkItem[]>([]);
  const myHomework: HomeworkItem[] = teacherHw;
  const [submissions,  setSubmissions]  = useState<SubmissionRecord[]>([]);
  const [loadingHomework, setLoadingHomework] = useState(true);
  const [loadWarning, setLoadWarning] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [filterTab,    setFilterTab]    = useState<FilterTab>("todo");
  const [query,        setQuery]        = useState("");
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>("all");
  const [sortKey,      setSortKey]      = useState<SortKey>("priority");
  const [selectedHw,   setSelectedHw]   = useState<HomeworkItem | null>(null);
  const [modalType,    setModalType]    = useState<"submit" | "detail" | null>(null);
  const [file,         setFile]         = useState<File | null>(null);
  const [dragOver,     setDragOver]     = useState(false);
  const [uploadState,  setUploadState]  = useState<"idle" | "uploading" | "success">("idle");
  const [errorMsg,     setErrorMsg]     = useState("");
  const deepLinkHandledRef = useRef("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const classKey = myClassIds.join(",");
    if (!ready) return;
    if (!STUDENT_ID) {
      setLoadingHomework(false);
      return;
    }

    if (!classKey) {
      setTeacherHw([]);
      setSubmissions([]);
      setLoadingHomework(false);
      return;
    }

    let cancelled = false;
    let partialFailure = false;
    setLoadingHomework(true);
    setLoadWarning("");

    async function safely<T>(work: Promise<T>, fallback: T) {
      try {
        return await work;
      } catch {
        partialFailure = true;
        return fallback;
      }
    }

    const curriculumPromise = Promise.all(myClassIds.map(async cid => {
      const chapters = await safely(getStudentCurriculum(cid), []);
      const items: HomeworkItem[] = [];
      const examItems: Promise<HomeworkItem>[] = [];
      const today = new Date().toISOString().slice(0, 10);

      for (const ch of chapters) {
        for (const s of ch.sessions) {
          for (const lesson of s.lessons) {
            if (lesson.type === "homework") {
              items.push({
                id: lesson.id, class_id: cid, title: lesson.title,
                description: (lesson as any).description,
                due_date: (lesson as any).due_date ?? s.date ?? today,
                created_at: s.date, kind: "file",
                file_url: (lesson as any).file_url,
              });
            } else if (lesson.type === "exam") {
              examItems.push(
                safely(getExamResult(cid, lesson.id, STUDENT_ID), null)
                  .then(result => {
                    const manual = result
                      ? Object.values(result.manual_scores ?? {}).reduce((a, b) => a + b, 0)
                      : 0;
                    return {
                      id: lesson.id, class_id: cid, title: lesson.title,
                      description: (lesson as any).description,
                      due_date: (lesson as any).exam_opens_at?.slice(0, 10) ?? s.date ?? today,
                      created_at: s.date, kind: "exam" as const,
                      exam_done: !!result,
                      exam_score: result ? Math.round((result.score + manual) * 100) / 100 : undefined,
                      exam_total: result?.total,
                    };
                  }),
              );
            }
          }
        }
      }

      return [...items, ...await Promise.all(examItems)];
    }));

    Promise.all([
      safely(getTeacherHomework<HomeworkItem>(myClassIds), []),
      curriculumPromise,
      safely(getSubmissionsByStudent(STUDENT_ID), []),
    ])
      .then(([allManual, curriculumByClass, studentSubmissions]) => {
        if (cancelled) return;
        const manual = allManual.filter(h =>
          myClassIds.includes(h.class_id)
          && isAssignedToStudent(h.assigned_to, STUDENT_ID),
        );
        const merged = new Map<string, HomeworkItem>();
        for (const item of [...manual, ...curriculumByClass.flat()]) {
          merged.set(assignmentKey(item), item);
        }
        setTeacherHw([...merged.values()]);
        setSubmissions(studentSubmissions);
        if (partialFailure) {
          setLoadWarning("Một phần dữ liệu chưa tải được. Danh sách bên dưới có thể chưa đầy đủ.");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadWarning("Không thể tải dữ liệu bài tập. Vui lòng thử lại.");
      })
      .finally(() => {
        if (!cancelled) setLoadingHomework(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, STUDENT_ID, myClassIds.join(","), reloadVersion]);

  useEffect(() => {
    if (!modalType) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && uploadState !== "uploading") closeModal();
    };
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => document.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalType, uploadState]);

  useEffect(() => {
    if (loadingHomework || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const homeworkId = params.get("homeworkId") ?? "";
    const classId = params.get("classId") ?? "";
    if (!homeworkId) return;
    const key = `${classId}:${homeworkId}:${params.get("action") ?? ""}`;
    if (deepLinkHandledRef.current === key) return;
    const target = teacherHw.find((item) => item.id === homeworkId && (!classId || item.class_id === classId));
    if (!target) return;
    const submission = submissions.find((item) => (
      item.homework_id === homeworkId
      && item.student_id === STUDENT_ID
      && (!item.class_id || item.class_id === target.class_id)
    ));
    const requestedAction = params.get("action");
    const shouldSubmit = requestedAction === "submit" || !submission || submission.status === "returned";
    deepLinkHandledRef.current = key;
    setSelectedHw(target);
    setModalType(shouldSubmit ? "submit" : "detail");
    setFile(null);
    setUploadState("idle");
    setErrorMsg("");
  }, [STUDENT_ID, loadingHomework, submissions, teacherHw]);

  // Per-homework submission lookup
  function getSub(homework: HomeworkItem) {
    const exact = submissions.find((submission) => (
      submission.homework_id === homework.id
      && submission.student_id === STUDENT_ID
      && submission.class_id === homework.class_id
    ));
    if (exact) return exact;
    const sameIdAssignments = myHomework.filter((item) => item.id === homework.id);
    if (sameIdAssignments.length !== 1) return undefined;
    return submissions.find((submission) => (
      submission.homework_id === homework.id
      && submission.student_id === STUDENT_ID
      && !submission.class_id
    ));
  }

  // Status logic
  function hwStatus(homework: HomeworkItem) {
    const sub = getSub(homework);
    if (sub?.status === "returned")
      return { label: "Cần làm lại", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400", icon: RotateCcw, key: "returned" as FilterTab };
    if (sub?.status === "graded")
      return { label: sub.score != null ? `Đã chấm · ${sub.score}/10` : "Đã chấm", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400", icon: Star, key: "done" as FilterTab };
    if (sub)
      return { label: "Đã nộp", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400", icon: CheckCircle2, key: "submitted" as FilterTab };
    const d = daysLeft(homework.due_date);
    if (d < 0)
      return { label: "Quá hạn", color: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400", icon: AlertCircle, key: "todo" as FilterTab };
    if (d === 0)
      return { label: "Hạn hôm nay", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400", icon: AlertCircle, key: "todo" as FilterTab };
    if (d <= 3)
      return { label: `Còn ${d} ngày`, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400", icon: Clock, key: "todo" as FilterTab };
    return { label: `Còn ${d} ngày`, color: "bg-muted text-muted-foreground", icon: Clock, key: "todo" as FilterTab };
  }

  // Trạng thái lọc: tách rõ việc cần làm, cần làm lại, chờ chấm và lịch sử đã xong.
  function statusKey(hw: HomeworkItem): FilterTab {
    if (hw.kind === "exam") return hw.exam_done ? "done" : "todo";
    return hwStatus(hw).key;
  }

  const scopedHomework = useMemo(() => myHomework.filter((homework) => (
    classMatchesStudentScope(myClasses.find((cls) => cls.id === homework.class_id), scope)
  )), [myClasses, myHomework, scope]);

  const normalizedQuery = query.trim().toLocaleLowerCase("vi-VN");
  const displayed = useMemo(() => scopedHomework
    .filter(hw => filterTab === "all"
      ? true
      : filterTab === "todo"
        ? statusKey(hw) === "todo" || statusKey(hw) === "returned"
        : statusKey(hw) === filterTab)
    .filter(hw => typeFilter === "all" || (hw.kind ?? "file") === typeFilter)
    .filter(hw => !normalizedQuery
      || hw.title.toLocaleLowerCase("vi-VN").includes(normalizedQuery)
      || hw.description?.toLocaleLowerCase("vi-VN").includes(normalizedQuery))
    .sort((a, b) => {
      if (sortKey === "due") return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      if (sortKey === "newest") return (b.created_at ?? b.due_date ?? "").localeCompare(a.created_at ?? a.due_date ?? "");
      return STATE_PRIORITY[statusKey(a)] - STATE_PRIORITY[statusKey(b)]
        || new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [filterTab, normalizedQuery, scopedHomework, sortKey, submissions, typeFilter]);

  // Sidebar stats
  const submittedCount = scopedHomework.filter(hw => ["submitted", "done"].includes(statusKey(hw))).length;
  const gradedScores = scopedHomework.flatMap((homework) => {
    if (homework.kind === "exam") {
      return homework.exam_score != null && homework.exam_total
        ? [(homework.exam_score / homework.exam_total) * 10]
        : [];
    }
    const submission = getSub(homework);
    return submission?.score != null ? [submission.score] : [];
  });
  const avgScore = gradedScores.length > 0
    ? (gradedScores.reduce((sum, score) => sum + score, 0) / gradedScores.length).toFixed(1)
    : null;

  // Filter tab counts
  const tabCounts: Record<FilterTab, number> = {
    all: scopedHomework.length,
    todo: scopedHomework.filter(hw => statusKey(hw) === "todo" || statusKey(hw) === "returned").length,
    returned: scopedHomework.filter(hw => statusKey(hw) === "returned").length,
    submitted: scopedHomework.filter(hw => statusKey(hw) === "submitted").length,
    done: scopedHomework.filter(hw => statusKey(hw) === "done").length,
  };

  const completionPercent = scopedHomework.length > 0
    ? Math.round((submittedCount / scopedHomework.length) * 100)
    : 0;
  const priorityHomework = [...scopedHomework]
    .filter(hw => statusKey(hw) === "returned" || statusKey(hw) === "todo")
    .sort((a, b) => STATE_PRIORITY[statusKey(a)] - STATE_PRIORITY[statusKey(b)]
      || new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  // Modal helpers
  function openModal(hw: typeof myHomework[0], type: "submit" | "detail") {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedHw(hw);
    setModalType(type);
    setFile(null);
    setUploadState("idle");
    setErrorMsg("");
  }
  function closeModal() {
    setSelectedHw(null);
    setModalType(null);
    setFile(null);
    setUploadState("idle");
    setErrorMsg("");
    requestAnimationFrame(() => returnFocusRef.current?.focus());
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("homeworkId")) {
        params.delete("homeworkId");
        params.delete("classId");
        params.delete("action");
        const query = params.toString();
        router.replace(query ? `/student/homework?${query}` : "/student/homework", { scroll: false });
      }
    }
  }

  function handleFileChange(f: File | null) {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "doc", "docx", "jpg", "jpeg", "png"].includes(ext)) {
      setErrorMsg(`File .${ext} không được hỗ trợ. Chỉ nhận: PDF, Word, JPG, PNG.`);
      setFile(null); return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setErrorMsg(`File vượt quá ${MAX_MB}MB.`);
      setFile(null); return;
    }
    setErrorMsg("");
    setFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !selectedHw) return;
    setUploadState("uploading");
    setErrorMsg("");

    try {
      const uploaded = await uploadSubmissionFile(
        selectedHw.class_id,
        selectedHw.id,
        STUDENT_ID,
        file,
      );
      if (!uploaded?.url) {
        throw new Error("Không thể tải file bài làm lên. Vui lòng thử lại.");
      }

      const saved = await insertSubmission({
        class_id: selectedHw.class_id,
        homework_id: selectedHw.id,
        student_id: STUDENT_ID,
        student_name: STUDENT_NAME,
        file_url: uploaded.url,
        file_name: file.name,
        file_size: file.size,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      });
      if (!saved) {
        throw new Error("File đã tải lên nhưng chưa thể ghi nhận bài nộp. Vui lòng thử lại.");
      }

      setSubmissions(prev => [
        ...prev.filter(s => !(
          s.homework_id === selectedHw.id
          && s.student_id === STUDENT_ID
          && (!s.class_id || s.class_id === selectedHw.class_id)
        )),
        saved,
      ]);
      setUploadState("success");
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Không thể nộp bài. Vui lòng thử lại.");
      setUploadState("idle");
    }
  }

  if (loadingHomework) {
    return (
      <PortalLayout role="student" userName={STUDENT_NAME} pageTitle="Bài tập">
        <HomeworkLoadingState />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout role="student" userName={STUDENT_NAME} pageTitle="Bài tập">
      <div className="space-y-5 max-w-5xl mx-auto pb-10">
        <SectionHeader
          title="Trung tâm bài tập"
          subtitle="Xử lý bài cần làm trước, sau đó theo dõi bài chờ chấm và kết quả."
        />

        <StudentScopeBar classes={myClasses} scope={scope} onChange={setScope} />

        {loadWarning && (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" /><p>{loadWarning}</p></div>
            <Button type="button" size="sm" variant="outline" onClick={() => setReloadVersion((value) => value + 1)}><RefreshCw className="h-3.5 w-3.5" />Thử lại</Button>
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.11] via-card to-card shadow-sm">
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-6">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Tiến độ trong phạm vi đang chọn</p>
              <h2 className="mt-2 text-xl font-bold">Đã hoàn thành {submittedCount}/{scopedHomework.length} bài</h2>
              <p className="mt-1 text-sm text-muted-foreground">Bài bị trả lại và bài gần đến hạn luôn được đưa lên trước.</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-primary/10"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completionPercent}%` }} /></div>
                <span className="text-xs font-bold text-primary">{completionPercent}%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="min-w-[78px] rounded-xl border bg-background/80 px-3 py-2.5 text-center"><p className="text-xl font-bold">{tabCounts.todo}</p><p className="text-[10px] text-muted-foreground">Cần xử lý</p></div>
              <div className="min-w-[78px] rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2.5 text-center dark:border-rose-900 dark:bg-rose-950/20"><p className="text-xl font-bold text-rose-600 dark:text-rose-400">{tabCounts.returned}</p><p className="text-[10px] text-muted-foreground">Làm lại</p></div>
              <div className="min-w-[78px] rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2.5 text-center dark:border-blue-900 dark:bg-blue-950/20"><p className="text-xl font-bold text-blue-600 dark:text-blue-400">{tabCounts.submitted}</p><p className="text-[10px] text-muted-foreground">Chờ chấm</p></div>
            </div>
          </div>
          {priorityHomework && (
            <div className="flex flex-col gap-3 border-t border-primary/15 bg-background/45 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
              <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-primary">Ưu tiên tiếp theo</p><p className="truncate text-sm font-semibold">{priorityHomework.title}</p></div>
              <Button type="button" size="sm" variant="gradient" onClick={() => priorityHomework.kind === "exam" ? router.push(`/student/classes/${priorityHomework.class_id}/exam/${priorityHomework.id}`) : openModal(priorityHomework, "submit")}>Bắt đầu ngay<ArrowRight className="h-3.5 w-3.5" /></Button>
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-card p-3 sm:p-4" aria-label="Bộ lọc bài tập">
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Lọc theo trạng thái">
            {(["todo", "returned", "submitted", "done", "all"] as FilterTab[]).map(f => (
              <button
                type="button"
                role="tab"
                aria-selected={filterTab === f}
                key={f}
                onClick={() => setFilterTab(f)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${filterTab === f ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent"}`}
              >
                {{ todo: "Cần xử lý", returned: "Cần làm lại", submitted: "Chờ chấm", done: "Đã xong", all: "Tất cả" }[f]}
                <span className="text-[10px] opacity-75">{tabCounts[f]}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <span className="sr-only">Tìm bài tập</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc nội dung…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15" />
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3"><SlidersHorizontal className="h-4 w-4 text-muted-foreground" /><span className="sr-only">Loại bài</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)} className="h-10 bg-transparent text-xs font-medium outline-none"><option value="all">Mọi loại bài</option><option value="file">Nộp bằng file</option><option value="exam">Làm trên hệ thống</option></select></label>
            <label className="rounded-xl border border-border bg-background px-3"><span className="sr-only">Sắp xếp</span><select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="h-10 bg-transparent text-xs font-medium outline-none"><option value="priority">Ưu tiên cần xử lý</option><option value="due">Hạn gần nhất</option><option value="newest">Giao gần đây</option></select></label>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Homework list ────────────────────────────── */}
          <div className="order-2 space-y-4 lg:order-1 lg:col-span-2">
            {displayed.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground border-2 border-dashed border-border/50 rounded-2xl">
                <Search className="h-8 w-8 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Không tìm thấy bài tập phù hợp.</p>
                <button type="button" className="mt-2 text-xs font-semibold text-primary hover:underline" onClick={() => { setQuery(""); setTypeFilter("all"); setFilterTab("all"); }}>Xóa bộ lọc</button>
              </div>
            ) : (
              displayed.map((hw, i) => {
                const cls = myClasses.find(c => c.id === hw.class_id);

                // Bài làm câu hỏi trên hệ thống — mở trang làm bài, không nộp file
                if (hw.kind === "exam") {
                  return (
                    <Card
                      key={assignmentKey(hw)}
                      className="hover:border-primary/40 transition-colors animate-fade-in group"
                      style={{ animationDelay: `${(i % 6) * 70}ms` }}
                    >
                      <CardContent className="p-5">
                        <div className="flex gap-4">
                          <div className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                            <NotebookPen className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                              <h3 className="font-semibold text-foreground text-base group-hover:text-primary transition-colors leading-snug">
                                {hw.title}
                              </h3>
                              {hw.exam_done ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3 w-3" /> Đã làm{hw.exam_score != null ? ` · ${hw.exam_score}/${hw.exam_total}` : ""}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                                  <Clock className="h-3 w-3" /> Chưa làm
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2.5 text-xs text-muted-foreground mb-3 flex-wrap">
                              <span className="bg-muted px-2 py-0.5 rounded-md font-semibold text-foreground">
                                {cls?.class_name ?? hw.class_id}
                              </span>
                              {cls?.tutor_name && <span>GV: {cls.tutor_name}</span>}
                              <span className="flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                                <PenSquare className="h-3.5 w-3.5" /> Làm trên hệ thống
                              </span>
                            </div>
                            {hw.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{hw.description}</p>
                            )}
                            <div className="mt-4 pt-3.5 border-t border-border flex gap-2.5">
                              <Button
                                variant={hw.exam_done ? "outline" : "gradient"}
                                size="sm"
                                className="font-semibold"
                                onClick={() => router.push(`/student/classes/${hw.class_id}/exam/${hw.id}`)}
                              >
                                <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                                {hw.exam_done ? "Xem lại / Làm lại" : "Làm bài"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }

                const sub    = getSub(hw);
                const status = hwStatus(hw);
                const { icon: StatusIcon } = status;

                return (
                  <Card
                    key={assignmentKey(hw)}
                    className="hover:border-primary/40 transition-colors animate-fade-in group"
                    style={{ animationDelay: `${(i % 6) * 70}ms` }}
                  >
                    <CardContent className="p-5">
                      <div className="flex gap-4">
                        {/* Icon */}
                        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                          <FileText className="h-5 w-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Title + badge */}
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                            <h3 className="font-semibold text-foreground text-base group-hover:text-primary transition-colors leading-snug">
                              {hw.title}
                            </h3>
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${status.color}`}>
                              <StatusIcon className="h-3 w-3" /> {status.label}
                            </span>
                          </div>

                          {/* Meta */}
                          <div className="flex items-center gap-2.5 text-xs text-muted-foreground mb-3 flex-wrap">
                            <span className="bg-muted px-2 py-0.5 rounded-md font-semibold text-foreground">
                              {cls?.class_name ?? hw.class_id}
                            </span>
                            {cls?.tutor_name && <span>GV: {cls.tutor_name}</span>}
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              Hạn nộp: <span className="font-medium text-foreground">{formatDate(hw.due_date)}</span>
                            </span>
                          </div>

                          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                            {hw.description}
                          </p>

                          {/* Submitted file chip */}
                          {sub?.file_name && (
                            <div className="mt-3 inline-flex items-center gap-2 text-xs bg-muted/50 border border-border/60 rounded-lg px-3 py-1.5 max-w-full">
                              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="truncate font-medium">{sub.file_name}</span>
                              {sub.file_url && (
                                <a
                                  href={sub.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-1 shrink-0 text-primary hover:underline font-semibold"
                                >
                                  Xem
                                </a>
                              )}
                            </div>
                          )}

                          {/* Feedback */}
                          {sub?.status === "graded" && (
                            <div className="mt-3 p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40 text-sm">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-semibold text-emerald-700 dark:text-emerald-400 text-xs">
                                  Nhận xét của Giáo viên:
                                </p>
                                {sub.graded_at && (
                                  <p className="text-[10px] text-muted-foreground">
                                    {new Date(sub.graded_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                  </p>
                                )}
                              </div>
                              {sub.feedback
                            ? <p className="text-foreground/80 italic">&quot;{sub.feedback}&quot;</p>
                                : <p className="text-muted-foreground italic">Giáo viên chưa để lại nhận xét.</p>
                              }
                              {sub.score != null && (
                                <p className="mt-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                                  Điểm: {sub.score}/10
                                </p>
                              )}
                              {(sub as SubmissionRecord & { teacher_file_name?: string; teacher_file_url?: string }).teacher_file_name && (
                                <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg text-xs">
                                  <Download className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                  <span className="flex-1 truncate text-indigo-700 dark:text-indigo-300 font-medium">
                                    {(sub as SubmissionRecord & { teacher_file_name?: string }).teacher_file_name}
                                  </span>
                                  {(sub as SubmissionRecord & { teacher_file_url?: string }).teacher_file_url && (
                                    <a
                                      href={(sub as SubmissionRecord & { teacher_file_url?: string }).teacher_file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-semibold text-indigo-600 hover:underline"
                                    >
                                      Tải xuống
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="mt-4 pt-3.5 border-t border-border flex gap-2.5">
                            {!sub ? (
                              <Button
                                variant="gradient"
                                size="sm"
                                className="font-semibold"
                                onClick={() => openModal(hw, "submit")}
                              >
                                <Upload className="h-3.5 w-3.5 mr-1.5" /> Nộp bài
                              </Button>
                            ) : sub.status === "graded" ? (
                              <Button variant="outline" size="sm" className="font-semibold" disabled>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> Đã chấm
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="font-semibold text-primary border-primary/40 hover:bg-primary/5"
                                onClick={() => openModal(hw, "submit")}
                              >
                                <Upload className="h-3.5 w-3.5 mr-1.5" /> Nộp lại
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => openModal(hw, "detail")}
                            >
                              Chi tiết
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* ── Sidebar ──────────────────────────────────── */}
          <aside className="order-1 space-y-4 lg:order-2" aria-label="Tóm tắt bài tập">
            {/* Progress card */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-5 space-y-4">
                <div>
                  <h3 className="font-bold text-sm text-foreground mb-0.5">Tiến độ bài tập</h3>
                  <p className="text-xs text-muted-foreground">
                    {scopedHomework.length === 0
                      ? "Chưa có bài tập trong phạm vi này"
                      : submittedCount >= scopedHomework.length
                      ? "Bạn đã nộp tất cả bài tập!"
                      : `Còn ${scopedHomework.length - submittedCount} bài chưa nộp`}
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Submitted progress */}
                  <div>
                    <div className="flex justify-between text-xs mb-1 font-medium">
                      <span>Đã nộp</span>
                      <span className="text-primary font-bold">{submittedCount}/{scopedHomework.length} bài</span>
                    </div>
                    <div className="h-2 w-full bg-background rounded-full overflow-hidden border border-border/40">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-700"
                        style={{ width: `${scopedHomework.length > 0 ? (submittedCount / scopedHomework.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Avg score */}
                  {avgScore && (
                    <div>
                      <div className="flex justify-between text-xs mb-1 font-medium">
                        <span>Điểm trung bình</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{avgScore}/10</span>
                      </div>
                      <div className="h-2 w-full bg-background rounded-full overflow-hidden border border-border/40">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                          style={{ width: `${(parseFloat(avgScore) / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Mini breakdown */}
                <div className="grid grid-cols-4 gap-2 pt-1 border-t border-border/40">
                  <div className="text-center">
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{tabCounts.todo}</p>
                    <p className="text-[10px] text-muted-foreground">Cần xử lý</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-rose-600 dark:text-rose-400">{tabCounts.returned}</p>
                    <p className="text-[10px] text-muted-foreground">Làm lại</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{tabCounts.submitted}</p>
                    <p className="text-[10px] text-muted-foreground">Chờ chấm</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{tabCounts.done}</p>
                    <p className="text-[10px] text-muted-foreground">Đã xong</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming deadline */}
            {(() => {
              const upcoming = scopedHomework
                .filter(hw => statusKey(hw) === "todo" || statusKey(hw) === "returned")
                .sort((a, b) => STATE_PRIORITY[statusKey(a)] - STATE_PRIORITY[statusKey(b)] || a.due_date.localeCompare(b.due_date))[0];
              if (!upcoming) return (
                <Card>
                  <CardContent className="p-5 flex items-center gap-3">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
                    <p className="text-sm font-semibold text-foreground">{scopedHomework.length === 0 ? "Chưa có deadline cần theo dõi." : "Bạn đã hoàn thành hết bài tập!"}</p>
                  </CardContent>
                </Card>
              );
              const d = daysLeft(upcoming.due_date);
              const urgent = d <= 2;
              return (
                <Card className={urgent ? "border-amber-200 dark:border-amber-800" : ""}>
                  <CardContent className="p-5 flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${urgent ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"}`}>
                      <AlertCircle className={`h-5 w-5 ${urgent ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-sm text-foreground">
                        {urgent ? "Sắp đến hạn!" : "Deadline tiếp theo"}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        <span className="font-medium text-foreground">{upcoming.title}</span>
                        {" — "}
                        {d < 0 ? "đã quá hạn" : d === 0 ? "hạn nộp hôm nay" : `còn ${d} ngày`}
                      </p>
                      <button type="button" className="mt-2 text-xs font-semibold text-primary hover:underline" onClick={() => upcoming.kind === "exam" ? router.push(`/student/classes/${upcoming.class_id}/exam/${upcoming.id}`) : openModal(upcoming, "submit")}>Mở bài tập</button>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </aside>
        </div>
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {modalType && selectedHw && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-homework-dialog-title"
          onClick={e => { if (e.target === e.currentTarget && uploadState !== "uploading") closeModal(); }}
        >
          <Card className="w-full max-w-lg shadow-2xl border-0 overflow-hidden">
            {/* Header */}
            <div className="border-b border-border p-5 flex justify-between items-start bg-muted/30">
              <div>
                <h3 id="student-homework-dialog-title" className="font-bold text-base text-foreground">
                  {modalType === "submit" ? "Nộp bài tập" : "Chi tiết bài tập"}
                </h3>
                <p className="text-muted-foreground text-sm mt-0.5 line-clamp-1">{selectedHw.title}</p>
              </div>
              <Button ref={closeButtonRef} type="button" size="icon" variant="ghost" aria-label="Đóng hộp thoại" className="rounded-full h-8 w-8 -mt-1 -mr-1 shrink-0" onClick={closeModal} disabled={uploadState === "uploading"}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <CardContent className="p-5">

              {/* ── Detail ── */}
              {modalType === "detail" && (() => {
                const cls = myClasses.find(c => c.id === selectedHw.class_id);
                const sub = getSub(selectedHw);
                return (
                  <div className="space-y-4">
                    {/* Class chip */}
                    <div className="flex items-center gap-3 bg-primary/5 p-3 rounded-xl border border-primary/10">
                      <div className="h-9 w-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lớp học</p>
                        <p className="font-semibold text-sm text-foreground">{cls?.class_name ?? selectedHw.class_id}</p>
                        {cls?.tutor_name && <p className="text-xs text-muted-foreground">Giáo viên: {cls.tutor_name}</p>}
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Yêu cầu chi tiết</p>
                      <div className="bg-muted/20 p-3.5 rounded-xl text-sm leading-relaxed border border-border">
                        {selectedHw.description}
                      </div>
                    </div>

                    {/* Đề bài đính kèm (giáo viên upload/dán link) */}
                    {selectedHw.file_url && (
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Đề bài đính kèm</p>
                        <a
                          href={selectedHw.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-muted/20 hover:bg-muted/40 transition-colors rounded-xl px-3 py-2.5 border border-border text-sm"
                        >
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate flex-1 text-xs font-medium">
                            {decodeURIComponent(selectedHw.file_url.split("?")[0].split("/").pop() || "Tải đề bài")}
                          </span>
                          <Download className="h-4 w-4 text-primary shrink-0" />
                        </a>
                      </div>
                    )}

                    {/* Due + Status */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/20 p-3 rounded-xl border border-border flex items-center gap-2.5">
                        <div className="h-8 w-8 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg flex items-center justify-center shrink-0">
                          <Calendar className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Hạn nộp</p>
                          <p className="font-semibold text-xs">{formatDate(selectedHw.due_date)}</p>
                        </div>
                      </div>
                      <div className="bg-muted/20 p-3 rounded-xl border border-border flex items-center gap-2.5">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${sub ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Trạng thái</p>
                          <p className={`font-semibold text-xs ${sub ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}`}>
                            {sub?.status === "graded" ? "Đã chấm" : sub ? "Đã nộp" : "Chưa nộp"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Submission details */}
                    {sub && (
                      <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                            <Check className="h-4 w-4" /> Đã nộp
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(sub.submitted_at).toLocaleString("vi-VN")}
                          </span>
                        </div>

                        {sub.file_name && (
                          <div className="flex items-center gap-2 bg-white dark:bg-card rounded-lg px-3 py-2 border border-border text-sm">
                            <FileText className="h-4 w-4 text-red-500 shrink-0" />
                            <span className="truncate flex-1 text-xs font-medium">{sub.file_name}</span>
                            {sub.file_url && (
                              <a href={sub.file_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                <Download className="h-4 w-4 text-primary" />
                              </a>
                            )}
                          </div>
                        )}

                        {sub.feedback && (
                          <div className="bg-white dark:bg-card p-3 rounded-lg border border-border text-sm space-y-1.5">
                            <p className="font-bold text-xs text-muted-foreground uppercase tracking-wide">Nhận xét của giáo viên</p>
                            <p className="italic text-foreground/80">&quot;{sub.feedback}&quot;</p>
                            {sub.score != null && (
                              <p className="font-bold text-primary">Điểm: {sub.score}/10</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {!sub && (
                      <Button variant="gradient" className="w-full h-10 font-semibold" onClick={() => setModalType("submit")}>
                        <Upload className="h-4 w-4 mr-2" /> Nộp bài ngay
                      </Button>
                    )}
                  </div>
                );
              })()}

              {/* ── Submit ── */}
              {modalType === "submit" && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Chấp nhận <strong>PDF, Word, JPG, PNG</strong> — tối đa {MAX_MB}MB.
                  </p>

                  {/* Drop zone */}
                  <label
                    className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                      dragOver ? "border-primary bg-primary/10 scale-[1.01]" :
                      file     ? "border-primary bg-primary/5" :
                      "border-border hover:border-primary/40 hover:bg-muted/40"
                    }`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => {
                      e.preventDefault(); setDragOver(false);
                      handleFileChange(e.dataTransfer.files[0] ?? null);
                    }}
                  >
                    <div className="flex flex-col items-center text-center px-4">
                      {file ? (
                        <>
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                            <Check className="h-6 w-6 text-primary" />
                          </div>
                          <p className="text-sm font-bold text-primary truncate max-w-[260px]">{file.name}</p>
                          <p className="text-xs text-primary/60 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground mt-2 underline"
                            onClick={e => { e.preventDefault(); setFile(null); setErrorMsg(""); }}
                          >
                            Chọn file khác
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-2">
                            <Upload className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-foreground mb-0.5">
                            <span className="text-primary font-bold">Nhấn để chọn</span> hoặc kéo thả
                          </p>
                          <p className="text-xs text-muted-foreground">PDF · DOCX · JPG · PNG · tối đa {MAX_MB}MB</p>
                        </>
                      )}
                    </div>
                    <input type="file" accept={ACCEPTED} className="hidden"
                      onChange={e => handleFileChange(e.target.files?.[0] ?? null)} />
                  </label>

                  {errorMsg && (
                    <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {errorMsg}
                    </div>
                  )}

                  {uploadState === "success" && (
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> Nộp bài thành công!
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-3 border-t border-border">
                    {uploadState === "success" ? (
                      <Button type="button" variant="gradient" onClick={() => setModalType("detail")}><Check className="h-4 w-4" />Xem bài đã nộp</Button>
                    ) : (
                      <>
                        <Button type="button" variant="ghost" onClick={closeModal} disabled={uploadState === "uploading"}>Hủy</Button>
                        <Button type="submit" variant="gradient" disabled={!file || uploadState !== "idle"} className="min-w-[150px]">
                          {uploadState === "uploading" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang tải lên...</> : "Xác nhận nộp bài"}
                        </Button>
                      </>
                    )}
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PortalLayout>
  );
}
