"use client";

import { toLocalDateKey } from "@/lib/utils";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getCurriculum, saveCurriculum, getAllExamResults,
  type CurriculumChapter, type CurriculumSession, type CurriculumLesson, type StoredExamResult,
} from "@/lib/storage";
import { uploadClassFile } from "@/lib/upload";
import ExamEditorModal from "@/components/teacher/ExamEditorModal";
import {
  Plus, ChevronDown, ChevronRight, Trash2, Edit2, X, Check,
  PlayCircle, FileText, ClipboardList, Video, Eye, EyeOff,
  GripVertical, BookOpen, CalendarDays, Link2, Link2Off,
  Upload, Loader2, AlertCircle, PenSquare, Lock, Unlock,
  Clock, Users, Trophy, ChevronRight as ChevRight, ChevronLeft,
} from "lucide-react";
import { ClassSchedule } from "@/types";

// ── Session generation (same logic as sessions tab) ───────────────────────────
const DAY_TO_NUM: Record<string, number> = {
  Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 0,
  "Thứ 2": 1, "Thứ 3": 2, "Thứ 4": 3, "Thứ 5": 4, "Thứ 6": 5, "Thứ 7": 6, "Chủ nhật": 0,
};

interface ScheduledSlot { date: string; label: string; start_time: string; end_time: string }

function generateSlots(schedule: ClassSchedule[]): ScheduledSlot[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - 12 * 7);
  const end   = new Date(today); end.setDate(end.getDate() + 8 * 7);
  const slots: ScheduledSlot[] = [];

  for (const sched of schedule) {
    const targetDay = DAY_TO_NUM[sched.day];
    if (targetDay === undefined) continue;
    const cursor = new Date(start);
    const diff = (targetDay - cursor.getDay() + 7) % 7;
    cursor.setDate(cursor.getDate() + diff);
    while (cursor <= end) {
      const dateStr  = toLocalDateKey(cursor);
      const dayLabel = cursor.toLocaleDateString("vi-VN", { weekday: "short" });
      const dateLabel = cursor.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
      slots.push({ date: dateStr, label: `${dayLabel} ${dateLabel} · ${sched.start_time}–${sched.end_time}`, start_time: sched.start_time, end_time: sched.end_time });
      cursor.setDate(cursor.getDate() + 7);
    }
  }
  return slots.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Types ─────────────────────────────────────────────────────────────────────
type LessonType = CurriculumLesson["type"];

