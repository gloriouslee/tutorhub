"use client";

import { useState, useRef, useEffect } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Edit3, ChevronDown, ChevronRight, Upload,
  PlayCircle, FileText, Pencil, Eye, EyeOff, GripVertical,
  Save, CheckCircle2, Loader2, BookOpen, Layers, Tag, Crown,
  Zap, DollarSign, Package, Wifi, Star, School,
} from "lucide-react";
import type { StudentPackage } from "@/lib/storage";
import { kvGet, kvSet } from "@/lib/storage";
import { MOCK_CLASSES } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type LessonType = "video" | "pdf" | "exercise";
type CourseType = "class" | "paid_package";

interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  isPreview: boolean;
  duration?: string;
  fileName?: string;
  fileSize?: string;
  uploading?: boolean;
}

interface Chapter {
  id: string;
  title: string;
  lessons: Lesson[];
}

type CourseTier = "basic" | "pro" | "elite";

interface Course {
  id: string;
  title: string;
  subject: string;
  grade: number;
  type: CourseType;
  classId?: string;
  price?: number;
  originalPrice?: number;   // strike-through price (before discount)
  tier?: CourseTier;        // badge shown on student marketplace
  includes: string[];       // "BAO GỒM" bullet list
  rating?: number;
  reviewCount?: number;
  description: string;
  chapters: Chapter[];
  published: boolean;
  packages: StudentPackage[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock seed data
// ─────────────────────────────────────────────────────────────────────────────

const SEED_COURSES: Course[] = [
  {
    id: "tc1", title: "Toán 12 — Giải tích & Hình học",
    subject: "Toán học", grade: 12, type: "class", classId: "c1",
    description: "Tài liệu lớp Toán 12 — dành cho học viên đã đăng ký lớp.",
    published: true, packages: ["online", "advanced", "offline"],
    includes: [],
    chapters: [
      {
        id: "ch1", title: "Hàm số & đồ thị",
        lessons: [
          { id: "l1", title: "Lý thuyết hàm số bậc 3", type: "video", isPreview: true, duration: "18:40", fileName: "ly-thuyet-ham-so.mp4", fileSize: "124 MB" },
          { id: "l2", title: "Công thức tổng hợp hàm số", type: "pdf", isPreview: true, fileName: "cong-thuc-tong-hop.pdf", fileSize: "2.4 MB" },
          { id: "l3", title: "Bài tập hàm số có hướng dẫn", type: "video", isPreview: false, duration: "24:15", fileName: "bai-tap-ham-so.mp4", fileSize: "210 MB" },
          { id: "l4", title: "Kiểm tra chương 1", type: "exercise", isPreview: false, fileName: "kiem-tra-chuong-1.pdf", fileSize: "0.6 MB" },
        ],
      },
      {
        id: "ch2", title: "Đạo hàm & ứng dụng",
        lessons: [
          { id: "l5", title: "Định nghĩa và quy tắc tính đạo hàm", type: "video", isPreview: false, duration: "22:30" },
          { id: "l6", title: "Ứng dụng đạo hàm — cực trị", type: "video", isPreview: false, duration: "31:10" },
          { id: "l7", title: "Tài liệu lý thuyết đạo hàm", type: "pdf", isPreview: false },
        ],
      },
    ],
  },
  {
    id: "tc2", title: "Toán 12 — Siêu Ôn Luyện THPT Quốc Gia",
    subject: "Toán học", grade: 12, type: "paid_package",
    price: 299000, originalPrice: 499000, tier: "pro",
    rating: 4.9, reviewCount: 218,
    includes: ["32 video bài giảng HD", "500 bài tập có đáp án", "10 đề thi thử THPT", "Tóm tắt lý thuyết mỗi chương"],
    description: "Bộ tài liệu toàn diện nhất cho kỳ thi THPT, bao gồm video bài giảng, bộ đề và đáp án chi tiết.",
    published: true, packages: ["advanced", "offline"],
    chapters: [
      {
        id: "ch1", title: "Hàm số & đồ thị (Preview)",
        lessons: [
          { id: "p1", title: "Lý thuyết hàm số — tổng quan", type: "video", isPreview: true, duration: "15:00", fileName: "preview-ham-so.mp4", fileSize: "98 MB" },
          { id: "p2", title: "Công thức nhanh hàm số", type: "pdf", isPreview: true, fileName: "cong-thuc-nhanh.pdf", fileSize: "1.1 MB" },
        ],
      },
      {
        id: "ch2", title: "Đạo hàm nâng cao",
        lessons: [
          { id: "p3", title: "Đạo hàm — kỹ thuật nâng cao", type: "video", isPreview: false, duration: "28:00" },
          { id: "p4", title: "500 bài tập đạo hàm", type: "exercise", isPreview: false },
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const LS_KEY = "tutorhub_teacher_materials";
async function loadCourses(): Promise<Course[]> {
  if (typeof window === "undefined") return SEED_COURSES;
  try {
    const raw = await kvGet<Course[] | null>(LS_KEY, null);
    if (raw) return raw;
  } catch {}
  return SEED_COURSES;
}
function saveCourses(courses: Course[]) {
  kvSet(LS_KEY, courses).catch(() => {});
}

function uid() { return Math.random().toString(36).slice(2, 9); }

const LESSON_ICONS: Record<LessonType, React.ElementType> = {
  video: PlayCircle, pdf: FileText, exercise: Pencil,
};
const LESSON_COLORS: Record<LessonType, string> = {
  video: "text-blue-500 bg-blue-100 dark:bg-blue-900/30",
  pdf: "text-red-500 bg-red-100 dark:bg-red-900/30",
  exercise: "text-green-600 bg-green-100 dark:bg-green-900/30",
};
const LESSON_LABEL: Record<LessonType, string> = {
  video: "Video", pdf: "PDF", exercise: "Bài tập",
};

const GRADE_OPTIONS = [9, 10, 11, 12];
const SUBJECT_OPTIONS = ["Toán học", "Vật lý", "Hóa học", "Tiếng Anh", "Ngữ văn", "Sinh học", "Lịch sử", "Địa lý"];

const PKG_META: Record<StudentPackage, { label: string; icon: React.ElementType; color: string; ring: string }> = {
  online:   { label: "Online",   icon: Wifi,   color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",     ring: "border-blue-400" },
  advanced: { label: "Nâng cao", icon: Star,   color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", ring: "border-purple-400" },
  offline:  { label: "Offline",  icon: School, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",   ring: "border-amber-400" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Lesson row editor
// ─────────────────────────────────────────────────────────────────────────────

function LessonRow({
  lesson,
  onUpdate,
  onDelete,
}: {
  lesson: Lesson;
  onUpdate: (patch: Partial<Lesson>) => void;
  onDelete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const Icon = LESSON_ICONS[lesson.type];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    onUpdate({ fileName: f.name, fileSize: (f.size / (1024 * 1024)).toFixed(1) + " MB" });
  };

  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-background hover:bg-muted/20 group transition-colors">
      <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab" />

      {/* Type icon */}
      <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${LESSON_COLORS[lesson.type]}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Title */}
      <input
        value={lesson.title}
        onChange={e => onUpdate({ title: e.target.value })}
        className="flex-1 min-w-0 text-sm bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
        placeholder="Tiêu đề bài học..."
      />

      {/* Type selector */}
      <select
        value={lesson.type}
        onChange={e => onUpdate({ type: e.target.value as LessonType })}
        className="h-7 rounded border border-input bg-background text-xs px-1.5 outline-none shrink-0"
      >
        <option value="video">Video</option>
        <option value="pdf">PDF</option>
        <option value="exercise">Bài tập</option>
      </select>

      {/* File upload */}
      <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
      <button
        onClick={() => fileRef.current?.click()}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors shrink-0 ${
          lesson.fileName
            ? "border-emerald-200 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800"
            : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
        }`}
        title={lesson.fileName ?? "Upload file"}
      >
        <Upload className="h-3 w-3" />
        <span className="hidden sm:inline max-w-[80px] truncate">
          {lesson.fileName ? lesson.fileSize : "Upload"}
        </span>
      </button>

      {/* Preview toggle */}
      <button
        onClick={() => onUpdate({ isPreview: !lesson.isPreview })}
        title={lesson.isPreview ? "Xem trước miễn phí (đang bật)" : "Bật xem trước miễn phí"}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors shrink-0 ${
          lesson.isPreview
            ? "border-violet-200 bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:border-violet-800 dark:text-violet-400"
            : "border-border text-muted-foreground hover:border-violet-300"
        }`}
      >
        {lesson.isPreview ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        <span className="hidden sm:inline">{lesson.isPreview ? "Preview" : "Khoá"}</span>
      </button>

      {/* Delete */}
      <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chapter block
// ─────────────────────────────────────────────────────────────────────────────

function ChapterBlock({
  chapter, idx, onUpdate, onDelete,
}: {
  chapter: Chapter;
  idx: number;
  onUpdate: (patch: Partial<Chapter>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(true);

  const addLesson = () => {
    const lesson: Lesson = { id: uid(), title: "", type: "video", isPreview: false };
    onUpdate({ lessons: [...chapter.lessons, lesson] });
  };

  const updateLesson = (lessonId: string, patch: Partial<Lesson>) =>
    onUpdate({ lessons: chapter.lessons.map(l => l.id === lessonId ? { ...l, ...patch } : l) });

  const deleteLesson = (lessonId: string) =>
    onUpdate({ lessons: chapter.lessons.filter(l => l.id !== lessonId) });

  const previewCount = chapter.lessons.filter(l => l.isPreview).length;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Chapter header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b border-border/60">
        <button onClick={() => setOpen(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <span className="text-xs font-bold text-muted-foreground min-w-[24px]">C{idx + 1}</span>
        <input
          value={chapter.title}
          onChange={e => onUpdate({ title: e.target.value })}
          className="flex-1 text-sm font-semibold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
          placeholder="Tên chương..."
        />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">{chapter.lessons.length} bài</span>
          {previewCount > 0 && (
            <span className="text-xs text-violet-600 dark:text-violet-400 flex items-center gap-0.5">
              <Eye className="h-3 w-3" />{previewCount} preview
            </span>
          )}
          <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-red-500 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Lessons */}
      {open && (
        <div className="p-3 space-y-2 bg-muted/10">
          {chapter.lessons.map(lesson => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              onUpdate={patch => updateLesson(lesson.id, patch)}
              onDelete={() => deleteLesson(lesson.id)}
            />
          ))}
          <button
            onClick={addLesson}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline px-1 py-0.5"
          >
            <Plus className="h-3.5 w-3.5" /> Thêm bài học
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Course editor panel
// ─────────────────────────────────────────────────────────────────────────────

// ── Includes editor ──────────────────────────────────────────────────────────

function IncludesEditor({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
  const [input, setInput] = useState("");

  function add() {
    const v = input.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setInput("");
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase">Bao gồm (BAO GỒM)</label>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-background">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="text-sm flex-1 text-foreground">{item}</span>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="p-0.5 rounded text-muted-foreground hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="VD: 32 video bài giảng HD"
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          />
          <Button type="button" size="sm" variant="outline" onClick={add} className="shrink-0">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CourseEditor({
  course,
  onUpdate,
  onClose,
}: {
  course: Course;
  onUpdate: (updated: Course) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Course>(course);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const patch = (p: Partial<Course>) => setDraft(prev => ({ ...prev, ...p }));

  const addChapter = () => {
    const ch: Chapter = { id: uid(), title: "", lessons: [] };
    patch({ chapters: [...draft.chapters, ch] });
  };

  const updateChapter = (id: string, p: Partial<Chapter>) =>
    patch({ chapters: draft.chapters.map(c => c.id === id ? { ...c, ...p } : c) });

  const deleteChapter = (id: string) =>
    patch({ chapters: draft.chapters.filter(c => c.id !== id) });

  const handleSave = async () => {
    setSaveState("saving");
    await new Promise(r => setTimeout(r, 600)); // simulate API
    onUpdate(draft);
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2500);
  };

  const totalLessons = draft.chapters.flatMap(c => c.lessons).length;
  const previewLessons = draft.chapters.flatMap(c => c.lessons).filter(l => l.isPreview).length;

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
          ← Danh sách khóa học
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{totalLessons} bài · {previewLessons} preview</span>
          <button
            onClick={() => patch({ published: !draft.published })}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              draft.published
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {draft.published ? "✓ Đã xuất bản" : "Bản nháp"}
          </button>
          <Button size="sm" className="gap-1.5 h-8" onClick={handleSave} disabled={saveState === "saving"}>
            {saveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saveState === "saving" ? "Đang lưu..." : "Lưu"}
          </Button>
          {saveState === "saved" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        </div>
      </div>

      {/* Meta */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Tiêu đề khóa học *</label>
              <Input value={draft.title} onChange={e => patch({ title: e.target.value })} placeholder="VD: Toán 12 — Giải tích toàn diện" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Môn học</label>
              <select
                value={draft.subject}
                onChange={e => patch({ subject: e.target.value })}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                {SUBJECT_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Khối</label>
              <select
                value={draft.grade}
                onChange={e => patch({ grade: Number(e.target.value) })}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                {GRADE_OPTIONS.map(g => <option key={g} value={g}>Khối {g}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Loại</label>
              <div className="flex gap-2">
                {([
                  { value: "class", label: "Tài liệu lớp học", icon: BookOpen },
                  { value: "paid_package", label: "Gói trả phí", icon: Package },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => patch({ type: opt.value })}
                    className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border text-sm font-medium transition-colors ${
                      draft.type === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-foreground hover:border-primary/50"
                    }`}
                  >
                    <opt.icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {draft.type === "class" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Lớp học liên kết</label>
                <select
                  value={draft.classId ?? ""}
                  onChange={e => patch({ classId: e.target.value || undefined })}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">— Chọn lớp —</option>
                  {MOCK_CLASSES.map(c => (
                    <option key={c.id} value={c.id}>{c.class_name}</option>
                  ))}
                </select>
              </div>
            )}
            {draft.type === "paid_package" && (<>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Giá bán (VND)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    className="pl-9"
                    value={draft.price ?? ""}
                    onChange={e => patch({ price: Number(e.target.value) })}
                    placeholder="VD: 299000"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Giá gốc (VND)</label>
                  {draft.originalPrice && draft.price && draft.originalPrice > draft.price && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                      -{Math.round((1 - draft.price / draft.originalPrice) * 100)}%
                    </span>
                  )}
                </div>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    className="pl-9"
                    value={draft.originalPrice ?? ""}
                    onChange={e => patch({ originalPrice: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="VD: 499000"
                  />
                </div>
                {draft.originalPrice && draft.price && draft.originalPrice <= draft.price && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">Giá gốc phải lớn hơn giá bán để hiện discount.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Cấp độ (Badge)</label>
                <div className="flex gap-2">
                  {([
                    { value: "basic",  label: "Basic",  color: "border-slate-300 bg-slate-100 text-slate-700" },
                    { value: "pro",    label: "Pro",    color: "border-violet-300 bg-violet-100 text-violet-700" },
                    { value: "elite",  label: "Elite",  color: "border-amber-300 bg-amber-100 text-amber-700" },
                  ] as const).map(({ value, label, color }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => patch({ tier: value })}
                      className={`flex-1 h-9 rounded-lg border text-xs font-semibold transition-all ${draft.tier === value ? `${color} ring-2 ring-offset-1 ring-primary/40` : "border-border text-muted-foreground hover:bg-muted"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2 flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-700 dark:text-amber-400">
                <Star className="h-4 w-4 shrink-0 mt-0.5 fill-amber-400 text-amber-400" />
                <span>Điểm đánh giá được tính tự động từ các review của học viên đã sở hữu khóa học.</span>
              </div>
            </>)}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Gói đăng ký có quyền truy cập</label>
              <div className="flex gap-2 flex-wrap">
                {(["online", "advanced", "offline"] as StudentPackage[]).map(pkg => {
                  const meta = PKG_META[pkg];
                  const selected = draft.packages.includes(pkg);
                  const Icon = meta.icon;
                  return (
                    <button
                      key={pkg}
                      type="button"
                      onClick={() => patch({
                        packages: selected
                          ? draft.packages.filter(p => p !== pkg)
                          : [...draft.packages, pkg],
                      })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                        selected
                          ? `${meta.color} ${meta.ring} border-2`
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                      {selected && <CheckCircle2 className="h-3 w-3 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">Chọn gói nào được xem tài liệu này. Học viên không thuộc gói sẽ thấy khoá.</p>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Mô tả</label>
              <textarea
                value={draft.description}
                onChange={e => patch({ description: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary"
                placeholder="Mô tả nội dung khóa học..."
              />
            </div>
          </div>

          {draft.type === "paid_package" && (<>
            <IncludesEditor
              items={draft.includes ?? []}
              onChange={items => patch({ includes: items })}
            />
            <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800/50 text-xs text-violet-700 dark:text-violet-400">
              <Eye className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Các bài học bật <strong>Preview</strong> sẽ hiển thị miễn phí cho học viên xem thử trước khi mua. Nên để ít nhất 1–2 bài preview mỗi chương.</span>
            </div>
          </>)}
        </CardContent>
      </Card>

      {/* Chapters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Nội dung khóa học</h3>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={addChapter}>
            <Plus className="h-3.5 w-3.5" /> Thêm chương
          </Button>
        </div>

        {draft.chapters.length === 0 ? (
          <div
            onClick={addChapter}
            className="border-2 border-dashed border-border rounded-xl py-10 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
          >
            <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-medium text-muted-foreground">Chưa có chương nào</p>
            <p className="text-xs text-muted-foreground mt-1">Nhấn để thêm chương đầu tiên</p>
          </div>
        ) : (
          <div className="space-y-3">
            {draft.chapters.map((ch, i) => (
              <ChapterBlock
                key={ch.id}
                chapter={ch}
                idx={i}
                onUpdate={p => updateChapter(ch.id, p)}
                onDelete={() => deleteChapter(ch.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Course list card
// ─────────────────────────────────────────────────────────────────────────────

function CourseCard({
  course,
  onEdit,
  onDelete,
}: {
  course: Course;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const totalLessons = course.chapters.flatMap(c => c.lessons).length;
  const previewCount = course.chapters.flatMap(c => c.lessons).filter(l => l.isPreview).length;
  const videoCount = course.chapters.flatMap(c => c.lessons).filter(l => l.type === "video").length;

  return (
    <Card className="group hover:shadow-md hover:border-primary/30 transition-all">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{course.subject} · Khối {course.grade}</Badge>
            {course.type === "paid_package" ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                <Zap className="h-2.5 w-2.5" /> Trả phí · {formatCurrency(course.price ?? 0)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <BookOpen className="h-2.5 w-2.5" /> Lớp học
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              course.published
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            }`}>
              {course.published ? "✓ Xuất bản" : "Nháp"}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}><Edit3 className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        <h3 className="font-semibold text-foreground text-sm mb-1 group-hover:text-primary transition-colors cursor-pointer" onClick={onEdit}>
          {course.title}
        </h3>
        <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{course.description}</p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{course.chapters.length} chương</span>
          <span className="flex items-center gap-1"><PlayCircle className="h-3 w-3" />{videoCount} video</span>
          <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{totalLessons} bài</span>
          {previewCount > 0 && (
            <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
              <Eye className="h-3 w-3" />{previewCount} preview
            </span>
          )}
        </div>
        {course.packages.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {course.packages.map(pkg => {
              const meta = PKG_META[pkg];
              const Icon = meta.icon;
              return (
                <span key={pkg} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>
                  <Icon className="h-2.5 w-2.5" />{meta.label}
                </span>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function TeacherMaterialsPage() {
  const [courses, setCourses] = useState<Course[]>(SEED_COURSES);
  const [editing, setEditing] = useState<Course | null>(null);

  useEffect(() => { loadCourses().then(setCourses); }, []);

  const createCourse = () => {
    const c: Course = {
      id: uid(), title: "", subject: "Toán học", grade: 12,
      type: "class", description: "", chapters: [], published: false,
      packages: ["online", "advanced", "offline"], includes: [],
    };
    setCourses(prev => { const next = [c, ...prev]; saveCourses(next); return next; });
    setEditing(c);
  };

  const updateCourse = (updated: Course) =>
    setCourses(prev => { const next = prev.map(c => c.id === updated.id ? updated : c); saveCourses(next); return next; });

  const deleteCourse = (id: string) => {
    setCourses(prev => { const next = prev.filter(c => c.id !== id); saveCourses(next); return next; });
    if (editing?.id === id) setEditing(null);
  };

  return (
    <PortalLayout role="teacher" userName="" pageTitle="Tài liệu">
      <div className="max-w-4xl mx-auto">
        {editing ? (
          <CourseEditor
            course={editing}
            onUpdate={updated => { updateCourse(updated); setEditing(updated); }}
            onClose={() => setEditing(null)}
          />
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-foreground">Khóa học & Tài liệu</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Xây dựng nội dung theo cấu trúc chương → bài học, bật preview cho học viên xem thử
                </p>
              </div>
              <Button className="gap-1.5" onClick={createCourse}>
                <Plus className="h-4 w-4" /> Tạo khóa học mới
              </Button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-xl text-xs text-muted-foreground border border-border/50">
              <span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-violet-500" /> Bài <strong>Preview</strong>: học viên xem miễn phí dù chưa đăng ký</span>
              <span className="flex items-center gap-1.5"><EyeOff className="h-3.5 w-3.5" /> Bài <strong>Khoá</strong>: chỉ đúng gói mới xem được</span>
              <span className="flex items-center gap-1.5"><Wifi className="h-3.5 w-3.5 text-blue-500" /> <strong>Online</strong> · <Star className="h-3.5 w-3.5 text-purple-500 ml-0.5" /> <strong>Nâng cao</strong> · <School className="h-3.5 w-3.5 text-amber-500 ml-0.5" /> <strong>Offline</strong>: gói truy cập</span>
            </div>

            {/* Course list */}
            {courses.length === 0 ? (
              <div
                onClick={createCourse}
                className="border-2 border-dashed border-border rounded-xl py-16 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
              >
                <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-medium text-foreground">Chưa có khóa học nào</p>
                <p className="text-sm text-muted-foreground mt-1">Nhấn để tạo khóa học đầu tiên</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {courses.map(c => (
                  <CourseCard
                    key={c.id}
                    course={c}
                    onEdit={() => setEditing(c)}
                    onDelete={() => deleteCourse(c.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
