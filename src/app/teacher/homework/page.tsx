"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PortalLayout from "@/components/layout/PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/shared";
import { HomeworkLoadingState } from "@/components/shared/HomeworkLoadingState";
import { useTeacherContext } from "@/hooks/useTeacherContext";
import SubmissionGrader, {
  type GradableSubmission,
} from "@/components/teacher/SubmissionGrader";
import {
  getAllExamResults, getCurriculum, getHwSubmissions, getStudents,
  getTeacherHomework, removeTeacherHomework, upsertTeacherHomework,
} from "@/lib/storage";
import { getSubmissionsByHomeworks } from "@/lib/supabase/submissions";
import { toLocalDateKey } from "@/lib/utils";
import {
  ArrowRight, BookOpen, Calendar, ChevronDown, ChevronRight, Download,
  Edit2, FileText, PenSquare, Plus, Trash2, X,
} from "lucide-react";

interface Assignment {
  id: string;
  classId: string;
  title: string;
  description?: string;
  kind: "file" | "exam";
  source?: "curriculum";
  dueDate: string;
  createdAt: string;
  examStatus?: "draft" | "open" | "closed";
  fileUrl?: string;
  submitted: number;
  ungraded: number;
}

type Tab = "todo" | "all" | "exam";

function isOverdue(dueDate: string): boolean {
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  return due < new Date();
}

function dueLabel(dueDate: string): { text: string; className: string } {
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: "Quá hạn", className: "text-red-600 dark:text-red-400" };
  if (days === 0) return { text: "Hết hạn hôm nay", className: "text-amber-600 dark:text-amber-400" };
  if (days <= 3) return { text: `Còn ${days} ngày`, className: "text-orange-600 dark:text-orange-400" };
  return { text: new Date(dueDate).toLocaleDateString("vi-VN"), className: "text-muted-foreground" };
}

