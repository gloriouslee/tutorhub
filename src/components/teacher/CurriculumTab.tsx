"use client";

import { toLocalDateKey } from "@/lib/utils";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getCurriculum, mutateCurriculum, getAllExamResults, addNotification,
  type CurriculumChapter, type CurriculumSession, type CurriculumLesson, type StoredExamResult,
} from "@/lib/storage";
import { uploadClassFile } from "@/lib/upload";
import ExamEditorModal from "@/components/teacher/ExamEditorModal";
import ExamGradingView from "@/components/teacher/ExamGradingView";
import {
  Plus, ChevronDown, ChevronRight, Trash2, Edit2, X, Check,
  PlayCircle, FileText, Video, Eye, EyeOff,
  BookOpen, CalendarDays, ChevronUp, Search,
  Upload, Loader2, AlertCircle, PenSquare, Lock, Unlock,
  Clock, Users, User, NotebookPen,
} from "lucide-react";
import { ClassSchedule } from "@/types";

interface StudentLite { id: string; full_name: string }

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
  homework: { label: "Bài tập về nhà",  icon: NotebookPen,   color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20" },
  solution: { label: "Video chữa bài",  icon: Video,         color: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20" },
  // Bài tập dạng câu hỏi (làm trên hệ thống) — hiển thị chung nhãn + icon "Bài tập về nhà",
  // phân biệt với dạng nộp file qua badge trạng thái + ghi chú "Làm trên hệ thống".
  exam:     { label: "Bài tập về nhà",  icon: NotebookPen,   color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20" },
};

// Các loại hiện trong menu "Thêm nội dung" (Bài thi được gộp vào "Bài tập về nhà"
// dưới dạng phương thức "Soạn câu hỏi", nên không có chip riêng).
const CREATE_TYPES: LessonType[] = ["lecture", "material", "homework", "solution"];

function uid() { return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

type SessionState = "done" | "today" | "upcoming" | "unscheduled";

const SESSION_STATE_META: Record<SessionState, { label: string; className: string }> = {
  done:        { label: "Đã dạy",        className: "bg-muted text-muted-foreground" },
  today:       { label: "Hôm nay",       className: "bg-primary text-primary-foreground" },
  upcoming:    { label: "Sắp tới",       className: "bg-primary/10 text-primary" },
  unscheduled: { label: "Chưa gắn ngày", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
};

function sessionState(date?: string): SessionState {
  if (!date) return "unscheduled";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return "unscheduled";
  if (target.getTime() === today.getTime()) return "today";
  return target < today ? "done" : "upcoming";
}

// Trạng thái gấp/mở được nhớ theo từng lớp: lộ trình dài hàng chục buổi, mở lại
// trang mà bung hết ra thì lần nào cũng phải cuộn tìm đúng chỗ đang làm dở.
const EXPAND_KEY = (classId: string) => `tutorhub_curriculum_open_${classId}`;

function readExpanded(classId: string): string[] | null {
  try {
    const raw = localStorage.getItem(EXPAND_KEY(classId));
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

function writeExpanded(classId: string, ids: Set<string>) {
  try {
    localStorage.setItem(EXPAND_KEY(classId), JSON.stringify([...ids]));
  } catch {
    /* hết quota hoặc bị chặn — không nhớ được thì cũng không nên chặn thao tác */
  }
}

// ── Lesson form modal ─────────────────────────────────────────────────────────
function LessonModal({
  classId,
  initial,
  students = [],
  homeworkOptions = [],
  onSave,
  onClose,
  onOpenExam,
}: {
  classId: string;
  initial?: Partial<CurriculumLesson>;
  students?: StudentLite[];
  homeworkOptions?: { id: string; title: string }[];
  onSave: (lesson: CurriculumLesson) => void;
  onClose: () => void;
  onOpenExam?: (title: string, assignedTo: string[] | null) => void;
}) {
  const [type,       setType]       = useState<LessonType>(initial?.type ?? "lecture");
  const [title,      setTitle]      = useState(initial?.title ?? "");
  const [videoUrl,   setVideoUrl]   = useState(initial?.video_url ?? "");
  const [fileUrl,    setFileUrl]    = useState(initial?.file_url ?? "");
  const [linkedHw,   setLinkedHw]   = useState(initial?.linked_homework_id ?? "");
  const [desc,       setDesc]       = useState(initial?.description ?? "");
  const [dueDate,    setDueDate]    = useState(initial?.due_date ?? "");
  const [published,  setPublished]  = useState(initial?.is_published ?? true);

  // Phạm vi hiển thị: "all" = cả lớp, "select" = chọn từng học viên
  const [scope, setScope] = useState<"all" | "select">(
    initial?.assigned_to && initial.assigned_to.length > 0 ? "select" : "all"
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initial?.assigned_to ?? []));
  function toggleStudent(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

    if ((type === "material" || type === "homework") && fileMode === "upload" && file) {
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
      file_url:     (type === "material" || type === "homework") ? resolvedFileUrl : undefined,
      description:  desc.trim() || undefined,
      due_date:     type === "homework" ? dueDate || undefined : undefined,
      is_published: published,
      assigned_to:  scope === "select" ? Array.from(selectedIds) : null,
      linked_homework_id: type === "solution" ? (linkedHw || undefined) : undefined,
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
                {CREATE_TYPES.map(key => {
                  const meta = LESSON_META[key];
                  // Chip "Bài tập về nhà" đại diện cả 2 phương thức (nộp file = homework,
                  // soạn câu hỏi = exam) nên sáng khi type là homework HOẶC exam.
                  const active = key === "homework" ? (type === "homework" || type === "exam") : type === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        if (key === "homework") setType(prev => (prev === "homework" || prev === "exam") ? prev : "homework");
                        else setType(key);
                      }}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        active ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <meta.icon className="h-4 w-4 shrink-0" />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cách giao bài tập: nộp file (homework) hoặc soạn câu hỏi làm trên hệ thống (exam) */}
          {!isEdit && (type === "homework" || type === "exam") && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">Cách giao bài</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("homework")}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    type === "homework" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <Upload className="h-4 w-4 shrink-0" /> Học sinh nộp file
                </button>
                <button
                  type="button"
                  onClick={() => setType("exam")}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    type === "exam" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <PenSquare className="h-4 w-4 shrink-0" /> Soạn câu hỏi (làm trên hệ thống)
                </button>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Tiêu đề *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={type === "lecture" ? "VD: Bài 1 — Hàm số bậc nhất" : type === "material" ? "VD: Slide chương 1" : type === "homework" ? "VD: Bài tập hàm số" : type === "exam" ? "VD: Bài tập trắc nghiệm chương 3" : "VD: Chữa bài tập buổi 1"}
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

          {/* Video chữa bài: liên kết tới bài tập tương ứng (tuỳ chọn) */}
          {type === "solution" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Bài tập tương ứng <span className="font-normal">(tuỳ chọn)</span></label>
              <select
                value={linkedHw}
                onChange={e => setLinkedHw(e.target.value)}
                className="w-full h-9 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">— Không liên kết —</option>
                {(homeworkOptions ?? []).map(hw => (
                  <option key={hw.id} value={hw.id}>{hw.title}</option>
                ))}
              </select>
              {linkedHw && !(homeworkOptions ?? []).some(hw => hw.id === linkedHw) && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Bài tập đã liên kết không còn tồn tại.</p>
              )}
            </div>
          )}

          {/* File — URL or upload (tài liệu, hoặc file đề bài cho bài tập nộp file) */}
          {(type === "material" || type === "homework") && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">{type === "homework" ? "File đề bài (tuỳ chọn)" : "Tài liệu"}</label>
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
              className={`h-5 w-9 rounded-full transition-colors relative cursor-pointer hover:opacity-90 ${published ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${published ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <span className="text-xs text-muted-foreground">{published ? "Hiển thị với học viên" : "Ẩn (bản nháp)"}</span>
          </label>

          {/* Phạm vi hiển thị — ai được thấy nội dung này */}
          {published && students.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Hiển thị cho</label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${scope === "all" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                >
                  <Users className="h-3.5 w-3.5" /> Cả lớp
                </button>
                <button
                  type="button"
                  onClick={() => setScope("select")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${scope === "select" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                >
                  <User className="h-3.5 w-3.5" /> Chọn học viên
                </button>
              </div>
              {scope === "select" && (
                <div className="space-y-1.5 rounded-xl border border-border p-2.5 bg-muted/20 max-h-44 overflow-y-auto">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] text-muted-foreground">{selectedIds.size}/{students.length} được chọn</span>
                    <button
                      type="button"
                      className="text-[11px] text-primary hover:underline"
                      onClick={() => setSelectedIds(selectedIds.size === students.length ? new Set() : new Set(students.map(s => s.id)))}
                    >
                      {selectedIds.size === students.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                    </button>
                  </div>
                  {students.map(s => (
                    <label key={s.id} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-muted/40 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        className="h-3.5 w-3.5 rounded accent-primary"
                      />
                      <span className="text-xs text-foreground">{s.full_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose} disabled={uploading}>Huỷ</Button>
          {type === "exam" && !isEdit ? (
            <Button variant="gradient" size="sm" onClick={() => { onOpenExam?.(title.trim(), scope === "select" ? Array.from(selectedIds) : null); onClose(); }} disabled={!title.trim()}>
              <PenSquare className="h-3.5 w-3.5 mr-1.5" />Soạn câu hỏi
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
export default function CurriculumTab({ classId, schedule, students = [], gradeLessonId, onGradingOpened }: { classId: string; schedule: ClassSchedule[]; students?: StudentLite[]; gradeLessonId?: string | null; onGradingOpened?: () => void }) {
  const router = useRouter();
  const slots = generateSlots(schedule);
  const [chapters,     setChapters]     = useState<CurriculumChapter[]>([]);
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set());
  const [query,        setQuery]        = useState("");
  const [typeFilter,   setTypeFilter]   = useState<"all" | LessonType>("all");
  const [onlyHidden,   setOnlyHidden]   = useState(false);
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
  const [gradingView, setGradingView] = useState<{
    lessonId: string;
    lessonTitle: string;
  } | null>(null);

  // Trình soạn bài thi đồng bộ với URL (?editExam=) để reload / back giữ nguyên
  // giao diện soạn bài thay vì rơi về danh sách curriculum.
  function setExamParams(params: Record<string, string | null>) {
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(params)) {
      if (v === null) sp.delete(k); else sp.set(k, v);
    }
    router.replace(`?${sp.toString()}`, { scroll: false });
  }
  function openExamEditor(chapterId: string, sessionId: string, lesson?: CurriculumLesson) {
    setExamModal({ chapterId, sessionId, lesson });
    // Bài đã lưu → khóa theo id; bài mới (chưa có id) → ghi vị trí chapter/session
    // để reload mở lại trình soạn (nội dung chưa lưu vẫn mất — điều này không tránh được).
    setExamParams(lesson?.id
      ? { editExam: lesson.id, editChapter: null, editSession: null }
      : { editExam: "new", editChapter: chapterId, editSession: sessionId });
  }
  function closeExamEditor() {
    setExamModal(null);
    setExamParams({ editExam: null, editChapter: null, editSession: null });
  }

  useEffect(() => {
    (async () => {
      const data = await getCurriculum(classId);
      setChapters(data);
      // Khôi phục đúng những nhánh lần trước đang mở. Lần đầu vào lớp thì chỉ mở
      // các chương — bung sẵn mọi buổi khiến trang dài hàng màn hình ngay từ đầu.
      const saved = readExpanded(classId);
      if (saved) {
        setExpanded(new Set(saved));
      } else {
        setExpanded(new Set(data.map(ch => ch.id)));
      }
      // Khôi phục trình soạn bài thi từ URL (sau reload / mở link trực tiếp)
      const sp = new URLSearchParams(window.location.search);
      const editExam = sp.get("editExam");
      if (editExam === "new") {
        const chapterId = sp.get("editChapter");
        const sessionId = sp.get("editSession");
        if (chapterId && sessionId) {
          setExamModal({ chapterId, sessionId, lesson: { id: undefined as unknown as string, type: "exam", title: "", is_published: true } });
        }
      } else if (editExam) {
        for (const ch of data) {
          for (const s of ch.sessions) {
            const l = s.lessons.find(x => x.id === editExam && x.type === "exam");
            if (l) { setExamModal({ chapterId: ch.id, sessionId: s.id, lesson: l }); return; }
          }
        }
      }
    })();
  }, [classId]);

  const [examResultsMap, setExamResultsMap] = useState<Record<string, StoredExamResult[]>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const exams = chapters.flatMap(ch => ch.sessions).flatMap(session => session.lessons).filter(lesson => lesson.type === "exam");
      const entries = await Promise.all(
        exams.map(async exam => [exam.id, await getAllExamResults(classId, exam.id)] as const),
      );
      const map = Object.fromEntries(entries) as Record<string, StoredExamResult[]>;
      if (!cancelled) setExamResultsMap(map);
    })();
    return () => { cancelled = true; };
  }, [chapters, classId]);

  // Mở / đóng trình chấm — đồng bộ URL (?grade=) để reload vẫn ở trang chấm.
  function openGrading(lessonId: string, lessonTitle: string) {
    setGradingView({ lessonId, lessonTitle });
    setExamParams({ grade: lessonId });
  }
  function closeGrading() {
    setGradingView(null);
    setExamParams({ grade: null });
  }

  // Mở thẳng trình chấm cho một bài — từ nút "Xem & chấm" (prop gradeLessonId) HOẶC
  // khôi phục từ URL sau reload (?grade=). Chỉ mở khi kết quả đã nạp xong để
  // ExamGradingView nhận đủ initialResults.
  const [urlGradeId, setUrlGradeId] = useState<string | null>(null);
  useEffect(() => {
    setUrlGradeId(new URLSearchParams(window.location.search).get("grade"));
  }, []);
  const gradingOpenedRef = useRef(false);
  useEffect(() => {
    const targetId = gradeLessonId ?? urlGradeId;
    if (!targetId || gradingOpenedRef.current) return;
    const lesson = chapters.flatMap(ch => ch.sessions.flatMap(s => s.lessons)).find(l => l.id === targetId && l.type === "exam");
    if (lesson && targetId in examResultsMap) {
      gradingOpenedRef.current = true;
      openGrading(lesson.id, lesson.title);
      onGradingOpened?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeLessonId, urlGradeId, chapters, examResultsMap]);

  // Merge-safe persist: apply the SAME pure mutation to local state AND to the
  // fresh document read right before writing (mutateCurriculum → kvUpdate),
  // so two tabs / concurrent edits don't overwrite each other's changes.
  function persist(mutate: (chapters: CurriculumChapter[]) => CurriculumChapter[]): Promise<unknown> {
    setChapters(prev => mutate(prev));
    // Trả promise để caller (VD: Lưu bài thi) CHỜ ghi xong lên server —
    // đóng modal/điều hướng trước khi ghi xong sẽ làm mất dữ liệu trên prod.
    return mutateCurriculum(classId, mutate);
  }

  function commitExpanded(next: Set<string>) {
    setExpanded(next);
    writeExpanded(classId, next);
  }

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeExpanded(classId, next);
      return next;
    });
  }

  function expandAll() {
    const ids = new Set<string>();
    chapters.forEach(ch => {
      ids.add(ch.id);
      ch.sessions.forEach(s => ids.add(s.id));
    });
    commitExpanded(ids);
  }

  function collapseAll() {
    commitExpanded(new Set());
  }

  // ── Sắp xếp lại ──
  // Trước đây chỉ có biểu tượng "tay kéo" mà không kéo được gì — nút lên/xuống
  // đổi thứ tự thật, và dùng được cả trên điện thoại.
  function moveChapter(id: string, direction: -1 | 1) {
    persist(chs => {
      const from = chs.findIndex(ch => ch.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= chs.length) return chs;
      const next = [...chs];
      [next[from], next[to]] = [next[to], next[from]];
      return next.map((ch, index) => ({ ...ch, order: index }));
    });
  }

  function moveSession(chapterId: string, sessionId: string, direction: -1 | 1) {
    persist(chs => chs.map(ch => {
      if (ch.id !== chapterId) return ch;
      const from = ch.sessions.findIndex(s => s.id === sessionId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= ch.sessions.length) return ch;
      const sessions = [...ch.sessions];
      [sessions[from], sessions[to]] = [sessions[to], sessions[from]];
      return { ...ch, sessions: sessions.map((s, index) => ({ ...s, order: index })) };
    }));
  }

  /** Bật/tắt hiển thị cho toàn bộ nội dung của một buổi — trước đây phải bấm từng cái. */
  function setSessionPublished(chapterId: string, sessionId: string, published: boolean) {
    persist(chs => chs.map(ch => ch.id !== chapterId ? ch : {
      ...ch,
      sessions: ch.sessions.map(s => s.id !== sessionId ? s : {
        ...s,
        lessons: s.lessons.map(l => ({ ...l, is_published: published })),
      }),
    }));
  }

  function updateExamField(chapterId: string, sessionId: string, lessonId: string, patch: Partial<CurriculumLesson>) {
    persist(chs => chs.map(ch => ch.id !== chapterId ? ch : {
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
    persist(chs => [...chs, ch]);
    setExpanded(prev => new Set([...prev, ch.id]));
  }

  function updateChapterTitle(id: string, title: string) {
    persist(chs => chs.map(ch => ch.id === id ? { ...ch, title } : ch));
  }

  function deleteChapter(id: string) {
    if (!confirm("Xoá chương này và toàn bộ nội dung bên trong?")) return;
    persist(chs => chs.filter(ch => ch.id !== id));
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
    persist(chs => chs.map(c => c.id === chapterId ? { ...c, sessions: [...c.sessions, session] } : c));
    setExpanded(prev => new Set([...prev, session.id]));
  }

  function updateSessionTitle(chapterId: string, sessionId: string, title: string) {
    persist(chs => chs.map(ch =>
      ch.id === chapterId
        ? { ...ch, sessions: ch.sessions.map(s => s.id === sessionId ? { ...s, title } : s) }
        : ch
    ));
  }

  function updateSessionDate(chapterId: string, sessionId: string, date: string | undefined) {
    persist(chs => chs.map(ch =>
      ch.id === chapterId
        ? { ...ch, sessions: ch.sessions.map(s => s.id === sessionId ? { ...s, date } : s) }
        : ch
    ));
  }

  // Dates already linked across all chapters+sessions
  const linkedDates = new Set(chapters.flatMap(ch => ch.sessions.map(s => s.date).filter(Boolean)));

  function deleteSession(chapterId: string, sessionId: string) {
    if (!confirm("Xoá buổi học này?")) return;
    persist(chs => chs.map(ch =>
      ch.id === chapterId ? { ...ch, sessions: ch.sessions.filter(s => s.id !== sessionId) } : ch
    ));
  }

  // ── Lesson ops ──
  function saveLesson(chapterId: string, sessionId: string, lesson: CurriculumLesson): Promise<unknown> {
    // Giao bài mới (homework/exam) đã hiển thị → báo cho học sinh của lớp.
    const isNew = !chapters.some(ch => ch.sessions.some(s => s.lessons.some(l => l.id === lesson.id)));
    if (isNew && lesson.is_published && (lesson.type === "homework" || lesson.type === "exam")) {
      const kind = lesson.type === "exam" ? "Bài tập trên hệ thống" : "Bài tập về nhà";
      void addNotification({
        title: "Bài tập mới được giao",
        content: `${kind}: "${lesson.title}" vừa được giao. Vào làm nhé!`,
        target_role: "student",
        target_class_id: classId,
        category: "assignment",
      });
    }
    return persist(chs => chs.map(ch =>
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
    persist(chs => chs.map(ch =>
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
    persist(chs => chs.map(ch =>
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
  const taughtSessions = chapters.reduce(
    (acc, ch) => acc + ch.sessions.filter(s => sessionState(s.date) === "done").length,
    0,
  );
  const progressPct = totalSessions > 0 ? Math.round((taughtSessions / totalSessions) * 100) : 0;

  // ── Lọc ──
  const normalizedQuery = query.trim().toLowerCase();
  const filtering = normalizedQuery !== "" || typeFilter !== "all" || onlyHidden;

  function lessonMatches(lesson: CurriculumLesson): boolean {
    // "Bài tập về nhà" gộp cả hai dạng nộp file và làm câu hỏi, đúng như nhãn.
    if (typeFilter !== "all") {
      const matchesType = typeFilter === "homework"
        ? lesson.type === "homework" || lesson.type === "exam"
        : lesson.type === typeFilter;
      if (!matchesType) return false;
    }
    if (onlyHidden && lesson.is_published) return false;
    if (normalizedQuery) {
      const haystack = `${lesson.title} ${lesson.description ?? ""}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  }

  const visibleLessonsOf = (session: CurriculumSession) =>
    filtering ? session.lessons.filter(lessonMatches) : session.lessons;

  // Khi đang lọc thì bung sẵn các nhánh còn kết quả, nếu không người dùng phải
  // tự mở từng chương mới thấy thứ vừa tìm.
  const isOpen = (id: string) => filtering || expanded.has(id);

  // Tra cứu tiêu đề bài học theo id (dùng hiển thị liên kết "chữa cho" trên video chữa bài)
  const lessonTitleById: Record<string, string> = {};
  chapters.forEach(ch => ch.sessions.forEach(s => s.lessons.forEach(l => { lessonTitleById[l.id] = l.title; })));

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Cấu trúc lộ trình</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span><strong className="font-semibold text-foreground">{chapters.length}</strong> chương</span>
              <span><strong className="font-semibold text-foreground">{totalSessions}</strong> buổi</span>
              <span><strong className="font-semibold text-foreground">{totalLessons}</strong> nội dung</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:shrink-0">
          {totalSessions > 0 && (
            <div className="min-w-[120px] flex-1 sm:flex-none">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Đã dạy</span>
                <span className="font-semibold text-foreground">{taughtSessions}/{totalSessions}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
          <Button size="sm" variant="gradient" onClick={addChapter} className="shrink-0">
            <Plus className="h-4 w-4 mr-1.5" /> Thêm chương
          </Button>
        </div>
      </div>

      {/* Thanh công cụ: tìm trong lộ trình, lọc, gấp/mở nhanh */}
      {chapters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Tìm bài giảng, tài liệu, bài tập…"
              className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-7 text-xs outline-none focus:ring-2 focus:ring-ring"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Xoá tìm kiếm"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as "all" | LessonType)}
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Mọi loại</option>
            {CREATE_TYPES.map(type => (
              <option key={type} value={type}>{LESSON_META[type].label}</option>
            ))}
          </select>

          <button
            onClick={() => setOnlyHidden(v => !v)}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
              onlyHidden
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
            title="Chỉ hiện nội dung học viên chưa nhìn thấy"
          >
            <EyeOff className="h-3.5 w-3.5" /> Đang ẩn
          </button>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={expandAll}
              className="rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Mở tất cả
            </button>
            <button
              onClick={collapseAll}
              className="rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Thu gọn
            </button>
          </div>
        </div>
      )}

      {chapters.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-border/50 py-14 text-center">
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
        const chExpanded = isOpen(chapter.id);
        const chapterSessions = filtering
          ? chapter.sessions.filter(s => visibleLessonsOf(s).length > 0)
          : chapter.sessions;
        // Đang lọc mà chương không còn kết quả nào thì ẩn hẳn, đỡ nhiễu.
        if (filtering && chapterSessions.length === 0) return null;
        return (
          <div key={chapter.id} className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
            {/* Chapter header */}
            <div
              className="flex cursor-pointer select-none items-center gap-2.5 bg-muted/30 px-3.5 py-2.5 transition-colors hover:bg-muted/50"
              onClick={() => toggle(chapter.id)}
            >
              <span className="flex shrink-0 flex-col" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => moveChapter(chapter.id, -1)}
                  disabled={ci === 0}
                  title="Chuyển lên"
                  className="rounded p-0.5 text-muted-foreground/50 hover:text-foreground disabled:opacity-25"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => moveChapter(chapter.id, 1)}
                  disabled={ci === chapters.length - 1}
                  title="Chuyển xuống"
                  className="rounded p-0.5 text-muted-foreground/50 hover:text-foreground disabled:opacity-25"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </span>
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
                {chapterSessions.map((session, si) => {
                  const sExpanded = isOpen(session.id);
                  const sessionLessons = visibleLessonsOf(session);
                  const publishedCount = session.lessons.filter(l => l.is_published).length;
                  const state = SESSION_STATE_META[sessionState(session.date)];
                  return (
                    <div key={session.id} className="bg-card">
                      {/* Session header — wraps on mobile so the title isn't squeezed */}
                      <div
                        className="flex cursor-pointer select-none flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-2 transition-colors hover:bg-muted/30"
                        onClick={() => toggle(session.id)}
                      >
                        {/* Left: chevron + số buổi + tên (chiếm cả hàng trên mobile) */}
                        <div className="flex items-center gap-2 min-w-0 basis-full sm:basis-0 sm:flex-1">
                        {sExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        <span className="text-xs text-muted-foreground shrink-0 w-12 sm:w-14">Buổi {si + 1}</span>
                        <span className="flex-1 min-w-0 text-sm font-medium text-foreground" onClick={e => e.stopPropagation()}>
                          <InlineEdit
                            value={session.title}
                            onSave={v => updateSessionTitle(chapter.id, session.id, v)}
                            placeholder="Tên buổi học..."
                          />
                        </span>
                        </div>

                        {/* Right: ngày + số nội dung + thêm/xóa (xuống hàng dưới trên mobile) */}
                        <div className="flex items-center gap-2 shrink-0 ml-auto pl-6 sm:pl-0">

                        {/* Date picker — select from scheduled slots */}
                        <span onClick={e => e.stopPropagation()} className="shrink-0">
                          {session.date ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              <CalendarDays className="h-3 w-3" />
                              {new Date(`${session.date}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
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

                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${state.className}`}>
                          {state.label}
                        </span>

                        {/* Bao nhiêu nội dung học viên đang thấy — trước đây chỉ có tổng số */}
                        <span
                          className="shrink-0 text-[11px] text-muted-foreground"
                          title={`${publishedCount}/${session.lessons.length} nội dung đang hiển thị với học viên`}
                        >
                          {publishedCount}/{session.lessons.length} hiện
                        </span>

                        {session.lessons.length > 0 && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setSessionPublished(chapter.id, session.id, publishedCount < session.lessons.length);
                            }}
                            title={publishedCount < session.lessons.length
                              ? "Hiển thị toàn bộ nội dung buổi này"
                              : "Ẩn toàn bộ nội dung buổi này"}
                            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            {publishedCount < session.lessons.length
                              ? <Eye className="h-3.5 w-3.5" />
                              : <EyeOff className="h-3.5 w-3.5" />}
                          </button>
                        )}

                        <span className="flex shrink-0 flex-col" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => moveSession(chapter.id, session.id, -1)}
                            disabled={si === 0}
                            title="Chuyển lên"
                            className="rounded p-0.5 text-muted-foreground/50 hover:text-foreground disabled:opacity-25"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => moveSession(chapter.id, session.id, 1)}
                            disabled={si === chapterSessions.length - 1}
                            title="Chuyển xuống"
                            className="rounded p-0.5 text-muted-foreground/50 hover:text-foreground disabled:opacity-25"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </span>

                        <button
                          onClick={e => { e.stopPropagation(); setLessonModal({ chapterId: chapter.id, sessionId: session.id }); }}
                          className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors shrink-0"
                          title="Thêm nội dung"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteSession(chapter.id, session.id); }}
                          className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        </div>
                      </div>

                      {/* Lessons */}
                      {sExpanded && (
                        <div className="space-y-1.5 px-4 pb-2.5">
                          {sessionLessons.length === 0 && (
                            <p className="text-xs text-muted-foreground py-2 italic">
                              {filtering ? "Không có nội dung khớp bộ lọc." : "Chưa có nội dung. Nhấn + để thêm."}
                            </p>
                          )}
                          {sessionLessons.map(lesson => {
                            const meta = LESSON_META[lesson.type];
                            const isExam = lesson.type === "exam";
                            const examStatus = lesson.exam_status ?? "draft";
                            const examResults = isExam ? (examResultsMap[lesson.id] ?? []) : [];

                            return (
                              <div key={lesson.id} className="space-y-0">
                                <div
                                  className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-2.5 transition-colors ${lesson.is_published ? "border-border/50 bg-background hover:border-border" : "border-dashed border-border/40 bg-muted/20 opacity-70"}`}
                                >
                                  {/* Left: icon + nội dung (chiếm cả hàng trên mobile) */}
                                  <div className="flex items-center gap-3 min-w-0 basis-full sm:basis-0 sm:flex-1">
                                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                                    <meta.icon className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate">{lesson.title}</p>
                                    {lesson.description && <p className="text-[11px] text-muted-foreground truncate">{lesson.description}</p>}
                                    {lesson.type === "homework" && <p className="text-[11px] text-muted-foreground">📎 Học sinh nộp file</p>}
                                    {isExam && <p className="text-[11px] text-muted-foreground">✏️ Làm trên hệ thống</p>}
                                    {lesson.type === "solution" && lesson.linked_homework_id && (
                                      <p className="text-[11px] text-muted-foreground truncate">
                                        ↪ Chữa cho: {lessonTitleById[lesson.linked_homework_id] ?? "(bài tập đã xoá)"}
                                      </p>
                                    )}
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
                                            onClick={() => openGrading(lesson.id, lesson.title)}
                                            className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                                          >
                                            <Users className="h-2.5 w-2.5" />{examResults.length} bài nộp
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  </div>{/* /left */}
                                  {/* Right: badge + nút (xuống hàng dưới trên mobile) */}
                                  <div className="flex items-center gap-1 shrink-0 ml-auto flex-wrap justify-end">
                                  {lesson.is_published && lesson.assigned_to && lesson.assigned_to.length > 0 && (
                                    <span
                                      className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                                      title={`Chỉ ${lesson.assigned_to.length} học viên thấy nội dung này`}
                                    >
                                      <User className="h-2.5 w-2.5" />{lesson.assigned_to.length}
                                    </span>
                                  )}
                                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${meta.color}`}>
                                    {meta.label}
                                  </span>
                                  {!lesson.is_published && (
                                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                      Đang ẩn
                                    </span>
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
                                      ? openExamEditor(chapter.id, session.id, lesson)
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
                                  </div>{/* /right */}
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
                <div className="px-4 py-2">
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
          students={students}
          homeworkOptions={chapters.flatMap(ch => ch.sessions.flatMap(s => s.lessons))
            .filter(l => l.type === "homework" || l.type === "exam")
            .map(l => ({ id: l.id, title: l.title }))}
          onSave={lesson => saveLesson(lessonModal.chapterId, lessonModal.sessionId, lesson)}
          onClose={() => setLessonModal(null)}
          onOpenExam={(title, assignedTo) => openExamEditor(
            lessonModal.chapterId,
            lessonModal.sessionId,
            { id: undefined as unknown as string, type: "exam", title, is_published: true, assigned_to: assignedTo },
          )}
        />
      )}

      {/* Exam editor modal */}
      {examModal && (
        <ExamEditorModal
          classId={classId}
          initial={examModal.lesson}
          onSave={lesson => saveLesson(examModal.chapterId, examModal.sessionId, lesson)}
          onClose={closeExamEditor}
        />
      )}

      {/* Exam grading — full-screen */}
      {gradingView && (() => {
        const examLesson = chapters.flatMap(ch => ch.sessions.flatMap(s => s.lessons)).find(l => l.id === gradingView.lessonId);
        return (
          <ExamGradingView
            classId={classId}
            lessonId={gradingView.lessonId}
            examTitle={gradingView.lessonTitle}
            questions={examLesson?.exam_content?.questions ?? []}
            scale={examLesson?.exam_content?.true_false_scale}
            initialResults={examResultsMap[gradingView.lessonId] ?? []}
            onClose={closeGrading}
            onResultsChange={results => setExamResultsMap(prev => ({ ...prev, [gradingView.lessonId]: results }))}
          />
        );
      })()}
    </div>
  );
}
