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
  Save, CheckCircle2, Loader2, BookOpen, Layers,
  Zap, DollarSign, Package, Wifi, Star, School,
  X, Check, Edit2, AlertCircle, Link2, File as FileIcon,
} from "lucide-react";
import type { StudentPackage } from "@/lib/storage";
import { kvGet, kvSet } from "@/lib/storage";
import { MOCK_CLASSES } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";
import { uploadClassFile } from "@/lib/upload";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type LessonType = "video" | "pdf" | "exercise";
type CourseType = "class" | "paid_package";
// "course" = cấu trúc chương → bài (mặc định); "single" = tài liệu đơn lẻ,
// chỉ một danh sách nội dung phẳng — dùng khi bán 1 tài liệu thay vì cả khóa.
type CourseFormat = "course" | "single";

interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  isPreview: boolean;
  duration?: string;      // video — "18:40"
  videoUrl?: string;      // video — link YouTube/Vimeo...
  fileUrl?: string;       // tài liệu đính kèm (URL hoặc file đã upload)
  fileName?: string;
  fileSize?: string;
  description?: string;
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
  format?: CourseFormat;    // mặc định "course" (tương thích dữ liệu cũ)
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
// Inline text editor (giống lộ trình — nhấn vào tên để sửa)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Lesson modal (giống "Thêm nội dung" của lộ trình)
// ─────────────────────────────────────────────────────────────────────────────

const LESSON_TYPE_META: Record<LessonType, { label: string; icon: React.ElementType }> = {
  video:    { label: "Video bài giảng", icon: PlayCircle },
  pdf:      { label: "Tài liệu PDF",    icon: FileText },
  exercise: { label: "Bài tập",         icon: Pencil },
};