const EXAM_BADGE = {
  open: { text: "Đang mở", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  closed: { text: "Đã đóng", className: "bg-muted text-muted-foreground" },
  draft: { text: "Nháp", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
} as const;

export default function TeacherHomeworkPage() {
  const router = useRouter();
  const { teacherId, teacherName, myClasses, ready } = useTeacherContext();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<GradableSubmission[]>([]);
  const [loadingHomework, setLoadingHomework] = useState(true);
  const [tab, setTab] = useState<Tab>("todo");
  const [classFilter, setClassFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Assignment | null>(null);
  const [form, setForm] = useState({ title: "", classId: "", due: "", description: "" });
  const [formError, setFormError] = useState("");

  const classById = useMemo(
    () => new Map(myClasses.map((cls) => [cls.id, cls])),
    [myClasses],
  );

  useEffect(() => {
    if (!ready || !teacherId) {
      if (ready) setLoadingHomework(false);
      return;
    }
    let cancelled = false;
    setLoadingHomework(true);

    (async () => {
      const classIds = myClasses.map((cls) => cls.id);
      const today = toLocalDateKey(new Date());

      const [manual, curriculumPerClass, students] = await Promise.all([
        getTeacherHomework<Record<string, unknown>>(classIds).catch(() => []),
        Promise.all(myClasses.map(async (cls) => {
          const chapters = await getCurriculum(cls.id).catch(() => []);
          const rows: Assignment[] = [];
          const examIndexes: { lessonId: string; row: number }[] = [];
          chapters.forEach((chapter) =>
            chapter.sessions.forEach((session) =>
              session.lessons.forEach((lesson) => {
                if (lesson.type === "homework") {
                  rows.push({
                    id: lesson.id, classId: cls.id, title: lesson.title,
                    description: lesson.description, kind: "file", source: "curriculum",
                    dueDate: lesson.due_date ?? session.date ?? today,
                    createdAt: session.date ?? today,
                    fileUrl: lesson.file_url, submitted: 0, ungraded: 0,
                  });
                } else if (lesson.type === "exam") {
                  examIndexes.push({ lessonId: lesson.id, row: rows.length });
                  rows.push({
                    id: lesson.id, classId: cls.id, title: lesson.title,
                    description: lesson.description, kind: "exam", source: "curriculum",
                    dueDate: lesson.exam_opens_at?.slice(0, 10) ?? session.date ?? today,
                    createdAt: session.date ?? today,
                    examStatus: lesson.exam_status ?? "draft",
                    submitted: 0, ungraded: 0,
                  });
                }
              }),
            ),
          );
          const counts = await Promise.all(
            examIndexes.map((exam) =>
              getAllExamResults(cls.id, exam.lessonId).then((r) => r.length).catch(() => 0),
            ),
          );
          examIndexes.forEach((exam, index) => { rows[exam.row].submitted = counts[index]; });
          return rows;
        })),
        getStudents().catch(() => []),
      ]);
      if (cancelled) return;

      const curriculum = curriculumPerClass.flat();
      const curriculumIds = new Set(curriculum.map((row) => row.id));
      const manualRows: Assignment[] = manual
        .filter((row) => !curriculumIds.has(String(row.id)))
        .map((row) => ({
          id: String(row.id),
          classId: String(row.class_id),
          title: String(row.title ?? ""),
          description: row.description ? String(row.description) : undefined,
          kind: "file",
          dueDate: String(row.due_date ?? today),
          createdAt: String(row.created_at ?? row.due_date ?? today),
          submitted: 0,
          ungraded: 0,
        }));

      const all = [...manualRows, ...curriculum];
      const names = new Map(students.map((student) => [student.id, student.full_name]));
      const withName = (rows: GradableSubmission[]) =>
        rows.map((row) => ({
          ...row,
          student_name: row.student_name || names.get(row.student_id) || row.student_id,
        }));

      // Nguồn Supabase là nguồn thật; bản cục bộ chỉ dùng khi chưa đồng bộ được.
      const remote = await getSubmissionsByHomeworks(all.map((row) => row.id))
        .catch(() => [] as GradableSubmission[]);
      const loaded = remote.length > 0
        ? withName(remote as GradableSubmission[])
        : withName(await getHwSubmissions<GradableSubmission>({ classIds }).catch(() => []));
      if (cancelled) return;

      all.forEach((row) => {
        if (row.kind === "exam") return;
        const mine = loaded.filter((sub) => sub.homework_id === row.id);
        row.submitted = mine.length;
        row.ungraded = mine.filter((sub) => sub.score == null).length;
      });

      setAssignments(all);
      setSubmissions(loaded);
      setForm((current) => ({ ...current, classId: current.classId || classIds[0] || "" }));
    })().finally(() => { if (!cancelled) setLoadingHomework(false); });

    return () => { cancelled = true; };
  }, [ready, teacherId, myClasses]);

  const totalUngraded = assignments.reduce((sum, row) => sum + row.ungraded, 0);
  // Chỉ bài thi đã mở mới thật sự "đang chạy"; bản nháp học viên chưa nhìn thấy.
  const liveExams = assignments.filter(
    (row) => row.kind === "exam" && row.examStatus === "open",
  ).length;
  const overdueFile = assignments.filter(
    (row) => row.kind === "file" && isOverdue(row.dueDate),
  ).length;

  const rows = useMemo(() => {
    const filtered = assignments.filter((row) => {
      if (classFilter !== "all" && row.classId !== classFilter) return false;
      if (tab === "exam") return row.kind === "exam";
      if (tab === "todo") return row.kind === "file" && row.ungraded > 0;
      return true;
    });
    // Việc cần làm lên trước: nhiều bài chưa chấm nhất, rồi tới hạn gần nhất.
    return filtered.sort((a, b) =>
      b.ungraded - a.ungraded || a.dueDate.localeCompare(b.dueDate),
    );
  }, [assignments, tab, classFilter]);

  function openCreate() {
    setEditTarget(null);
    setForm({ title: "", classId: myClasses[0]?.id ?? "", due: "", description: "" });
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(row: Assignment) {
    setEditTarget(row);
    setForm({
      title: row.title, classId: row.classId, due: row.dueDate,
      description: row.description ?? "",
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) { setFormError("Vui lòng nhập tiêu đề bài tập."); return; }
    if (!form.due) { setFormError("Vui lòng chọn hạn nộp."); return; }
    const row: Assignment = editTarget
      ? { ...editTarget, title: form.title.trim(), classId: form.classId, dueDate: form.due, description: form.description }
      : {
          id: `hw_${crypto.randomUUID()}`,
          classId: form.classId,
          title: form.title.trim(),
          description: form.description,
          kind: "file",
          dueDate: form.due,
          createdAt: toLocalDateKey(new Date()),
          submitted: 0,
          ungraded: 0,
        };
    try {
      await upsertTeacherHomework({
        id: row.id, class_id: row.classId, title: row.title,
        description: row.description, due_date: row.dueDate, created_at: row.createdAt,
      });
      setAssignments((current) =>
        current.some((item) => item.id === row.id)
          ? current.map((item) => (item.id === row.id ? row : item))
          : [row, ...current],
      );
      setModalOpen(false);
    } catch {
      setFormError("Không thể lưu bài tập. Dữ liệu cũ vẫn được giữ nguyên.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bạn có chắc muốn xoá bài tập này không?")) return;
    try {
      await removeTeacherHomework(id);
      setAssignments((current) => current.filter((row) => row.id !== id));
    } catch {
      alert("Không thể xóa bài tập. Dữ liệu cũ vẫn được giữ nguyên.");
    }
  }

  if (loadingHomework) {
    return (
      <PortalLayout role="teacher" userName={teacherName || "Giáo viên"} pageTitle="Bài tập & chấm bài">
        <HomeworkLoadingState />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout role="teacher" userName={teacherName || "Giáo viên"} pageTitle="Bài tập & chấm bài">
      <div className="mx-auto max-w-6xl space-y-5">
        <SectionHeader
          title="Bài tập & chấm bài"
          subtitle={
            totalUngraded > 0
              ? `${totalUngraded} bài đang chờ chấm · ${liveExams} bài thi đang mở · ${overdueFile} bài quá hạn`
              : `Không còn bài nào chờ chấm · ${liveExams} bài thi đang mở`
          }
          action={
            <Button size="sm" variant="gradient" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> Giao bài mới
            </Button>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          {([
            { value: "todo", label: "Cần chấm", count: assignments.filter(r => r.kind === "file" && r.ungraded > 0).length },
            { value: "all", label: "Tất cả bài tập", count: assignments.length },
            { value: "exam", label: "Bài thi", count: assignments.filter(r => r.kind === "exam").length },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => { setTab(option.value); setExpanded(null); }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                tab === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {option.label}
              {option.count > 0 && (
                <span className="ml-1.5 rounded-full bg-black/10 px-1.5 text-[10px] font-bold dark:bg-white/15">
                  {option.count}
                </span>
              )}
            </button>
          ))}

          {myClasses.length > 1 && (
            <>
              <div className="mx-1 h-5 w-px bg-border" />
              <select
                value={classFilter}
                onChange={(event) => { setClassFilter(event.target.value); setExpanded(null); }}
                className="h-8 rounded-xl border border-input bg-card px-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">Tất cả lớp</option>
                {myClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.class_name}</option>
                ))}
              </select>
            </>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border/50 py-16 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-10 w-10 opacity-20" />
            <p className="text-sm font-medium">
              {tab === "todo" ? "Không còn bài nào chờ chấm." : "Chưa có bài tập nào."}
            </p>
            {tab === "todo" && assignments.length > 0 && (
              <button
                type="button"
                onClick={() => setTab("all")}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                Xem tất cả bài tập
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            {/* Đầu bảng chỉ hiện trên màn rộng; mobile đọc theo từng dòng. */}
            <div className="hidden grid-cols-[1fr_140px_120px_110px_40px] gap-3 border-b border-border bg-muted/40 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground md:grid">
              <span>Bài tập</span>
              <span>Lớp</span>
              <span>Hạn / Trạng thái</span>
              <span className="text-right">Đã nộp · Chờ chấm</span>
              <span />
            </div>

            <div className="divide-y divide-border">
              {rows.map((row) => {
                const cls = classById.get(row.classId);
                const total = cls?.student_ids?.length ?? 0;
                const isOpen = expanded === row.id;
                const due = dueLabel(row.dueDate);
                const rowSubmissions = submissions.filter((sub) => sub.homework_id === row.id);

                return (
                  <div key={row.id} className={isOpen ? "bg-muted/20" : ""}>
                    <div className="grid grid-cols-1 items-center gap-2 px-4 py-3 md:grid-cols-[1fr_140px_120px_110px_40px] md:gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <span className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${row.kind === "exam" ? "bg-rose-500/10" : "bg-amber-500/10"}`}>
                          {row.kind === "exam"
                            ? <PenSquare className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                            : <FileText className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{row.title}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            {row.source === "curriculum" && (
                              <span className="text-[10px] font-semibold text-muted-foreground">Từ lộ trình</span>
                            )}
                            {row.fileUrl && (
                              <a
                                href={row.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                              >
                                <Download className="h-3 w-3" /> Đề bài
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <BookOpen className="h-3 w-3 shrink-0 md:hidden" />
                        {cls?.class_name ?? row.classId}
                      </span>

                      {row.kind === "exam" ? (
                        <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${EXAM_BADGE[row.examStatus ?? "draft"].className}`}>
                          {EXAM_BADGE[row.examStatus ?? "draft"].text}
                        </span>
                      ) : (
                        <span className={`flex items-center gap-1 text-xs font-medium ${due.className}`}>
                          <Calendar className="h-3 w-3 shrink-0" />
                          {due.text}
                        </span>
                      )}

                      <div className="flex items-center gap-2 md:justify-end">
                        <span className="text-sm font-bold text-foreground">
                          {row.submitted}
                          {total > 0 && <span className="text-xs font-normal text-muted-foreground">/{total}</span>}
                        </span>
                        {row.ungraded > 0 && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            {row.ungraded} chờ
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-1">
                        {row.source !== "curriculum" && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              title="Chỉnh sửa"
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row.id)}
                              title="Xoá"
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {row.kind === "exam" ? (
                          <button
                            type="button"
                            onClick={() => router.push(`/teacher/classes/${row.classId}?tab=curriculum`)}
                            title="Mở & chấm trên lộ trình"
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExpanded(isOpen ? null : row.id)}
                            title={isOpen ? "Thu gọn" : "Xem & chấm bài nộp"}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="space-y-2 border-t border-border/60 bg-card px-4 py-3">
                        {rowSubmissions.length === 0 ? (
                          <p className="py-4 text-center text-xs text-muted-foreground">
                            Chưa có học viên nào nộp bài.
                          </p>
                        ) : (
                          rowSubmissions.map((sub) => (
                            <SubmissionGrader
                              key={sub.id}
                              submission={sub}
                              classId={row.classId}
                              homeworkTitle={row.title}
                              onGraded={(patch) => {
                                setSubmissions((current) =>
                                  current.map((item) =>
                                    item.id === sub.id ? { ...item, ...patch } : item,
                                  ),
                                );
                                setAssignments((current) =>
                                  current.map((item) =>
                                    item.id === row.id && sub.score == null
                                      ? { ...item, ungraded: Math.max(0, item.ungraded - 1) }
                                      : item,
                                  ),
                                );
                              }}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 p-4">
              <h2 className="flex items-center gap-2 text-base font-bold">
                <FileText className="h-4 w-4 text-primary" />
                {editTarget ? "Chỉnh sửa bài tập" : "Giao bài tập mới"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <Input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Tiêu đề bài tập"
              />
              <select
                value={form.classId}
                onChange={(event) => setForm({ ...form, classId: event.target.value })}
                className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {myClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.class_name}</option>
                ))}
              </select>
              <Input
                type="date"
                value={form.due}
                onChange={(event) => setForm({ ...form, due: event.target.value })}
              />
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Mô tả / yêu cầu bài tập"
                rows={3}
                className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Học viên sẽ nộp bài bằng file. Bài thi làm trên hệ thống được soạn trong tab Lộ trình của lớp.
              </p>
              {formError && <p className="text-sm text-red-600" role="alert">{formError}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-border/50 bg-muted/20 p-4">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>Huỷ</Button>
              <Button variant="gradient" size="sm" onClick={handleSave}>
                {editTarget ? "Lưu thay đổi" : "Giao bài"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