const LESSON_META: Record<LessonType, { label: string; icon: React.ElementType; color: string }> = {
  lecture:  { label: "Bài giảng",       icon: PlayCircle,    color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" },
  material: { label: "Tài liệu",        icon: FileText,      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" },
  homework: { label: "Bài tập về nhà",  icon: ClipboardList, color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20" },
  solution: { label: "Video chữa bài",  icon: Video,         color: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20" },
  exam:     { label: "Bài thi",         icon: PenSquare,     color: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20" },
};

function uid() { return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

// ── Lesson form modal ─────────────────────────────────────────────────────────
function LessonModal({
  classId,
  initial,
  onSave,
  onClose,
  onOpenExam,
}: {
  classId: string;
  initial?: Partial<CurriculumLesson>;
  onSave: (lesson: CurriculumLesson) => void;
  onClose: () => void;
  onOpenExam?: (title: string) => void;
}) {
  const [type,       setType]       = useState<LessonType>(initial?.type ?? "lecture");
  const [title,      setTitle]      = useState(initial?.title ?? "");
  const [videoUrl,   setVideoUrl]   = useState(initial?.video_url ?? "");
  const [fileUrl,    setFileUrl]    = useState(initial?.file_url ?? "");
  const [desc,       setDesc]       = useState(initial?.description ?? "");
  const [dueDate,    setDueDate]    = useState(initial?.due_date ?? "");
  const [published,  setPublished]  = useState(initial?.is_published ?? true);

  // File upload state for material type
  const [fileMode,    setFileMode]   = useState<"url" | "upload">("url");
  const [file,        setFile]       = useState<File | null>(null);
  const [uploading,   setUploading]  = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!initial?.id;

  async function handleSave() {
    if (!title.trim()) return;
    setUploading(true);
    setUploadError("");

    let resolvedFileUrl = fileUrl.trim() || undefined;

    if (type === "material" && fileMode === "upload" && file) {
      try {
        const uploaded = await uploadClassFile(file, classId, "materials");
        resolvedFileUrl = uploaded.url;
      } catch (e: any) {
        setUploadError(e.message ?? "Lỗi tải lên file");
        setUploading(false);
        return;
      }
    }

    onSave({
      id:           initial?.id ?? uid(),
      type,
      title:        title.trim(),
      video_url:    (type === "lecture" || type === "solution") ? videoUrl.trim() || undefined : undefined,
      file_url:     type === "material" ? resolvedFileUrl : undefined,
      description:  desc.trim() || undefined,
      due_date:     type === "homework" ? dueDate || undefined : undefined,
      is_published: published,
    });
    setUploading(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-sm">{isEdit ? "Chỉnh sửa nội dung" : "Thêm nội dung"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {/* Type selector */}
          {!isEdit && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">Loại nội dung</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(LESSON_META) as [LessonType, typeof LESSON_META[LessonType]][]).map(([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => setType(key)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      type === key ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <meta.icon className="h-4 w-4 shrink-0" />
                    {meta.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Tiêu đề *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={type === "lecture" ? "VD: Bài 1 — Hàm số bậc nhất" : type === "material" ? "VD: Slide chương 1" : type === "homework" ? "VD: Bài tập hàm số" : "VD: Chữa bài tập buổi 1"}
              className="w-full h-9 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Video URL */}
          {(type === "lecture" || type === "solution") && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">URL video</label>
              <input
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full h-9 rounded-xl border border-border bg-background px-3 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}

          {/* File — URL or upload */}
          {type === "material" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tài liệu</label>
                <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                  <button
                    onClick={() => setFileMode("url")}
                    className={`px-2.5 py-1 transition-colors ${fileMode === "url" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  >URL</button>
                  <button
                    onClick={() => setFileMode("upload")}
                    className={`px-2.5 py-1 transition-colors ${fileMode === "upload" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  >Tải lên</button>
                </div>
              </div>

              {fileMode === "url" ? (
                <input
                  value={fileUrl}
                  onChange={e => setFileUrl(e.target.value)}
                  placeholder="https://... hoặc /uploads/file.pdf"
                  className="w-full h-9 rounded-xl border border-border bg-background px-3 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/40"
                />
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx"
                    className="hidden"
                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                  />
                  {file ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl border border-primary/30 bg-primary/5 text-sm">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="flex-1 truncate text-foreground">{file.name}</span>
                      <button onClick={() => setFile(null)} className="p-0.5 rounded hover:bg-muted text-muted-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary/50 hover:bg-primary/5 transition-all"
                    >
                      <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Nhấn để chọn file (PDF, DOCX, PPTX)</p>
                    </button>
                  )}
                  {uploadError && (
                    <div className="flex items-center gap-1.5 mt-1.5 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Due date for homework */}
          {type === "homework" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Hạn nộp</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full h-9 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Mô tả</label>
            <textarea
              rows={2}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Mô tả ngắn..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Published */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div
              onClick={() => setPublished(p => !p)}
              className={`h-5 w-9 rounded-full transition-colors relative ${published ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${published ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <span className="text-xs text-muted-foreground">{published ? "Hiển thị với học viên" : "Ẩn (bản nháp)"}</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose} disabled={uploading}>Huỷ</Button>
          {type === "exam" && !isEdit ? (
            <Button variant="gradient" size="sm" onClick={() => { onOpenExam?.(title.trim()); onClose(); }} disabled={!title.trim()}>
              <PenSquare className="h-3.5 w-3.5 mr-1.5" />Soạn bài thi
            </Button>
          ) : (
            <Button variant="gradient" size="sm" onClick={handleSave} disabled={!title.trim() || uploading}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
              {uploading ? "Đang tải lên..." : isEdit ? "Lưu" : "Thêm"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inline text editor ────────────────────────────────────────────────────────
function InlineEdit({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:text-primary transition-colors"
        onClick={() => { setDraft(value); setEditing(true); }}
      >
        {value || <span className="text-muted-foreground italic">{placeholder}</span>}
      </span>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { onSave(draft.trim() || value); setEditing(false); }}
      onKeyDown={e => {
        if (e.key === "Enter") { onSave(draft.trim() || value); setEditing(false); }
        if (e.key === "Escape") setEditing(false);
      }}
      className="bg-background border border-primary/40 rounded-lg px-2 py-0.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 min-w-[200px]"
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CurriculumTab({ classId, schedule }: { classId: string; schedule: ClassSchedule[] }) {
  const slots = generateSlots(schedule);
  const [chapters,     setChapters]     = useState<CurriculumChapter[]>([]);
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set());
  const [lessonModal,  setLessonModal]  = useState<{
    chapterId: string;
    sessionId: string;
    lesson?: CurriculumLesson;
  } | null>(null);
  const [examModal, setExamModal] = useState<{
    chapterId: string;
    sessionId: string;
    lesson?: CurriculumLesson;
  } | null>(null);
  const [resultsPanel, setResultsPanel] = useState<{
    lessonId: string;
    lessonTitle: string;
    results: StoredExamResult[];
  } | null>(null);
  const [detailStudent, setDetailStudent] = useState<StoredExamResult | null>(null);

  useEffect(() => {
    const data = getCurriculum(classId);
    setChapters(data);
    // Expand all chapters and sessions by default
    const ids = new Set<string>();
    data.forEach(ch => { ids.add(ch.id); ch.sessions.forEach(s => ids.add(s.id)); });
    setExpanded(ids);
  }, [classId]);

  function persist(next: CurriculumChapter[]) {
    setChapters(next);
    saveCurriculum(classId, next);
  }

  function toggle(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function updateExamField(chapterId: string, sessionId: string, lessonId: string, patch: Partial<CurriculumLesson>) {
    persist(chapters.map(ch => ch.id !== chapterId ? ch : {
      ...ch,
      sessions: ch.sessions.map(s => s.id !== sessionId ? s : {
        ...s,
        lessons: s.lessons.map(l => l.id !== lessonId ? l : { ...l, ...patch }),
      }),
    }));
  }

  // ── Chapter ops ──
  function addChapter() {
    const ch: CurriculumChapter = { id: uid(), title: `Chương ${chapters.length + 1}`, order: chapters.length, sessions: [] };
    const next = [...chapters, ch];
    persist(next);
    setExpanded(prev => new Set([...prev, ch.id]));
  }

  function updateChapterTitle(id: string, title: string) {
    persist(chapters.map(ch => ch.id === id ? { ...ch, title } : ch));
  }

  function deleteChapter(id: string) {
    if (!confirm("Xoá chương này và toàn bộ nội dung bên trong?")) return;
    persist(chapters.filter(ch => ch.id !== id));
  }

  // ── Session ops ──
  function addSession(chapterId: string) {
    const ch = chapters.find(c => c.id === chapterId)!;
    const session: CurriculumSession = {
      id: uid(),
      title: `Buổi ${ch.sessions.length + 1}`,
      order: ch.sessions.length,
      lessons: [],
    };
    const next = chapters.map(c => c.id === chapterId ? { ...c, sessions: [...c.sessions, session] } : c);
    persist(next);
    setExpanded(prev => new Set([...prev, session.id]));
  }

  function updateSessionTitle(chapterId: string, sessionId: string, title: string) {
    persist(chapters.map(ch =>
      ch.id === chapterId
        ? { ...ch, sessions: ch.sessions.map(s => s.id === sessionId ? { ...s, title } : s) }
        : ch
    ));
  }

  function updateSessionDate(chapterId: string, sessionId: string, date: string | undefined) {
    persist(chapters.map(ch =>
      ch.id === chapterId
        ? { ...ch, sessions: ch.sessions.map(s => s.id === sessionId ? { ...s, date } : s) }
        : ch
    ));
  }

  // Dates already linked across all chapters+sessions
  const linkedDates = new Set(chapters.flatMap(ch => ch.sessions.map(s => s.date).filter(Boolean)));

  function deleteSession(chapterId: string, sessionId: string) {
    if (!confirm("Xoá buổi học này?")) return;
    persist(chapters.map(ch =>
      ch.id === chapterId ? { ...ch, sessions: ch.sessions.filter(s => s.id !== sessionId) } : ch
    ));
  }

  // ── Lesson ops ──
  function saveLesson(chapterId: string, sessionId: string, lesson: CurriculumLesson) {
    persist(chapters.map(ch =>
      ch.id === chapterId ? {
        ...ch,
        sessions: ch.sessions.map(s =>
          s.id === sessionId ? {
            ...s,
            lessons: s.lessons.some(l => l.id === lesson.id)
              ? s.lessons.map(l => l.id === lesson.id ? lesson : l)
              : [...s.lessons, lesson],
          } : s
        ),
      } : ch
    ));
  }

  function togglePublish(chapterId: string, sessionId: string, lessonId: string) {
    persist(chapters.map(ch =>
      ch.id === chapterId ? {
        ...ch,
        sessions: ch.sessions.map(s =>
          s.id === sessionId ? {
            ...s,
            lessons: s.lessons.map(l => l.id === lessonId ? { ...l, is_published: !l.is_published } : l),
          } : s
        ),
      } : ch
    ));
  }

  function deleteLesson(chapterId: string, sessionId: string, lessonId: string) {
    persist(chapters.map(ch =>
      ch.id === chapterId ? {
        ...ch,
        sessions: ch.sessions.map(s =>
          s.id === sessionId ? { ...s, lessons: s.lessons.filter(l => l.id !== lessonId) } : s
        ),
      } : ch
    ));
  }

  // ── Total counts for header ──
  const totalSessions = chapters.reduce((acc, ch) => acc + ch.sessions.length, 0);
  const totalLessons  = chapters.reduce((acc, ch) => acc + ch.sessions.reduce((a, s) => a + s.lessons.length, 0), 0);

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {chapters.length} chương · {totalSessions} buổi · {totalLessons} nội dung
          </p>
        </div>
        <Button size="sm" variant="gradient" onClick={addChapter}>
          <Plus className="h-4 w-4 mr-1.5" /> Thêm chương
        </Button>
      </div>

      {chapters.length === 0 && (
        <div className="py-20 text-center border-2 border-dashed border-border/50 rounded-2xl">
          <BookOpen className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-foreground">Chưa có lộ trình nào</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Bắt đầu bằng cách thêm chương đầu tiên.</p>
          <Button size="sm" variant="outline" onClick={addChapter}>
            <Plus className="h-4 w-4 mr-1.5" /> Thêm chương
          </Button>
        </div>
      )}

      {/* Chapters */}
      {chapters.map((chapter, ci) => {
        const chExpanded = expanded.has(chapter.id);
        return (
          <div key={chapter.id} className="border border-border/60 rounded-2xl overflow-hidden bg-card">
            {/* Chapter header */}
            <div
              className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer select-none hover:bg-muted/50 transition-colors"
              onClick={() => toggle(chapter.id)}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              {chExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-primary">{ci + 1}</span>
              </div>
              <span className="flex-1 font-semibold text-sm text-foreground" onClick={e => e.stopPropagation()}>
                <InlineEdit
                  value={chapter.title}
                  onSave={v => updateChapterTitle(chapter.id, v)}
                  placeholder="Tên chương..."
                />
              </span>
              <Badge variant="secondary" className="text-[10px] shrink-0">{chapter.sessions.length} buổi</Badge>
              <button
                onClick={e => { e.stopPropagation(); deleteChapter(chapter.id); }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Sessions */}
            {chExpanded && (
              <div className="divide-y divide-border/50">
                {chapter.sessions.map((session, si) => {
                  const sExpanded = expanded.has(session.id);
                  return (
                    <div key={session.id} className="bg-card">
                      {/* Session header */}
                      <div
                        className="flex items-center gap-3 px-5 py-2.5 cursor-pointer select-none hover:bg-muted/30 transition-colors"
                        onClick={() => toggle(session.id)}
                      >
                        {sExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        <span className="text-xs text-muted-foreground shrink-0 w-14">Buổi {si + 1}</span>
                        <span className="flex-1 text-sm font-medium text-foreground" onClick={e => e.stopPropagation()}>
                          <InlineEdit
                            value={session.title}
                            onSave={v => updateSessionTitle(chapter.id, session.id, v)}
                            placeholder="Tên buổi học..."
                          />
                        </span>

                        {/* Date picker — select from scheduled slots */}
                        <span onClick={e => e.stopPropagation()} className="shrink-0">
                          {session.date ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              <CalendarDays className="h-3 w-3" />
                              {new Date(session.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                              <button
                                onClick={() => updateSessionDate(chapter.id, session.id, undefined)}
                                className="ml-0.5 hover:text-red-500 transition-colors"
                                title="Bỏ liên kết ngày"
                              ><X className="h-2.5 w-2.5" /></button>
                            </span>
                          ) : (
                            <select
                              value=""
                              onChange={e => { if (e.target.value) updateSessionDate(chapter.id, session.id, e.target.value); }}
                              className="h-6 text-[11px] rounded-lg border border-border bg-background px-1.5 text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                            >
                              <option value="">+ Gắn ngày</option>
                              {slots
                                .filter(slot => !linkedDates.has(slot.date) || slot.date === session.date)
                                .map(slot => (
                                  <option key={slot.date} value={slot.date}>{slot.label}</option>
                                ))
                              }
                            </select>
                          )}
                        </span>

                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {session.lessons.length} nội dung
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); setLessonModal({ chapterId: chapter.id, sessionId: session.id }); }}
                          className="p-1 rounded-lg text-primary hover:bg-primary/10 transition-colors shrink-0"
                          title="Thêm nội dung"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteSession(chapter.id, session.id); }}
                          className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Lessons */}
                      {sExpanded && (
                        <div className="px-5 pb-3 space-y-1.5">
                          {session.lessons.length === 0 && (
                            <p className="text-xs text-muted-foreground py-2 italic">Chưa có nội dung. Nhấn + để thêm.</p>
                          )}
                          {session.lessons.map(lesson => {
                            const meta = LESSON_META[lesson.type];
                            const isExam = lesson.type === "exam";
                            const examStatus = lesson.exam_status ?? "draft";
                            const examResults = isExam ? getAllExamResults(classId, lesson.id) : [];

                            return (
                              <div key={lesson.id} className="space-y-0">
                                <div
                                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${lesson.is_published ? "border-border/50 bg-background" : "border-dashed border-border/40 bg-muted/20 opacity-70"}`}
                                >
                                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                                    <meta.icon className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate">{lesson.title}</p>
                                    {lesson.description && <p className="text-[11px] text-muted-foreground truncate">{lesson.description}</p>}
                                    {lesson.due_date && <p className="text-[11px] text-muted-foreground">Hạn: {new Date(lesson.due_date).toLocaleDateString("vi-VN")}</p>}
                                    {/* Exam status badge inline */}
                                    {isExam && (
                                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                          examStatus === "open"   ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                          : examStatus === "closed" ? "bg-muted text-muted-foreground"
                                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                        }`}>
                                          {examStatus === "open" ? "● Đang mở" : examStatus === "closed" ? "Đã đóng" : "Nháp"}
                                        </span>
                                        {lesson.exam_opens_at && examStatus === "draft" && (
                                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                            <Clock className="h-2.5 w-2.5" />
                                            {new Date(lesson.exam_opens_at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                          </span>
                                        )}
                                        {examResults.length > 0 && (
                                          <button
                                            onClick={() => setResultsPanel({ lessonId: lesson.id, lessonTitle: lesson.title, results: examResults })}
                                            className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                                          >
                                            <Users className="h-2.5 w-2.5" />{examResults.length} bài nộp
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${meta.color}`}>
                                    {meta.label}
                                  </span>
                                  {!lesson.is_published && (
                                    <span className="text-[10px] text-muted-foreground shrink-0">Ẩn</span>
                                  )}
                                  {/* Exam open/close toggle */}
                                  {isExam && (
                                    <button
                                      title={examStatus === "open" ? "Đóng bài thi" : "Mở bài thi cho học sinh"}
                                      onClick={() => updateExamField(chapter.id, session.id, lesson.id, {
                                        exam_status: examStatus === "open" ? "closed" : "open",
                                      })}
                                      className={`p-1 rounded-lg transition-colors shrink-0 ${
                                        examStatus === "open"
                                          ? "text-emerald-600 hover:text-red-500"
                                          : "text-muted-foreground hover:text-emerald-600"
                                      }`}
                                    >
                                      {examStatus === "open" ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                                    </button>
                                  )}
                                  {/* Actions */}
                                  <button
                                    onClick={() => togglePublish(chapter.id, session.id, lesson.id)}
                                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                    title={lesson.is_published ? "Ẩn khỏi học viên" : "Hiển thị với học viên"}
                                  >
                                    {lesson.is_published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                  </button>
                                  <button
                                    onClick={() => lesson.type === "exam"
                                      ? setExamModal({ chapterId: chapter.id, sessionId: session.id, lesson })
                                      : setLessonModal({ chapterId: chapter.id, sessionId: session.id, lesson })}
                                    className="p-1 rounded-lg text-muted-foreground hover:text-primary transition-colors shrink-0"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteLesson(chapter.id, session.id, lesson.id)}
                                    className="p-1 rounded-lg text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          <button
                            onClick={() => setLessonModal({ chapterId: chapter.id, sessionId: session.id })}
                            className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1 pl-1"
                          >
                            <Plus className="h-3.5 w-3.5" /> Thêm nội dung
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add session */}
                <div className="px-4 py-2.5">
                  <button
                    onClick={() => addSession(chapter.id)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm buổi học
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Lesson modal */}
      {lessonModal && (
        <LessonModal
          classId={classId}
          initial={lessonModal.lesson}
          onSave={lesson => saveLesson(lessonModal.chapterId, lessonModal.sessionId, lesson)}
          onClose={() => setLessonModal(null)}
          onOpenExam={title => setExamModal({
            chapterId: lessonModal.chapterId,
            sessionId: lessonModal.sessionId,
            lesson: { id: undefined as any, type: "exam", title, is_published: true },
          })}
        />
      )}

      {/* Exam editor modal */}
      {examModal && (
        <ExamEditorModal
          classId={classId}
          initial={examModal.lesson}
          onSave={lesson => saveLesson(examModal.chapterId, examModal.sessionId, lesson)}
          onClose={() => setExamModal(null)}
        />
      )}

      {/* Exam results panel */}
      {resultsPanel && (() => {
        // Get questions for this exam from loaded chapters
        const examLesson = chapters.flatMap(ch => ch.sessions.flatMap(s => s.lessons)).find(l => l.id === resultsPanel.lessonId);
        const questions  = examLesson?.exam_content?.questions ?? [];
        const OPTS       = ["A", "B", "C", "D"];

        function stripHtml(html: string) {
          return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        }

        function isCorrect(q: typeof questions[0], ans: Record<string, unknown>): boolean {
          if (q.type === "multiple_choice") return ans.selected_option === q.correct_option;
          if (q.type === "true_false")      return ans.selected_value === q.correct_value;
          if (q.type === "fill_blank")      return String(ans.selected_value ?? "").trim().toLowerCase() === String(q.correct_value ?? "").trim().toLowerCase();
          return true;
        }

        const sorted = [...resultsPanel.results].sort((a, b) => (b.score / (b.total || 1)) - (a.score / (a.total || 1)));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="bg-card w-full max-w-lg rounded-3xl border border-border shadow-xl flex flex-col max-h-[85vh]">

              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
                {detailStudent ? (
                  <button onClick={() => setDetailStudent(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                ) : (
                  <Trophy className="h-5 w-5 text-primary shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  {detailStudent ? (
                    <>
                      <p className="text-sm font-semibold text-foreground truncate">{detailStudent.student_name || detailStudent.student_id}</p>
                      <p className="text-xs text-muted-foreground">{resultsPanel.lessonTitle}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-foreground truncate">{resultsPanel.lessonTitle}</p>
                      <p className="text-xs text-muted-foreground">{resultsPanel.results.length} học sinh đã nộp bài</p>
                    </>
                  )}
                </div>
                <button onClick={() => { setResultsPanel(null); setDetailStudent(null); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* ── List view ── */}
              {!detailStudent && (
                <div className="overflow-y-auto flex-1 px-5 py-4 space-y-2">
                  {resultsPanel.results.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Chưa có học sinh nộp bài.</p>
                  ) : (
                    <>
                      {/* Stats */}
                      {(() => {
                        const scores = resultsPanel.results.map(r => r.total > 0 ? Math.round((r.score / r.total) * 100) : 0);
                        const avg    = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                        const passed = scores.filter(s => s >= 50).length;
                        return (
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {[
                              { label: "Trung bình", value: `${avg}%`,                              cls: "text-primary" },
                              { label: "Đạt (≥50%)", value: passed,                                cls: "text-emerald-600 dark:text-emerald-400" },
                              { label: "Chưa đạt",   value: resultsPanel.results.length - passed,  cls: "text-red-500 dark:text-red-400" },
                            ].map(s => (
                              <div key={s.label} className="bg-muted/50 rounded-xl p-2.5 text-center border border-border">
                                <div className={`text-lg font-bold ${s.cls}`}>{s.value}</div>
                                <div className="text-[10px] text-muted-foreground">{s.label}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Student rows — clickable */}
                      {sorted.map((r, i) => {
                        const pct    = r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
                        const passed = pct >= 50;
                        return (
                          <button
                            key={r.student_id}
                            onClick={() => setDetailStudent(r)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-muted/30 transition-all text-left group"
                          >
                            <span className="text-xs font-bold text-muted-foreground w-5 shrink-0 text-center">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{r.student_name || r.student_id}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {new Date(r.submitted_at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                              <div className={`h-full rounded-full ${passed ? "bg-emerald-500" : "bg-red-400"}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`text-xs font-bold shrink-0 w-12 text-right ${passed ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                              {r.score}/{r.total}đ
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${passed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                              {pct}%
                            </span>
                            <ChevRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}

              {/* ── Detail view ── */}
              {detailStudent && (() => {
                const pct    = detailStudent.total > 0 ? Math.round((detailStudent.score / detailStudent.total) * 100) : 0;
                const passed = pct >= 50;
                const answers = detailStudent.answers as Record<string, Record<string, unknown>>;

                return (
                  <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
                    {/* Score summary */}
                    <div className={`flex items-center gap-4 p-4 rounded-2xl border-2 ${passed ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800/50" : "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800/50"}`}>
                      <div className="flex-1">
                        <p className={`text-2xl font-bold ${passed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{pct}%</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{detailStudent.score}/{detailStudent.total} điểm · {passed ? "Đạt" : "Chưa đạt"}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>Nộp lúc</p>
                        <p className="font-medium text-foreground">{new Date(detailStudent.submitted_at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>

                    {/* Per-question */}
                    {questions.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Không tìm thấy câu hỏi (đề thi có thể đã bị sửa).</p>
                    )}
                    {questions.map((q, idx) => {
                      const ans     = answers[q.id] ?? {};
                      const correct = isCorrect(q, ans);

                      return (
                        <div key={q.id} className={`rounded-2xl border p-3.5 space-y-2 ${correct ? "border-emerald-200 dark:border-emerald-800/50" : q.type === "essay" ? "border-amber-200 dark:border-amber-800/50" : "border-red-200 dark:border-red-800/50"}`}>
                          {/* Question row */}
                          <div className="flex items-start gap-2">
                            <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${correct ? "bg-emerald-500 text-white" : q.type === "essay" ? "bg-amber-400 text-white" : "bg-red-500 text-white"}`}>
                              {correct ? "✓" : q.type === "essay" ? "~" : "✗"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-muted-foreground mb-0.5">Câu {idx + 1} · {q.score}đ</p>
                              <p className="text-sm text-foreground leading-snug">{stripHtml(q.content_html)}</p>
                            </div>
                          </div>

                          {/* Answer detail */}
                          {q.type === "multiple_choice" && (
                            <div className="space-y-1 pl-7">
                              {(q.options ?? []).map((opt, i) => {
                                const isStudentPick = ans.selected_option === i;
                                const isCorrectOpt  = q.correct_option === i;
                                if (!isStudentPick && !isCorrectOpt) return null;
                                return (
                                  <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${isCorrectOpt ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
                                    <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${isCorrectOpt ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>{OPTS[i]}</span>
                                    <span className="flex-1 truncate">{stripHtml(opt)}</span>
                                    <span className="font-semibold shrink-0">{isCorrectOpt ? "Đáp án" : "Bạn chọn"}</span>
                                  </div>
                                );
                              })}
                              {ans.selected_option === undefined && (
                                <p className="text-xs text-muted-foreground italic pl-1">Chưa trả lời</p>
                              )}
                            </div>
                          )}

                          {q.type === "true_false" && (
                            <div className="pl-7 flex gap-2 text-xs">
                              <span className={`px-2.5 py-1 rounded-lg ${ans.selected_value === "true" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : ans.selected_value === "false" ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" : "bg-muted text-muted-foreground"}`}>
                                Học sinh: {ans.selected_value === "true" ? "✓ Đúng" : ans.selected_value === "false" ? "✗ Sai" : "Chưa trả lời"}
                              </span>
                              {!correct && (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                                  Đáp án: {q.correct_value === "true" ? "✓ Đúng" : "✗ Sai"}
                                </span>
                              )}
                            </div>
                          )}

                          {q.type === "fill_blank" && (
                            <div className="pl-7 flex gap-2 flex-wrap text-xs">
                              <span className={`px-2.5 py-1 rounded-lg ${correct ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
                                Học sinh: <strong>{String(ans.selected_value || "(trống)")}</strong>
                              </span>
                              {!correct && (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                                  Đáp án: <strong>{q.correct_value}</strong>
                                </span>
                              )}
                            </div>
                          )}

                          {q.type === "essay" && (
                            <div className="pl-7 text-xs">
                              {ans.essay_text ? (
                                <div className="bg-muted/40 rounded-xl p-2.5 text-foreground whitespace-pre-wrap leading-relaxed">
                                  {String(ans.essay_text)}
                                </div>
                              ) : (
                                <p className="text-muted-foreground italic">Chưa trả lời</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

            </div>
          </div>
        );
      })()}
    </div>
  );
}