function LessonModal({
  courseId,
  initial,
  onSave,
  onClose,
}: {
  courseId: string;
  initial?: Lesson;
  onSave: (lesson: Lesson) => void;
  onClose: () => void;
}) {
  const [type,      setType]      = useState<LessonType>(initial?.type ?? "video");
  const [title,     setTitle]     = useState(initial?.title ?? "");
  const [videoUrl,  setVideoUrl]  = useState(initial?.videoUrl ?? "");
  const [duration,  setDuration]  = useState(initial?.duration ?? "");
  const [fileUrl,   setFileUrl]   = useState(initial?.fileUrl ?? "");
  const [desc,      setDesc]      = useState(initial?.description ?? "");
  const [isPreview, setIsPreview] = useState(initial?.isPreview ?? false);

  // Tài liệu đính kèm — URL hoặc upload thật (giống lộ trình)
  const [fileMode,    setFileMode]    = useState<"url" | "upload">("url");
  const [file,        setFile]        = useState<File | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!initial?.id;

  async function handleSave() {
    if (!title.trim()) return;
    setUploadError("");

    let resolvedFileUrl = fileUrl.trim() || undefined;
    let fileName = initial?.fileName;
    let fileSize = initial?.fileSize;

    if (fileMode === "upload" && file) {
      setUploading(true);
      try {
        const uploaded = await uploadClassFile(file, courseId, "materials");
        resolvedFileUrl = uploaded.url;
        fileName = uploaded.name;
        fileSize = uploaded.size;
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "Lỗi tải lên file");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onSave({
      id:          initial?.id ?? uid(),
      title:       title.trim(),
      type,
      isPreview,
      duration:    type === "video" ? duration.trim() || undefined : undefined,
      videoUrl:    type === "video" ? videoUrl.trim() || undefined : undefined,
      fileUrl:     resolvedFileUrl,
      fileName,
      fileSize,
      description: desc.trim() || undefined,
    });
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
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">Loại nội dung</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(LESSON_TYPE_META) as [LessonType, typeof LESSON_TYPE_META[LessonType]][]).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    type === key ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <meta.icon className="h-4 w-4 shrink-0" />
                  {meta.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Tiêu đề *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={type === "video" ? "VD: Lý thuyết hàm số bậc 3" : type === "pdf" ? "VD: Công thức tổng hợp hàm số" : "VD: 50 câu trắc nghiệm hàm số"}
              className="w-full h-9 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Video URL + duration */}
          {type === "video" && (
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">URL video</label>
                <input
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full h-9 rounded-xl border border-border bg-background px-3 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Thời lượng</label>
                <input
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  placeholder="18:40"
                  className="w-full h-9 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          )}

          {/* File — URL or upload */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {type === "video" ? "Tài liệu kèm theo (tuỳ chọn)" : "Tài liệu"}
              </label>
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
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"
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
                ) : initial?.fileName ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/20 text-sm">
                    <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate text-muted-foreground">{initial.fileName} · {initial.fileSize}</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-primary hover:underline shrink-0"
                    >Thay file</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary/50 hover:bg-primary/5 transition-all"
                  >
                    <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Nhấn để chọn file (PDF, DOCX, PPTX, ZIP)</p>
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

          {/* Preview toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div
              onClick={() => setIsPreview(p => !p)}
              className={`h-5 w-9 rounded-full transition-colors relative cursor-pointer hover:opacity-90 ${isPreview ? "bg-violet-500" : "bg-muted-foreground/30"}`}
            >
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isPreview ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {isPreview
                ? <><Eye className="h-3 w-3 text-violet-500" /> Xem trước miễn phí — học viên xem thử được trước khi mua</>
                : <><EyeOff className="h-3 w-3" /> Khoá — chỉ học viên đã sở hữu mới xem được</>}
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose} disabled={uploading}>Huỷ</Button>
          <Button variant="gradient" size="sm" onClick={handleSave} disabled={!title.trim() || uploading}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
            {uploading ? "Đang tải lên..." : isEdit ? "Lưu" : "Thêm"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lesson row (hiển thị — mọi chỉnh sửa qua modal, giống lộ trình)
// ─────────────────────────────────────────────────────────────────────────────

function LessonRowItem({
  lesson,
  onTogglePreview,
  onEdit,
  onDelete,
}: {
  lesson: Lesson;
  onTogglePreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = LESSON_ICONS[lesson.type];
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border/50 bg-background hover:border-border transition-colors">
      <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${LESSON_COLORS[lesson.type]}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{lesson.title || <span className="italic text-muted-foreground">Chưa có tiêu đề</span>}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {lesson.description && <p className="text-[11px] text-muted-foreground truncate">{lesson.description}</p>}
          {lesson.duration && <span className="text-[11px] text-muted-foreground shrink-0">{lesson.duration}</span>}
          {lesson.videoUrl && (
            <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-0.5 shrink-0">
              <Link2 className="h-2.5 w-2.5" />video
            </span>
          )}
          {(lesson.fileName || lesson.fileUrl) && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 shrink-0 max-w-[140px] truncate">
              <FileIcon className="h-2.5 w-2.5 shrink-0" />{lesson.fileName ?? "file"}{lesson.fileSize ? ` · ${lesson.fileSize}` : ""}
            </span>
          )}
        </div>
      </div>
      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${LESSON_COLORS[lesson.type]}`}>
        {LESSON_LABEL[lesson.type]}
      </span>
      {/* Preview toggle */}
      <button
        onClick={onTogglePreview}
        title={lesson.isPreview ? "Xem trước miễn phí (đang bật)" : "Bật xem trước miễn phí"}
        className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-colors shrink-0 ${
          lesson.isPreview
            ? "border-violet-200 bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:border-violet-800 dark:text-violet-400"
            : "border-border text-muted-foreground hover:border-violet-300"
        }`}
      >
        {lesson.isPreview ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        <span className="hidden sm:inline">{lesson.isPreview ? "Preview" : "Khoá"}</span>
      </button>
      <button onClick={onEdit} className="p-1 rounded-lg text-muted-foreground hover:text-primary transition-colors shrink-0">
        <Edit2 className="h-3.5 w-3.5" />
      </button>
      <button onClick={onDelete} className="p-1 rounded-lg text-muted-foreground hover:text-red-500 transition-colors shrink-0">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chapter block (giống lộ trình: header nhấn để đóng/mở, sửa tên inline)
// ─────────────────────────────────────────────────────────────────────────────

function ChapterBlock({
  chapter, idx, onUpdate, onDelete, onAddLesson, onEditLesson,
}: {
  chapter: Chapter;
  idx: number;
  onUpdate: (patch: Partial<Chapter>) => void;
  onDelete: () => void;
  onAddLesson: () => void;
  onEditLesson: (lesson: Lesson) => void;
}) {
  const [open, setOpen] = useState(true);

  const updateLesson = (lessonId: string, patch: Partial<Lesson>) =>
    onUpdate({ lessons: chapter.lessons.map(l => l.id === lessonId ? { ...l, ...patch } : l) });

  const deleteLesson = (lessonId: string) =>
    onUpdate({ lessons: chapter.lessons.filter(l => l.id !== lessonId) });

  const previewCount = chapter.lessons.filter(l => l.isPreview).length;

  return (
    <div className="border border-border/60 rounded-2xl overflow-hidden bg-card">
      {/* Chapter header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer select-none hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-primary">{idx + 1}</span>
        </div>
        <span className="flex-1 font-semibold text-sm text-foreground" onClick={e => e.stopPropagation()}>
          <InlineEdit
            value={chapter.title}
            onSave={v => onUpdate({ title: v })}
            placeholder="Tên chương..."
          />
        </span>
        <Badge variant="secondary" className="text-[10px] shrink-0">{chapter.lessons.length} nội dung</Badge>
        {previewCount > 0 && (
          <span className="text-xs text-violet-600 dark:text-violet-400 flex items-center gap-0.5 shrink-0">
            <Eye className="h-3 w-3" />{previewCount}
          </span>
        )}
        <button
          onClick={e => { e.stopPropagation(); onAddLesson(); }}
          className="p-1 rounded-lg text-primary hover:bg-primary/10 transition-colors shrink-0"
          title="Thêm nội dung"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Lessons */}
      {open && (
        <div className="px-4 py-3 space-y-1.5">
          {chapter.lessons.length === 0 && (
            <p className="text-xs text-muted-foreground py-1 italic">Chưa có nội dung. Nhấn + để thêm.</p>
          )}
          {chapter.lessons.map(lesson => (
            <LessonRowItem
              key={lesson.id}
              lesson={lesson}
              onTogglePreview={() => updateLesson(lesson.id, { isPreview: !lesson.isPreview })}
              onEdit={() => onEditLesson(lesson)}
              onDelete={() => deleteLesson(lesson.id)}
            />
          ))}
          <button
            onClick={onAddLesson}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1 pl-1"
          >
            <Plus className="h-3.5 w-3.5" /> Thêm nội dung
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
  const [lessonModal, setLessonModal] = useState<{ chapterId: string; lesson?: Lesson } | null>(null);

  const patch = (p: Partial<Course>) => setDraft(prev => ({ ...prev, ...p }));

  const format: CourseFormat = draft.format ?? "course";

  const addChapter = () => {
    const ch: Chapter = { id: uid(), title: "", lessons: [] };
    patch({ chapters: [...draft.chapters, ch] });
  };

  const updateChapter = (id: string, p: Partial<Chapter>) =>
    patch({ chapters: draft.chapters.map(c => c.id === id ? { ...c, ...p } : c) });

  const deleteChapter = (id: string) => {
    if (draft.chapters.find(c => c.id === id)?.lessons.length && !confirm("Xoá chương này và toàn bộ nội dung bên trong?")) return;
    patch({ chapters: draft.chapters.filter(c => c.id !== id) });
  };

  // Chuyển đổi cấu trúc: "single" gộp mọi chương thành một danh sách phẳng
  const switchFormat = (f: CourseFormat) => {
    if (f === format) return;
    if (f === "single") {
      const flat = draft.chapters.flatMap(c => c.lessons);
      if (draft.chapters.length > 1 && !confirm("Chuyển sang Tài liệu đơn sẽ gộp tất cả chương thành một danh sách nội dung. Tiếp tục?")) return;
      patch({ format: f, chapters: [{ id: draft.chapters[0]?.id ?? uid(), title: "Nội dung", lessons: flat }] });
    } else {
      patch({ format: f });
    }
  };

  // Lưu (thêm/sửa) một nội dung vào đúng chương
  const saveLesson = (chapterId: string, lesson: Lesson) =>
    patch({
      chapters: draft.chapters.map(c => c.id !== chapterId ? c : {
        ...c,
        lessons: c.lessons.some(l => l.id === lesson.id)
          ? c.lessons.map(l => l.id === lesson.id ? lesson : l)
          : [...c.lessons, lesson],
      }),
    });

  // "Tài liệu đơn": mọi nội dung nằm trong một chương ẩn duy nhất
  const openAddSingle = () => {
    let ch = draft.chapters[0];
    if (!ch) {
      ch = { id: uid(), title: "Nội dung", lessons: [] };
      patch({ chapters: [ch] });
    }
    setLessonModal({ chapterId: ch.id });
  };

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
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Cấu trúc nội dung</label>
              <div className="flex gap-2">
                {([
                  { value: "course",  label: "Khóa học (chương → bài)", icon: Layers },
                  { value: "single",  label: "Tài liệu đơn",            icon: FileText },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => switchFormat(opt.value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border text-sm font-medium transition-colors ${
                      format === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-foreground hover:border-primary/50"
                    }`}
                  >
                    <opt.icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {format === "single"
                  ? "Bán một (hoặc vài) tài liệu lẻ — không chia chương."
                  : "Nội dung tổ chức theo chương → bài học, giống lộ trình lớp học."}
              </p>
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

      {/* Content builder — chương → bài (course) hoặc danh sách phẳng (single) */}
      {format === "course" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Nội dung khóa học</h3>
            <Button size="sm" variant="gradient" className="h-8 gap-1.5 text-xs" onClick={addChapter}>
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
                  onAddLesson={() => setLessonModal({ chapterId: ch.id })}
                  onEditLesson={lesson => setLessonModal({ chapterId: ch.id, lesson })}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Nội dung tài liệu</h3>
            <Button size="sm" variant="gradient" className="h-8 gap-1.5 text-xs" onClick={openAddSingle}>
              <Plus className="h-3.5 w-3.5" /> Thêm nội dung
            </Button>
          </div>

          {(draft.chapters[0]?.lessons.length ?? 0) === 0 ? (
            <div
              onClick={openAddSingle}
              className="border-2 border-dashed border-border rounded-xl py-10 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
            >
              <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Chưa có nội dung nào</p>
              <p className="text-xs text-muted-foreground mt-1">Nhấn để thêm tài liệu — video, PDF hoặc bài tập</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {draft.chapters[0].lessons.map(lesson => (
                <LessonRowItem
                  key={lesson.id}
                  lesson={lesson}
                  onTogglePreview={() => updateChapter(draft.chapters[0].id, {
                    lessons: draft.chapters[0].lessons.map(l => l.id === lesson.id ? { ...l, isPreview: !l.isPreview } : l),
                  })}
                  onEdit={() => setLessonModal({ chapterId: draft.chapters[0].id, lesson })}
                  onDelete={() => updateChapter(draft.chapters[0].id, {
                    lessons: draft.chapters[0].lessons.filter(l => l.id !== lesson.id),
                  })}
                />
              ))}
              <button
                onClick={openAddSingle}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1 pl-1"
              >
                <Plus className="h-3.5 w-3.5" /> Thêm nội dung
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lesson modal */}
      {lessonModal && (
        <LessonModal
          courseId={draft.id}
          initial={lessonModal.lesson}
          onSave={lesson => saveLesson(lessonModal.chapterId, lesson)}
          onClose={() => setLessonModal(null)}
        />
      )}
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
  const isSingle = course.format === "single";

  return (
    <Card className="group hover:shadow-md hover:border-primary/30 transition-all">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{course.subject} · Khối {course.grade}</Badge>
            {isSingle && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                <FileText className="h-2.5 w-2.5" /> Tài liệu đơn
              </span>
            )}
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
          {!isSingle && <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{course.chapters.length} chương</span>}
          <span className="flex items-center gap-1"><PlayCircle className="h-3 w-3" />{videoCount} video</span>
          <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{totalLessons} {isSingle ? "nội dung" : "bài"}</span>
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
  const [courses, setCourses] = useState<Course[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);

  useEffect(() => {
    loadCourses().then(list => { setCourses(list); setLoaded(true); });
  }, []);

  const createCourse = () => {
    if (!loaded) return;
    const c: Course = {
      id: uid(), title: "", subject: "Toán học", grade: 12,
      type: "class", description: "", chapters: [], published: false,
      packages: ["online", "advanced", "offline"], includes: [],
    };
    setCourses(prev => { const next = [c, ...prev]; saveCourses(next); return next; });
    setEditing(c);
  };

  const updateCourse = (updated: Course) => {
    if (!loaded) return;
    setCourses(prev => { const next = prev.map(c => c.id === updated.id ? updated : c); saveCourses(next); return next; });
  };

  const deleteCourse = (id: string) => {
    if (!loaded) return;
    setCourses(prev => { const next = prev.filter(c => c.id !== id); saveCourses(next); return next; });
    if (editing?.id === id) setEditing(null);
  };

  return (
    <PortalLayout role="teacher" userName="Thầy Hùng Toán" pageTitle="Tài liệu">
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
                  Xây dựng khóa học theo chương → bài học (giống lộ trình) hoặc bán tài liệu đơn lẻ · Bật preview cho học viên xem thử
                </p>
              </div>
              <Button className="gap-1.5" onClick={createCourse} disabled={!loaded}>
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
            {!loaded ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Đang tải khóa học…</div>
            ) : courses.length === 0 ? (
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
