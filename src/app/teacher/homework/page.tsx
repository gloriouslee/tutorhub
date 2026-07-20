"use client";

import { toLocalDateKey } from "@/lib/utils";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/shared";
import { MOCK_HOMEWORK, MOCK_CLASSES } from "@/lib/mock-data";
import { kvGet, kvUpdate, getCurriculum, getAllExamResults } from "@/lib/storage";
import { FileText, Plus, Calendar, CheckCircle2, Clock, X, Trash2, Edit2, ArrowRight, BookOpen, NotebookPen, PenSquare, Download } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const TEACHER_ID   = "t1";
const TEACHER_NAME = "Thầy Hùng Toán";
const HW_KEY       = "tutorhub_teacher_homework";
const SUB_KEY      = "tutorhub_submissions";
const CLS_KEY      = "tutorhub_teacher_classes";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Homework {
  id: string;
  class_id: string;
  title: string;
  description?: string;
  due_date: string;
  created_at: string;
  source?: "curriculum";
  kind?: "file" | "exam";
  file_url?: string;
  exam_status?: "draft" | "open" | "closed";
  exam_submitted?: number; // số học sinh đã làm (kind exam)
}

interface Submission {
  id: string;
  homework_id: string;
  student_id: string;
  score?: number;
}

interface ExtraClass {
  id: string;
  class_name: string;
  student_ids: string[];
  tutor_id: string;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function loadExtraClasses(): Promise<ExtraClass[]> {
  try { return await kvGet<ExtraClass[]>(CLS_KEY, []); } catch { return []; }
}

async function loadHw(seedIds: string[]): Promise<Homework[]> {
  try {
    const raw = await kvGet<Homework[] | null>(HW_KEY, null);
    if (raw) return raw;
    // First visit: seed from mock data filtered to teacher's classes
    return MOCK_HOMEWORK
      .filter(h => seedIds.includes(h.class_id))
      .map(h => ({ ...h, description: (h as any).description ?? "" }));
  } catch { return []; }
}

// Atomic read-modify-write: only touch the affected item, keep the rest fresh.
async function upsertHw(item: Homework, fallback: Homework[]): Promise<Homework[]> {
  return kvUpdate<Homework[]>(HW_KEY, fallback, fresh => {
    const exists = fresh.some(h => h.id === item.id);
    return exists ? fresh.map(h => (h.id === item.id ? item : h)) : [item, ...fresh];
  });
}

async function removeHw(id: string, fallback: Homework[]): Promise<Homework[]> {
  return kvUpdate<Homework[]>(HW_KEY, fallback, fresh => fresh.filter(h => h.id !== id));
}

async function loadSubs(): Promise<Submission[]> {
  try { return await kvGet<Submission[]>(SUB_KEY, []); } catch { return []; }
}

// Bài tập từ lộ trình (nộp file + làm câu hỏi) cho các lớp của giáo viên.
async function loadCurriculumHw(classes: { id: string }[]): Promise<Homework[]> {
  const today = toLocalDateKey(new Date());
  const out: Homework[] = [];
  for (const c of classes) {
    let chapters;
    try { chapters = await getCurriculum(c.id); } catch { continue; }
    for (const ch of chapters) {
      for (const s of ch.sessions) {
        for (const lesson of s.lessons) {
          if (lesson.type === "homework") {
            out.push({
              id: lesson.id, class_id: c.id, title: lesson.title, description: lesson.description,
              due_date: lesson.due_date ?? s.date ?? today, created_at: s.date ?? today,
              source: "curriculum", kind: "file", file_url: lesson.file_url,
            });
          } else if (lesson.type === "exam") {
            const results = await getAllExamResults(c.id, lesson.id).catch(() => []);
            out.push({
              id: lesson.id, class_id: c.id, title: lesson.title, description: lesson.description,
              due_date: lesson.exam_opens_at?.slice(0, 10) ?? s.date ?? today, created_at: s.date ?? today,
              source: "curriculum", kind: "exam", exam_status: lesson.exam_status ?? "draft",
              exam_submitted: results.length,
            });
          }
        }
      }
    }
  }
  return out;
}

function isOverdue(dueDate: string): boolean {
  const d = new Date(dueDate);
  d.setHours(23, 59, 59, 999);
  return d < new Date();
}

function dueStatus(dueDate: string): { label: string; color: string; dot: string } {
  const d = new Date(dueDate);
  d.setHours(23, 59, 59, 999);
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (days < 0)  return { label: "Quá hạn",        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",         dot: "bg-red-500" };
  if (days === 0) return { label: "Hôm nay",        color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", dot: "bg-amber-500" };
  if (days <= 3)  return { label: `Còn ${days} ngày`, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", dot: "bg-orange-400" };
  return              { label: "Đang mở",          color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", dot: "bg-emerald-500" };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TeacherHomeworkPage() {
  const router = useRouter();

  const [myClasses,    setMyClasses]    = useState<{ id: string; class_name: string; student_ids?: string[] }[]>([]);
  const [homeworks,    setHomeworks]    = useState<Homework[]>([]);
  const [submissions,  setSubmissions]  = useState<Submission[]>([]);
  const [filterClass,  setFilterClass]  = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "overdue">("all");
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editTarget,   setEditTarget]   = useState<Homework | null>(null);

  // Form state
  const [fTitle, setFTitle] = useState("");
  const [fClass, setFClass] = useState("");
  const [fDue,   setFDue]   = useState("");
  const [fDesc,  setFDesc]  = useState("");
  const [fErr,   setFErr]   = useState("");

  useEffect(() => {
    (async () => {
      // Build full class list: MOCK_CLASSES (filtered to teacher) + localStorage extra classes
      const baseClasses = MOCK_CLASSES.filter(c => c.tutor_id === TEACHER_ID);
      const extra       = (await loadExtraClasses()).filter(c => c.tutor_id === TEACHER_ID);
      const all = [
        ...baseClasses.map(c => ({ id: c.id, class_name: c.class_name, student_ids: c.student_ids })),
        ...extra.map(c => ({ id: c.id, class_name: c.class_name, student_ids: c.student_ids })),
      ];
      setMyClasses(all);
      setFClass(all[0]?.id ?? "");

      const allIds = all.map(c => c.id);
      const manual = await loadHw(allIds);
      const curriculum = await loadCurriculumHw(all);
      const currIds = new Set(curriculum.map(h => h.id));
      setHomeworks([...manual.filter(h => !currIds.has(h.id)), ...curriculum]);
      setSubmissions(await loadSubs());
    })();
  }, []);

  function openCreate() {
    setEditTarget(null);
    setFTitle(""); setFClass(myClasses[0]?.id ?? ""); setFDue(""); setFDesc(""); setFErr("");
    setModalOpen(true);
  }

  function openEdit(hw: Homework) {
    setEditTarget(hw);
    setFTitle(hw.title); setFClass(hw.class_id); setFDue(hw.due_date); setFDesc(hw.description ?? ""); setFErr("");
    setModalOpen(true);
  }

  function handleSave() {
    if (!fTitle.trim()) { setFErr("Vui lòng nhập tiêu đề bài tập."); return; }
    if (!fDue)          { setFErr("Vui lòng chọn hạn nộp."); return; }
    setFErr("");

    const item: Homework = editTarget
      ? { ...editTarget, title: fTitle.trim(), class_id: fClass, due_date: fDue, description: fDesc }
      : {
          id:          `h-${Date.now()}`,
          class_id:    fClass,
          title:       fTitle.trim(),
          description: fDesc,
          due_date:    fDue,
          created_at:  toLocalDateKey(new Date()),
        };
    upsertHw(item, homeworks).then(setHomeworks).catch(() => {
      setHomeworks(prev => {
        const exists = prev.some(h => h.id === item.id);
        return exists ? prev.map(h => (h.id === item.id ? item : h)) : [item, ...prev];
      });
    });
    setModalOpen(false);
  }

  function handleDelete(id: string) {
    if (!confirm("Bạn có chắc muốn xoá bài tập này không?")) return;
    removeHw(id, homeworks).then(setHomeworks).catch(() => {
      setHomeworks(prev => prev.filter(h => h.id !== id));
    });
  }

  // Submission stats per homework
  const subStats = useMemo(() => {
    const map: Record<string, { submitted: number; ungraded: number }> = {};
    homeworks.forEach(hw => {
      const subs = submissions.filter(s => s.homework_id === hw.id);
      map[hw.id] = { submitted: subs.length, ungraded: subs.filter(s => s.score == null).length };
    });
    return map;
  }, [homeworks, submissions]);

  // Bài "quá hạn": chỉ áp dụng cho bài nộp file; bài làm câu hỏi tính theo trạng thái mở/đóng.
  const isHwOverdue = (h: Homework) => h.kind !== "exam" && isOverdue(h.due_date);

  const displayed = useMemo(() =>
    homeworks.filter(hw => {
      if (filterClass !== "all" && hw.class_id !== filterClass) return false;
      if (filterStatus === "open"    &&  isHwOverdue(hw)) return false;
      if (filterStatus === "overdue" && !isHwOverdue(hw)) return false;
      return true;
    }).sort((a, b) => (b.created_at ?? b.due_date ?? "").localeCompare(a.created_at ?? a.due_date ?? "")),
    [homeworks, filterClass, filterStatus]
  );

  const openCount    = homeworks.filter(h => !isHwOverdue(h)).length;
  const overdueCount = homeworks.filter(h =>  isHwOverdue(h)).length;

  return (
    <PortalLayout role="teacher" userName={TEACHER_NAME} pageTitle="Quản lý Bài tập">
      <div className="space-y-6 max-w-6xl mx-auto">
        <SectionHeader
          title="Bài tập đã giao"
          subtitle={`${homeworks.length} bài tập · ${openCount} đang mở · ${overdueCount} quá hạn`}
          action={
            <Button size="sm" variant="gradient" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" /> Giao bài mới
            </Button>
          }
        />

        {/* ── Filters ──────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterClass("all")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${filterClass === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
          >
            Tất cả lớp
          </button>
          {myClasses.map(c => (
            <button
              key={c.id}
              onClick={() => setFilterClass(c.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${filterClass === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
            >
              {c.class_name}
            </button>
          ))}
          <div className="w-px h-5 bg-border mx-1" />
          {(["all", "open", "overdue"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${filterStatus === f ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-accent"}`}
            >
              {{ all: "Tất cả", open: "Đang mở", overdue: "Quá hạn" }[f]}
            </button>
          ))}
        </div>

        {/* ── Grid ─────────────────────────────────────────── */}
        {displayed.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground border-2 border-dashed border-border/50 rounded-2xl">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-sm">Chưa có bài tập nào.</p>
            <p className="text-xs mt-1">Nhấn "Giao bài mới" để bắt đầu.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {displayed.map((hw, i) => {
              const cls    = myClasses.find(c => c.id === hw.class_id);
              const isExam = hw.kind === "exam";
              const status = dueStatus(hw.due_date);
              const stats  = subStats[hw.id] ?? { submitted: 0, ungraded: 0 };
              const total  = cls?.student_ids?.length ?? 0;
              const submitted = isExam ? (hw.exam_submitted ?? 0) : stats.submitted;
              const examBadge = hw.exam_status === "open"
                ? { label: "● Đang mở", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" }
                : hw.exam_status === "closed"
                ? { label: "Đã đóng", cls: "bg-muted text-muted-foreground" }
                : { label: "Nháp", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };

              return (
                <Card
                  key={hw.id}
                  className="hover:shadow-md hover:-translate-y-0.5 transition-all animate-fade-in flex flex-col group border-border/60"
                  style={{ animationDelay: `${(i % 9) * 50}ms` }}
                >
                  <CardHeader className="pb-3 border-b border-border/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="p-2 bg-amber-500/10 rounded-lg shrink-0 mt-0.5">
                          <NotebookPen className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm line-clamp-2 leading-snug">{hw.title}</CardTitle>
                          <div className="flex items-center gap-1 mt-1">
                            <BookOpen className="h-3 w-3 text-muted-foreground shrink-0" />
                            <p className="text-xs text-muted-foreground truncate">{cls?.class_name ?? hw.class_id}</p>
                          </div>
                        </div>
                      </div>
                      {/* Hover actions — chỉ cho bài tạo thủ công (không phải từ lộ trình) */}
                      {hw.source !== "curriculum" && (
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(hw)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                            title="Chỉnh sửa"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(hw.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                            title="Xoá"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Status + kind */}
                    <div className="flex items-center justify-between mt-2.5 gap-2 flex-wrap">
                      {isExam ? (
                        <>
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${examBadge.cls}`}>
                            {examBadge.label}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                            <PenSquare className="h-3 w-3 shrink-0" /> Làm trên hệ thống
                          </span>
                        </>
                      ) : (
                        <>
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.color}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Calendar className="h-3 w-3 shrink-0" />
                            {new Date(hw.due_date).toLocaleDateString("vi-VN")}
                          </span>
                        </>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="py-3.5 flex-1 space-y-3">
                    {hw.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{hw.description}</p>
                    )}

                    {/* File đề bài đính kèm (kind file) */}
                    {!isExam && hw.file_url && (
                      <a
                        href={hw.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" /> Đề bài đính kèm
                      </a>
                    )}

                    {/* Submission stats */}
                    {isExam ? (
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-wide">Đã làm bài</span>
                        </div>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 leading-none">
                          {submitted}
                          {total > 0 && <span className="text-xs font-normal opacity-60 ml-1">/ {total}</span>}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wide">Đã nộp</span>
                          </div>
                          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 leading-none">
                            {submitted}
                            {total > 0 && <span className="text-xs font-normal opacity-60 ml-1">/ {total}</span>}
                          </p>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-2.5 rounded-xl border border-amber-100 dark:border-amber-800/50">
                          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-1">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wide">Chưa chấm</span>
                          </div>
                          <p className="text-lg font-bold text-amber-700 dark:text-amber-300 leading-none">
                            {stats.ungraded}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="pt-0 pb-3.5 px-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs hover:bg-primary/5 hover:text-primary hover:border-primary/40 transition-colors group/btn"
                      onClick={() => router.push(isExam
                        ? `/teacher/classes/${hw.class_id}?tab=curriculum`
                        : `/teacher/submissions?hw=${hw.id}`)}
                    >
                      {isExam ? "Mở & chấm trên lộ trình" : "Xem bài nộp & Chấm bài"}
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5 group-hover/btn:translate-x-0.5 transition-transform" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal ──────────────────────────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border/50 flex justify-between items-center bg-muted/30">
              <h2 className="font-bold text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                {editTarget ? "Chỉnh sửa bài tập" : "Giao bài tập mới"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tiêu đề bài tập *</label>
                <Input
                  value={fTitle}
                  onChange={e => { setFTitle(e.target.value); setFErr(""); }}
                  placeholder="VD: Bài tập chương 3 — Tích phân"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lớp *</label>
                  <select
                    value={fClass}
                    onChange={e => setFClass(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-card text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    {myClasses.map(c => (
                      <option key={c.id} value={c.id}>{c.class_name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hạn nộp *</label>
                  <Input type="date" value={fDue} onChange={e => { setFDue(e.target.value); setFErr(""); }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mô tả / Yêu cầu</label>
                <textarea
                  value={fDesc}
                  onChange={e => setFDesc(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground"
                  placeholder="Yêu cầu làm bài, lưu ý khi nộp bài..."
                />
              </div>

              {fErr && <p className="text-xs text-destructive">{fErr}</p>}
            </div>

            <div className="p-4 border-t border-border/50 bg-muted/20 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Huỷ</Button>
              <Button variant="gradient" onClick={handleSave}>
                {editTarget ? "Lưu thay đổi" : "Đăng bài"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
