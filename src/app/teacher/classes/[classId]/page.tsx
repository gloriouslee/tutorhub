"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LearningModeBadge, SectionHeader, ProgressBar } from "@/components/shared";
import {
  MOCK_CLASSES, MOCK_TEACHERS, MOCK_CLASS_MATERIALS, MOCK_LECTURES, MOCK_CLASS_NOTES, MOCK_STUDENTS,
  MOCK_ATTENDANCE, MOCK_HOMEWORK, MOCK_SUBMISSIONS
} from "@/lib/mock-data";
import {
  getStudentComments, saveStudentComment,
  getClassScheduleOverride, saveClassScheduleOverride,
  pushScheduleNotification,
  getOnlineLink, saveOnlineLink,
  getCurriculum, type CurriculumSession as CurriculumSessionData,
  getStudentPackages, saveStudentPackages, type StudentPackage,
  getClassMaterials, saveClassMaterial, deleteClassMaterial, type StoredClassMaterial,
  saveHomeworkAttachment, type HomeworkAttachment,
} from "@/lib/storage";
import { uploadClassFile } from "@/lib/upload";
import { ClassSchedule } from "@/types";
import {
  BookOpen, Clock, Video, Users, ArrowLeft, FileText, Download,
  PlayCircle, StickyNote, Pin, Eye, Plus, Upload,
  Calendar, Presentation, Tag, Trash2, Edit3, X, Check,
  Lock, Send, MessageSquare, Save, AlertCircle, CheckCircle2,
  Image, Loader2, CalendarDays, CheckSquare, UserCheck, UserX,
  Map, Wallet,
} from "lucide-react";
import CurriculumTab from "@/components/teacher/CurriculumTab";
import TuitionTab from "@/components/teacher/TuitionTab";

type TabKey = "overview" | "curriculum" | "sessions" | "homework" | "schedule" | "lectures" | "materials" | "notes" | "students" | "tuition";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "overview",    label: "Tổng quan",  icon: BookOpen },
  { key: "curriculum",  label: "Lộ trình",   icon: Map },
  { key: "sessions",    label: "Buổi học",   icon: CalendarDays },
  { key: "homework",    label: "Bài tập",    icon: CheckSquare },
  { key: "schedule",    label: "Lịch học",   icon: Calendar },
  { key: "lectures",    label: "Bài giảng",  icon: Presentation },
  { key: "materials",   label: "Tài liệu",   icon: FileText },
  { key: "notes",       label: "Ghi chú",    icon: StickyNote },
  { key: "students",    label: "Học viên",   icon: Users },
  { key: "tuition",    label: "Học phí",    icon: Wallet },
];

const DAYS_VI = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

const DAY_TO_NUM: Record<string, number> = {
  Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 0,
  "Thứ 2": 1, "Thứ 3": 2, "Thứ 4": 3, "Thứ 5": 4, "Thứ 6": 5, "Thứ 7": 6, "Chủ nhật": 0,
};

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  formula:  { label: "Công thức", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  exam_prep:{ label: "Ôn thi",    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  summary:  { label: "Tóm tắt",   color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  textbook: { label: "Giáo trình",color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
};

function getFileIcon(type: string) {
  if (type === "video") return <PlayCircle className="h-5 w-5" />;
  if (type === "image") return <Image className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

const PACKAGE_TYPES: Record<string, { label: string; color: string; description: string }> = {
  online:   { label: "Gói Online",   color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",   description: "Chỉ join online (Miễn phí)" },
  advanced: { label: "Gói Nâng cao", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", description: "Online + Tài liệu nâng cao" },
  offline:  { label: "Gói Offline",  color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",  description: "Học tại trung tâm + Full tài liệu" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Session types ────────────────────────────────────────────────────────────

interface Session {
  date: string;       // YYYY-MM-DD
  dayLabel: string;   // from toLocaleDateString("vi-VN", { weekday: "long" })
  start_time: string;
  end_time: string;
  isPast: boolean;
  isToday: boolean;
}

function generateSessions(schedule: ClassSchedule[]): Session[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessions: Session[] = [];

  const pastWeeks = 8;
  const futureWeeks = 4;
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - pastWeeks * 7);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + futureWeeks * 7);

  for (const sched of schedule) {
    const targetDay = DAY_TO_NUM[sched.day];
    if (targetDay === undefined) continue;

    const cursor = new Date(startDate);
    // Align cursor to the target weekday
    const diff = (targetDay - cursor.getDay() + 7) % 7;
    cursor.setDate(cursor.getDate() + diff);

    while (cursor <= endDate) {
      const dateStr = cursor.toISOString().split("T")[0];
      const cursorCopy = new Date(cursor);
      cursorCopy.setHours(0, 0, 0, 0);
      const isToday = cursorCopy.getTime() === today.getTime();
      const isPast = cursorCopy.getTime() < today.getTime();
      const dayLabel = cursorCopy.toLocaleDateString("vi-VN", { weekday: "long" });

      sessions.push({
        date: dateStr,
        dayLabel,
        start_time: sched.start_time,
        end_time: sched.end_time,
        isPast,
        isToday,
      });

      cursor.setDate(cursor.getDate() + 7);
    }
  }

  sessions.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
  return sessions;
}

// ── Homework types ───────────────────────────────────────────────────────────

interface Homework {
  id: string;
  class_id: string;
  title: string;
  description?: string;
  due_date: string;
  created_at: string;
  attachment?: HomeworkAttachment;
}

interface Submission {
  id: string;
  homework_id: string;
  student_id: string;
  score?: number;
}

function dueStatus(dueDate: string): { label: string; color: string } {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: "Đã hết hạn", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (diffDays === 0) return { label: "Hôm nay", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  if (diffDays <= 3) return { label: `Còn ${diffDays} ngày`, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" };
  return { label: `Còn ${diffDays} ngày`, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
}

// ── Attendance types ─────────────────────────────────────────────────────────

type AttendanceStatus = "present" | "absent" | "late";

interface SavedAttendanceRecord {
  class_id: string;
  student_id: string;
  date: string;
  status: AttendanceStatus;
  saved_at: string;
}

// ── Curriculum session preview (shown inside Buổi học cards) ─────────────────

const LESSON_TYPE_META: Record<string, { label: string; color: string }> = {
  lecture:  { label: "Bài giảng",      color: "text-blue-600 dark:text-blue-400" },
  material: { label: "Tài liệu",       color: "text-emerald-600 dark:text-emerald-400" },
  homework: { label: "Bài tập",        color: "text-amber-600 dark:text-amber-400" },
  solution: { label: "Video chữa bài", color: "text-violet-600 dark:text-violet-400" },
};

function CurriculumSessionPreview({ session }: { session: CurriculumSessionData }) {
  const [open, setOpen] = useState(false);
  const total = session.lessons.length;
  const published = session.lessons.filter(l => l.is_published).length;
  return (
    <div className="mt-3 border border-violet-200 dark:border-violet-800/40 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 bg-violet-50/60 dark:bg-violet-900/10 hover:bg-violet-100/60 dark:hover:bg-violet-900/20 transition-colors text-left"
        onClick={() => setOpen(v => !v)}
      >
        <Map className="h-3.5 w-3.5 text-violet-500 shrink-0" />
        <span className="flex-1 text-xs font-semibold text-violet-700 dark:text-violet-300">{session.title}</span>
        <span className="text-[10px] text-violet-500 shrink-0">{published}/{total} nội dung{open ? " ▲" : " ▼"}</span>
      </button>
      {open && (
        <ul className="divide-y divide-violet-100 dark:divide-violet-800/20">
          {session.lessons.map(lesson => {
            const meta = LESSON_TYPE_META[lesson.type] ?? { label: lesson.type, color: "text-muted-foreground" };
            return (
              <li key={lesson.id} className="flex items-center gap-2 px-3 py-1.5">
                <span className={`text-[10px] font-medium shrink-0 ${meta.color}`}>{meta.label}</span>
                <span className="flex-1 text-xs text-foreground truncate">{lesson.title}</span>
                {!lesson.is_published && (
                  <span className="text-[10px] text-muted-foreground shrink-0">Ẩn</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Add student modal ─────────────────────────────────────────────────────────

function AddStudentModal({
  classId,
  enrolledIds,
  approvedEnrollments,
  onAdd,
  onClose,
}: {
  classId: string;
  enrolledIds: string[];
  approvedEnrollments: { id: string; full_name: string; email: string; school: string; grade: string }[];
  onAdd: (ids: string[]) => void;
  onClose: () => void;
}) {
  const mockAvailable = MOCK_STUDENTS
    .filter(s => !enrolledIds.includes(s.id))
    .map(s => ({ id: s.id, full_name: s.full_name, email: "", school: s.school ?? "", grade: s.grade ?? "", isEnrolled: false }));
  const enrolledAvailable = approvedEnrollments
    .filter(e => !enrolledIds.includes(e.id))
    .map(e => ({ ...e, isEnrolled: true }));
  const available = [...mockAvailable, ...enrolledAvailable];

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const filtered = available.filter(s => {
    const q = search.toLowerCase();
    return !q ||
      s.full_name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.school.toLowerCase().includes(q);
  });

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function handleAdd() {
    const newIds = [...selected];
    if (newIds.length === 0) return;
    try {
      const raw = localStorage.getItem(`tutorhub_class_extra_students_${classId}`);
      const existing: string[] = raw ? JSON.parse(raw) : [];
      const updated = [...new Set([...existing, ...newIds])];
      localStorage.setItem(`tutorhub_class_extra_students_${classId}`, JSON.stringify(updated));
    } catch {}
    onAdd(newIds);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">Thêm học viên</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Chọn học viên để thêm vào lớp</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Input
              placeholder="Tìm theo tên, email hoặc trường..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">
              {available.length === 0 ? "Tất cả học viên đã trong lớp." : "Không tìm thấy học viên phù hợp."}
            </p>
          )}
          {filtered.map(student => {
            const checked = selected.has(student.id);
            return (
              <label key={student.id} className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(student.id)}
                  className="h-4 w-4 accent-primary rounded"
                />
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {student.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{student.full_name}</p>
                    {student.isEnrolled && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium shrink-0">Đã duyệt</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {student.email || student.school} {student.grade ? `· Lớp ${student.grade}` : ""}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-muted-foreground">
            {selected.size > 0 ? `Đã chọn ${selected.size} học viên` : "Chưa chọn học viên nào"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Hủy</Button>
            <Button variant="gradient" size="sm" onClick={handleAdd} disabled={selected.size === 0}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />Thêm {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Inline attendance panel (inside session cards) ────────────────────────────

function InlineAttendancePanel({
  classId,
  date,
  students,
  savedRecords,
  onSaved,
}: {
  classId: string;
  date: string;
  students: { id: string; full_name: string; school: string }[];
  savedRecords: SavedAttendanceRecord[];
  onSaved: (updated: SavedAttendanceRecord[]) => void;
}) {
  const buildMarks = (recs: SavedAttendanceRecord[]) => {
    const m: Record<string, AttendanceStatus> = {};
    for (const rec of MOCK_ATTENDANCE as any[]) {
      if (rec.class_id === classId && rec.attendance_date === date) {
        m[rec.student_id] = rec.status as AttendanceStatus;
      }
    }
    for (const rec of recs) {
      if (rec.class_id === classId && rec.date === date) {
        m[rec.student_id] = rec.status;
      }
    }
    return m;
  };

  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(() => buildMarks(savedRecords));
  const [saved, setSaved] = useState(false);

  // Re-sync when savedRecords arrives (parent loads from localStorage asynchronously)
  useEffect(() => {
    setMarks(buildMarks(savedRecords));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedRecords]);

  function handleSave() {
    const newRecs: SavedAttendanceRecord[] = Object.entries(marks).map(([student_id, status]) => ({
      class_id: classId,
      student_id,
      date,
      status,
      saved_at: new Date().toISOString(),
    }));
    const others = savedRecords.filter(r => !(r.class_id === classId && r.date === date));
    const updated = [...others, ...newRecs];
    try { localStorage.setItem("tutorhub_teacher_attendance", JSON.stringify(updated)); } catch {}
    onSaved(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const presentCount = Object.values(marks).filter(s => s === "present").length;
  const lateCount    = Object.values(marks).filter(s => s === "late").length;
  const absentCount  = Object.values(marks).filter(s => s === "absent").length;

  return (
    <div className="mt-3 border border-border/60 rounded-xl overflow-hidden">
      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-border/60 bg-muted/20">
        <div className="px-4 py-2 text-center">
          <p className="text-base font-bold text-emerald-600">{presentCount}</p>
          <p className="text-[10px] text-emerald-600/80 font-medium">Có mặt</p>
        </div>
        <div className="px-4 py-2 text-center">
          <p className="text-base font-bold text-amber-600">{lateCount}</p>
          <p className="text-[10px] text-amber-600/80 font-medium">Đi trễ</p>
        </div>
        <div className="px-4 py-2 text-center">
          <p className="text-base font-bold text-red-500">{absentCount}</p>
          <p className="text-[10px] text-red-500/80 font-medium">Vắng</p>
        </div>
      </div>
      {/* Student rows */}
      <div className="divide-y divide-border/40">
        {students.map(student => {
          const status = marks[student.id];
          return (
            <div key={student.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-2.5">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  {student.full_name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{student.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{student.school}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setMarks(prev => ({ ...prev, [student.id]: "present" }))}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${status === "present" ? "bg-emerald-500 text-white border-emerald-500 shadow-sm" : "bg-background border-border text-muted-foreground hover:border-emerald-400 hover:text-emerald-600"}`}
                >
                  <UserCheck className="h-3 w-3" />Có mặt
                </button>
                <button
                  onClick={() => setMarks(prev => ({ ...prev, [student.id]: "late" }))}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${status === "late" ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-background border-border text-muted-foreground hover:border-amber-400 hover:text-amber-600"}`}
                >
                  <Clock className="h-3 w-3" />Đi trễ
                </button>
                <button
                  onClick={() => setMarks(prev => ({ ...prev, [student.id]: "absent" }))}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${status === "absent" ? "bg-red-500 text-white border-red-500 shadow-sm" : "bg-background border-border text-muted-foreground hover:border-red-400 hover:text-red-500"}`}
                >
                  <UserX className="h-3 w-3" />Vắng
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {/* Save row */}
      <div className="px-4 py-3 bg-muted/10 border-t border-border/40 flex items-center gap-3">
        <Button size="sm" variant="gradient" className="h-8" onClick={handleSave}>
          <Save className="h-3.5 w-3.5 mr-1.5" />Lưu điểm danh
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />Đã lưu
          </span>
        )}
      </div>
    </div>
  );
}

// ── Shared Homework Modal ────────────────────────────────────────────────────

function HomeworkModal({
  classId,
  initial,
  onSave,
  onClose,
}: {
  classId: string;
  initial?: Partial<Homework>;
  onSave: (hw: Homework) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!title.trim() || !dueDate) return;
    setUploading(true);
    setUploadError("");

    let attachment: HomeworkAttachment | undefined;
    if (file) {
      try {
        const uploaded = await uploadClassFile(file, classId, "homework");
        const hwId = initial?.id ?? `hw_${Date.now()}`;
        attachment = {
          homework_id: hwId,
          file_url: uploaded.url,
          file_name: uploaded.name,
          file_size: uploaded.size,
          file_type: uploaded.file_type,
        };
        saveHomeworkAttachment(attachment);
      } catch (e: any) {
        setUploadError(e.message ?? "Lỗi tải lên file");
        setUploading(false);
        return;
      }
    }

    const hw: Homework = {
      id: initial?.id ?? `hw_${Date.now()}`,
      class_id: classId,
      title: title.trim(),
      description: description.trim() || undefined,
      due_date: dueDate,
      created_at: initial?.created_at ?? new Date().toISOString(),
      attachment,
    };
    onSave(hw);
    setUploading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-semibold text-foreground">{initial?.id ? "Chỉnh sửa bài tập" : "Giao bài tập mới"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Tiêu đề <span className="text-red-500">*</span></label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Bài tập chương 5..." />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Hạn nộp <span className="text-red-500">*</span></label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Mô tả</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full p-3 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              placeholder="Mô tả nội dung bài tập..."
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Đính kèm file</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button onClick={() => setFile(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                <p className="text-sm text-muted-foreground">Kéo thả hoặc nhấn để chọn file</p>
                <p className="text-xs text-muted-foreground mt-0.5">PDF, DOCX, PPTX · Tối đa 100MB</p>
              </button>
            )}
            {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
          </div>
        </div>
        <div className="p-5 border-t border-border bg-muted/20 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={uploading}>Hủy</Button>
          <Button variant="gradient" disabled={!title.trim() || !dueDate || uploading} onClick={handleSubmit}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            {initial?.id ? "Lưu thay đổi" : "Giao bài"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Session Notes Panel ──────────────────────────────────────────────────────

function SessionNotesPanel({
  classId,
  dateStr,
  onClose,
}: {
  classId: string;
  dateStr: string;
  onClose: () => void;
}) {
  const storageKey = `tutorhub_session_notes_${classId}`;
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const notes: Record<string, string> = JSON.parse(raw);
        setNote(notes[dateStr] ?? "");
      }
    } catch {}
  }, [storageKey, dateStr]);

  const handleSave = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      const notes: Record<string, string> = raw ? JSON.parse(raw) : {};
      notes[dateStr] = note;
      localStorage.setItem(storageKey, JSON.stringify(notes));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">Tài liệu buổi học</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(dateStr)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Ghi chú buổi học</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={5}
              className="w-full p-3 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              placeholder="Nội dung, nhận xét, lưu ý cho buổi học này..."
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Tài liệu đính kèm</label>
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
              <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nhấn để tải file lên</p>
              <p className="text-xs text-muted-foreground mt-0.5">PDF, DOCX, ảnh · Tối đa 50MB</p>
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Đã lưu
            </span>
          )}
          <div className="flex gap-3 ml-auto">
            <Button variant="outline" onClick={onClose}>Đóng</Button>
            <Button variant="gradient" onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />Lưu ghi chú
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Schedule Editor ──────────────────────────────────────────────────────────

function ScheduleEditor({ classId, className, initialSchedule }: {
  classId: string;
  className: string;
  initialSchedule: ClassSchedule[];
}) {
  const [rows, setRows] = useState<ClassSchedule[]>(initialSchedule);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [notifMessage, setNotifMessage] = useState("");
  const [showNotifField, setShowNotifField] = useState(false);
  const [dirty, setDirty] = useState(false);

  const updateRow = (idx: number, field: keyof ClassSchedule, value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    setDirty(true);
  };

  const addRow = () => {
    setRows(prev => [...prev, { day: "Thứ 2", start_time: "08:00", end_time: "10:00" }]);
    setDirty(true);
  };

  const removeRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaveState("saving");
    try {
      saveClassScheduleOverride(classId, rows);

      const scheduleText = rows.map(r => `${r.day} ${r.start_time}–${r.end_time}`).join(", ");
      pushScheduleNotification({
        class_id: classId,
        class_name: className,
        message: notifMessage.trim() || `Lịch học lớp ${className} đã được cập nhật: ${scheduleText}.`,
      });

      setSaveState("success");
      setDirty(false);
      setShowNotifField(false);
      setNotifMessage("");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Buổi học trong tuần
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/60">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
              </div>
              <select
                value={row.day}
                onChange={e => updateRow(i, "day", e.target.value)}
                className="h-9 flex-1 min-w-0 sm:w-36 sm:flex-none rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                {DAYS_VI.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <div className="flex items-center gap-2 flex-1 sm:flex-none">
                <input
                  type="time"
                  value={row.start_time}
                  onChange={e => updateRow(i, "start_time", e.target.value)}
                  className="h-9 w-28 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-muted-foreground text-sm">–</span>
                <input
                  type="time"
                  value={row.end_time}
                  onChange={e => updateRow(i, "end_time", e.target.value)}
                  className="h-9 w-28 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                onClick={() => removeRow(i)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-auto sm:ml-0"
                title="Xoá buổi học"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          <button
            onClick={addRow}
            className="flex items-center gap-2 text-sm text-primary hover:underline font-medium"
          >
            <Plus className="h-4 w-4" /> Thêm buổi học
          </button>
        </CardContent>
      </Card>

      {dirty && (
        <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-900/10">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Lịch học có thay đổi</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Khi lưu, hệ thống sẽ đẩy thông báo đến toàn bộ học viên trong lớp.
                </p>
              </div>
              <button
                onClick={() => setShowNotifField(v => !v)}
                className="text-xs text-amber-700 dark:text-amber-400 underline whitespace-nowrap"
              >
                {showNotifField ? "Ẩn" : "Tuỳ chỉnh nội dung"}
              </button>
            </div>

            {showNotifField && (
              <textarea
                value={notifMessage}
                onChange={e => setNotifMessage(e.target.value)}
                rows={3}
                placeholder={`VD: Lịch học lớp ${className} đã thay đổi từ tuần sau. Vui lòng kiểm tra lại...`}
                className="w-full rounded-lg border border-amber-200 dark:border-amber-800 bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-amber-400"
              />
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button
          className="h-10 px-6"
          disabled={!dirty || saveState === "saving"}
          onClick={handleSave}
        >
          {saveState === "saving"
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Đang lưu...</>
            : <><Save className="h-4 w-4 mr-2" />Lưu & gửi thông báo</>}
        </Button>

        {saveState === "success" && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <CheckCircle2 className="h-4 w-4" /> Đã lưu và gửi thông báo
          </span>
        )}
        {saveState === "error" && (
          <span className="flex items-center gap-1.5 text-sm text-red-500 font-medium">
            <AlertCircle className="h-4 w-4" /> Lưu thất bại
          </span>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Lịch hiện tại (xem trước)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có buổi học nào.</p>
          ) : rows.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-primary" />{s.day}
              </span>
              <span className="text-sm text-muted-foreground">{s.start_time} – {s.end_time}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Upload modal ─────────────────────────────────────────────────────────────

function UploadModal({
  type,
  classId,
  onClose,
  onMaterialSaved,
}: {
  type: "lecture" | "material" | "note";
  classId: string;
  onClose: () => void;
  onMaterialSaved?: (mat: StoredClassMaterial) => void;
}) {
  const titles = { lecture: "Thêm bài giảng mới", material: "Tải lên tài liệu", note: "Viết ghi chú mới" };
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("summary");
  const [selectedPkgs, setSelectedPkgs] = useState<StudentPackage[]>([]); // empty = all packages
  const [pinned, setPinned] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function togglePkg(pkg: StudentPackage) {
    setSelectedPkgs(prev => prev.includes(pkg) ? prev.filter(p => p !== pkg) : [...prev, pkg]);
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (type !== "note" && !file) { setUploadError("Vui lòng chọn file cần tải lên"); return; }

    setUploading(true);
    setUploadError("");

    try {
      if (type === "material" && file) {
        const uploaded = await uploadClassFile(file, classId, "materials");
        const mat = saveClassMaterial({
          class_id: classId,
          title: title.trim(),
          description: description.trim() || undefined,
          file_url: uploaded.url,
          file_type: uploaded.file_type,
          file_size: uploaded.size,
          category,
          uploaded_by: "teacher",
          created_at: new Date().toISOString(),
          packages: selectedPkgs.length > 0 ? selectedPkgs : undefined,
        });
        onMaterialSaved?.(mat);
      }
      // lecture type: same flow (saved as material with type)
      if (type === "lecture" && file) {
        const uploaded = await uploadClassFile(file, classId, "materials");
        const mat = saveClassMaterial({
          class_id: classId,
          title: title.trim(),
          description: description.trim() || undefined,
          file_url: uploaded.url,
          file_type: uploaded.file_type,
          file_size: uploaded.size,
          category: "textbook",
          uploaded_by: "teacher",
          created_at: new Date().toISOString(),
          packages: selectedPkgs.length > 0 ? selectedPkgs : undefined,
        });
        onMaterialSaved?.(mat);
      }
      onClose();
    } catch (e: any) {
      setUploadError(e.message ?? "Lỗi tải lên file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-semibold text-foreground">{titles[type]}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Tiêu đề <span className="text-red-500">*</span></label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={type === "note" ? "VD: Lưu ý quan trọng..." : "VD: Chương 5 - Tích phân..."}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Mô tả</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full min-h-[80px] p-3 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              placeholder={type === "note" ? "Nội dung ghi chú..." : "Mô tả ngắn gọn..."}
            />
          </div>

          {type !== "note" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Tải file lên <span className="text-red-500">*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <button onClick={() => setFile(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-primary/5"}`}
                >
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">Kéo thả file hoặc nhấn để chọn</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, PPTX · Tối đa 100MB</p>
                </div>
              )}
              {uploadError && (
                <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
                </div>
              )}
            </div>
          )}

          {type === "note" && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="pin-note" checked={pinned} onChange={e => setPinned(e.target.checked)} className="rounded" />
              <label htmlFor="pin-note" className="text-sm text-muted-foreground flex items-center gap-1.5"><Pin className="h-3.5 w-3.5" />Ghim ghi chú này</label>
            </div>
          )}
          {type === "material" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Phân loại</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CATEGORY_MAP).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setCategory(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:shadow-sm ${val.color} ${category === key ? "ring-2 ring-offset-1 ring-primary/50" : ""}`}
                  >
                    {val.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {type !== "note" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Giới hạn theo gói
                <span className="ml-2 text-xs font-normal text-muted-foreground">(bỏ trống = tất cả gói đều xem được)</span>
              </label>
              <div className="flex gap-2">
                {([
                  { pkg: "online" as StudentPackage, label: "Online", color: "border-sky-300 text-sky-700 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-400" },
                  { pkg: "advanced" as StudentPackage, label: "Nâng cao", color: "border-violet-300 text-violet-700 bg-violet-50 dark:bg-violet-900/20 dark:text-violet-400" },
                  { pkg: "offline" as StudentPackage, label: "Offline", color: "border-orange-300 text-orange-700 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400" },
                ]).map(({ pkg, label, color }) => (
                  <button
                    key={pkg}
                    type="button"
                    onClick={() => togglePkg(pkg)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedPkgs.includes(pkg) ? `${color} ring-2 ring-offset-1 ring-primary/40` : "border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    {selectedPkgs.includes(pkg) && <span>✓</span>}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="p-5 border-t border-border bg-muted/20 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={uploading}>Hủy</Button>
          <Button variant="gradient" disabled={uploading || !title.trim() || (type !== "note" && !file)} onClick={handleSubmit}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {type === "note" ? "Đăng ghi chú" : uploading ? "Đang tải lên..." : "Tải lên"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Feedback modal ───────────────────────────────────────────────────────────

function FeedbackModal({ student, commentsList, onSave, onClose }: {
  student: any;
  commentsList: any[];
  onSave: (text: string, date: string, rating: number) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [rating, setRating] = useState(5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">Nhận xét học viên</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Học viên: {student.full_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {commentsList && commentsList.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Lịch sử nhận xét gần đây</label>
              <div className="space-y-2 bg-muted/30 p-3 rounded-xl border border-border">
                {commentsList.map((c, i) => (
                  <div key={i} className="text-xs border-b border-border/50 last:border-0 pb-2 last:pb-0">
                    <div className="flex justify-between font-semibold mb-1">
                      <span className="text-muted-foreground">{c.date}</span>
                      <span className="text-amber-500">{"★".repeat(c.rating)}{"☆".repeat(5 - c.rating)}</span>
                    </div>
                    <p className="text-foreground">{c.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Ngày học *</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Đánh giá chung *</label>
              <div className="flex items-center gap-1 h-10">
                {[1, 2, 3, 4, 5].map(star => (
                  <button type="button" key={star} onClick={() => setRating(star)}
                    className={`text-xl transition-all ${star <= rating ? "text-amber-400 scale-110" : "text-muted hover:text-amber-200"}`}>
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Nội dung nhận xét <span className="text-red-500">*</span></label>
            <textarea required rows={4} value={text} onChange={e => setText(e.target.value)}
              className="w-full p-3 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              placeholder="Nhận xét về thái độ học tập, bài tập về nhà, mức độ tiếp thu..." />
          </div>
        </div>
        <div className="p-5 border-t border-border bg-muted/20 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button variant="gradient" disabled={!text} onClick={() => { onSave(text, date, rating); onClose(); }}>
            <Check className="h-4 w-4 mr-2" />Lưu nhận xét
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function TeacherClassDetailPage() {
  const params = useParams();
  const classId = params.classId as string;
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [uploadModal, setUploadModal] = useState<"lecture" | "material" | "note" | null>(null);
  const [commentModalStudent, setCommentModalStudent] = useState<any | null>(null);
  const [comments, setComments] = useState<Record<string, { text: string; date: string; rating: number }[]>>({});
  const [currentSchedule, setCurrentSchedule] = useState<ClassSchedule[] | null>(null);
  const [onlineLink,      setOnlineLink]      = useState("");
  const [onlineLinkDraft, setOnlineLinkDraft] = useState("");
  const [linkSaved,       setLinkSaved]       = useState(false);

  // Sessions tab state
  const [showPastSessions, setShowPastSessions] = useState(false);
  const [homeworkModalForSession, setHomeworkModalForSession] = useState<string | null>(null); // dateStr
  const [sessionNotesPanel, setSessionNotesPanel] = useState<string | null>(null); // dateStr
  const [sessionNotes, setSessionNotes] = useState<Record<string, string>>({});

  // Homework tab state
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [homeworkModal, setHomeworkModal] = useState<{ open: boolean; editing?: Homework }>({ open: false });
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Attendance state
  const [openAttendanceDate, setOpenAttendanceDate] = useState<string | null>(null);
  const [savedAttendanceRecords, setSavedAttendanceRecords] = useState<SavedAttendanceRecord[]>([]);

  // Curriculum state — a flat map of date → CurriculumSession for quick lookup
  const [curriculumByDate, setCurriculumByDate] = useState<Record<string, CurriculumSessionData>>({});

  // Extra students added by teacher (persisted to localStorage)
  const [extraStudentIds, setExtraStudentIds] = useState<string[]>([]);
  const [addStudentModal, setAddStudentModal] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  // Approved enrolled students from Supabase
  const [approvedEnrollments, setApprovedEnrollments] = useState<{ id: string; full_name: string; email: string; school: string; grade: string }[]>([]);
  useEffect(() => {
    import("@/lib/storage").then(({ getEnrollments }) =>
      getEnrollments().then(list => {
        setApprovedEnrollments(
          list
            .filter(e => e.status === "approved")
            .map(e => ({
              id: e.supabase_user_id ?? `enr_${e.id}`,
              full_name: e.full_name,
              email: e.email,
              school: e.school ?? "",
              grade: e.grade ?? "",
            }))
        );
      })
    );
  }, []);

  // Uploaded materials (localStorage) merged with mock
  const [uploadedMaterials, setUploadedMaterials] = useState<StoredClassMaterial[]>([]);
  useEffect(() => {
    setUploadedMaterials(getClassMaterials(classId));
  }, [classId]);

  // Student packages per class (persisted to localStorage)
  const [studentPackages, setStudentPackages] = useState<Record<string, StudentPackage>>({});

  const cls = MOCK_CLASSES.find(c => c.id === classId);

  useEffect(() => {
    if (!cls) return;
    const override = getClassScheduleOverride(classId);
    setCurrentSchedule(override ?? cls.schedule);
    const saved = getOnlineLink(classId) ?? cls.zoom_link ?? "";
    setOnlineLink(saved);
    setOnlineLinkDraft(saved);
  }, [classId, cls]);

  // Load session notes from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`tutorhub_session_notes_${classId}`);
      if (raw) setSessionNotes(JSON.parse(raw));
    } catch {}
  }, [classId]);

  // Build curriculum date-index
  useEffect(() => {
    const chapters = getCurriculum(classId);
    const map: Record<string, CurriculumSessionData> = {};
    for (const ch of chapters) {
      for (const s of ch.sessions) {
        if (s.date) map[s.date] = s;
      }
    }
    setCurriculumByDate(map);
  }, [classId, activeTab]);

  // Load homework from localStorage
  useEffect(() => {
    if (!cls) return;
    try {
      const raw = localStorage.getItem("tutorhub_teacher_homework");
      const all: Homework[] = raw ? JSON.parse(raw) : [];
      const forClass = all.filter(h => h.class_id === classId);
      if (forClass.length === 0) {
        // Seed from mock
        const mock = (MOCK_HOMEWORK as any[])
          .filter((h: any) => h.class_id === classId)
          .map((h: any): Homework => ({
            id: h.id,
            class_id: h.class_id,
            title: h.title,
            description: h.description,
            due_date: h.due_date,
            created_at: h.created_at,
          }));
        setHomeworks(mock);
      } else {
        setHomeworks(forClass);
      }
    } catch {
      setHomeworks([]);
    }

    try {
      const rawSub = localStorage.getItem("tutorhub_submissions");
      setSubmissions(rawSub ? JSON.parse(rawSub) : (MOCK_SUBMISSIONS as any[]));
    } catch {
      setSubmissions(MOCK_SUBMISSIONS as any[]);
    }
  }, [classId, cls]);

  // Load attendance from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tutorhub_teacher_attendance");
      setSavedAttendanceRecords(raw ? JSON.parse(raw) : []);
    } catch {
      setSavedAttendanceRecords([]);
    }
  }, []);

  // Load extra students from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`tutorhub_class_extra_students_${classId}`);
      setExtraStudentIds(raw ? JSON.parse(raw) : []);
    } catch {
      setExtraStudentIds([]);
    }
  }, [classId]);

  // Load student packages from localStorage
  useEffect(() => {
    setStudentPackages(getStudentPackages(classId));
  }, [classId]);


  function handleSaveOnlineLink() {
    saveOnlineLink(classId, onlineLinkDraft);
    setOnlineLink(onlineLinkDraft);
    setLinkSaved(true);
    setTimeout(() => setLinkSaved(false), 3000);
  }

  function persistHomeworks(updated: Homework[]) {
    try {
      const raw = localStorage.getItem("tutorhub_teacher_homework");
      const all: Homework[] = raw ? JSON.parse(raw) : [];
      const others = all.filter(h => h.class_id !== classId);
      localStorage.setItem("tutorhub_teacher_homework", JSON.stringify([...others, ...updated]));
    } catch {}
    setHomeworks(updated);
  }

  function handleSaveHomework(hw: Homework) {
    const existing = homeworks.find(h => h.id === hw.id);
    const updated = existing
      ? homeworks.map(h => h.id === hw.id ? hw : h)
      : [hw, ...homeworks];
    persistHomeworks(updated);
  }

  function handleDeleteHomework(id: string) {
    persistHomeworks(homeworks.filter(h => h.id !== id));
  }

  if (!cls) {
    return (
      <PortalLayout role="teacher" userName="Thầy Hùng Toán" pageTitle="Lớp học">
        <div className="flex flex-col items-center justify-center py-20">
          <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold">Không tìm thấy lớp học</h2>
          <Link href="/teacher/classes"><Button variant="outline" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" />Quay lại</Button></Link>
        </div>
      </PortalLayout>
    );
  }

  const teacher = MOCK_TEACHERS.find(t => t.id === cls.tutor_id);
  const materials = [
    ...MOCK_CLASS_MATERIALS.filter(m => m.class_id === classId),
    ...uploadedMaterials,
  ];
  const lectures = MOCK_LECTURES.filter(l => l.class_id === classId);
  const notes = MOCK_CLASS_NOTES.filter(n => n.class_id === classId);

  // Students enrolled in this class (mock + extra added by teacher)
  const allEnrolledIds = [...new Set([...(cls.student_ids ?? []), ...extraStudentIds])];
  const mockClassStudents = MOCK_STUDENTS.filter(s => allEnrolledIds.includes(s.id)).map((s, idx) => ({
    ...s,
    package: (studentPackages[s.id] ?? (idx % 3 === 0 ? "online" : idx % 3 === 1 ? "advanced" : "offline")) as StudentPackage,
    join_date: "2024-09-0" + (idx + 1),
    progress: [72, 85, 61, 90, 78][idx] ?? 70,
  }));
  const enrolledClassStudents = approvedEnrollments
    .filter(e => allEnrolledIds.includes(e.id))
    .map((e, idx) => ({
      id: e.id, user_id: e.id, full_name: e.full_name, email: e.email,
      dob: "", school: e.school, grade: e.grade, learning_type: "online" as const,
      parent_id: undefined, avatar_url: undefined, created_at: "",
      package: (studentPackages[e.id] ?? "online") as StudentPackage,
      join_date: new Date().toISOString().slice(0, 10),
      progress: [72, 85, 61, 90, 78][idx] ?? 70,
    }));
  const classStudents = [...mockClassStudents, ...enrolledClassStudents];

  function handleSetPackage(studentId: string, pkg: StudentPackage) {
    const updated = { ...studentPackages, [studentId]: pkg };
    setStudentPackages(updated);
    saveStudentPackages(classId, updated);
  }

  useEffect(() => {
    async function loadComments() {
      const loaded: Record<string, any[]> = {};
      for (const s of classStudents) {
        loaded[s.id] = await getStudentComments(s.id);
      }
      setComments(loaded);
    }
    loadComments();
  }, []);

  const handleSaveComment = async (studentId: string, text: string, date: string, rating: number) => {
    const updated = [{ text, date, rating }, ...(comments[studentId] || [])];
    setComments(prev => ({ ...prev, [studentId]: updated }));
    await saveStudentComment(studentId, updated);
  };

  const addButton = (type: "lecture" | "material" | "note", label: string) => (
    <Button size="sm" variant="gradient" onClick={() => setUploadModal(type)}>
      <Plus className="h-3.5 w-3.5 mr-1.5" />{label}
    </Button>
  );

  const scheduleForDisplay = currentSchedule ?? cls.schedule;

  // Sessions
  const allSessions = generateSessions(scheduleForDisplay);
  const upcomingSessions = allSessions.filter(s => !s.isPast || s.isToday);
  const pastSessions = allSessions.filter(s => s.isPast && !s.isToday);

  // Dedupe by date+student: saved overrides mock
  const dedupedHistory: SavedAttendanceRecord[] = [];
  const seen = new Set<string>();
  for (const rec of [...savedAttendanceRecords.filter(r => r.class_id === classId), ...(MOCK_ATTENDANCE as any[]).filter((r: any) => r.class_id === classId).map((r: any) => ({ class_id: r.class_id, student_id: r.student_id, date: r.attendance_date, status: r.status as AttendanceStatus, saved_at: r.attendance_date }))]) {
    const key = `${rec.date}_${rec.student_id}`;
    if (!seen.has(key)) {
      seen.add(key);
      dedupedHistory.push(rec);
    }
  }
  dedupedHistory.sort((a, b) => b.date.localeCompare(a.date));

  function getAttendanceStatsForDate(dateStr: string, cid: string) {
    const records = dedupedHistory.filter(r => r.date === dateStr && r.class_id === cid);
    return {
      present: records.filter(r => r.status === "present").length,
      late: records.filter(r => r.status === "late").length,
      absent: records.filter(r => r.status === "absent").length,
    };
  }

  return (
    <PortalLayout role="teacher" userName="Thầy Hùng Toán" pageTitle={cls.class_name}>
      <div className="space-y-6 max-w-6xl mx-auto">
        <Link href="/teacher/classes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Quay lại danh sách lớp
        </Link>

        {/* Header */}
        <div className="rounded-2xl overflow-hidden border border-border/50 shadow-sm">
          <div className="p-6 md:p-8 text-white relative" style={{ background: `linear-gradient(135deg, ${cls.color} 0%, #000 250%)` }}>
            <div className="flex flex-col md:flex-row gap-5 items-start">
              <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/30 shadow-lg shrink-0">
                <BookOpen className="h-8 w-8" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <LearningModeBadge mode={cls.learning_mode} />
                  <Badge className="bg-amber-500/80 text-white border-0 text-[10px]">Giáo viên</Badge>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold leading-tight">{cls.class_name}</h1>
                <p className="text-white/70 mt-1 font-medium">{cls.subject}</p>
              </div>
              <div className="flex flex-wrap gap-3 shrink-0">
                <div className="bg-white/10 backdrop-blur px-4 py-2 rounded-xl text-center border border-white/20">
                  <p className="text-2xl font-bold">{lectures.length}</p>
                  <p className="text-[11px] text-white/60">Bài giảng</p>
                </div>
                <div className="bg-white/10 backdrop-blur px-4 py-2 rounded-xl text-center border border-white/20">
                  <p className="text-2xl font-bold">{materials.length}</p>
                  <p className="text-[11px] text-white/60">Tài liệu</p>
                </div>
                <div className="bg-white/10 backdrop-blur px-4 py-2 rounded-xl text-center border border-white/20">
                  <p className="text-2xl font-bold">{classStudents.length}</p>
                  <p className="text-[11px] text-white/60">Học viên</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-card border-b border-border px-4 md:px-8 flex gap-1 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`}>
                <tab.icon className="h-4 w-4" />{tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="animate-fade-in">

          {/* ── Overview ── */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Thông tin lớp học</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">{cls.description}</p>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lịch học</p>
                      <button
                        onClick={() => setActiveTab("schedule")}
                        className="text-xs text-primary hover:underline"
                      >
                        Chỉnh sửa lịch →
                      </button>
                    </div>
                    <div className="space-y-2">
                      {scheduleForDisplay.map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50">
                          <span className="flex items-center gap-2 text-sm font-medium"><Clock className="h-4 w-4 text-primary" />{s.day}</span>
                          <span className="text-sm text-muted-foreground">{s.start_time} – {s.end_time}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button onClick={() => { setActiveTab("lectures"); setUploadModal("lecture"); }} className="p-5 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-center group">
                    <Presentation className="h-8 w-8 text-muted-foreground mx-auto mb-2 group-hover:text-primary transition-colors" />
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">Thêm bài giảng</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Video, slide bài giảng</p>
                  </button>
                  <button onClick={() => { setActiveTab("materials"); setUploadModal("material"); }} className="p-5 rounded-2xl border-2 border-dashed border-border hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all text-center group">
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2 group-hover:text-emerald-600 transition-colors" />
                    <p className="text-sm font-semibold group-hover:text-emerald-600 transition-colors">Tải tài liệu</p>
                    <p className="text-xs text-muted-foreground mt-0.5">PDF, tóm tắt, đề thi</p>
                  </button>
                  <button onClick={() => { setActiveTab("notes"); setUploadModal("note"); }} className="p-5 rounded-2xl border-2 border-dashed border-border hover:border-amber-500/50 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all text-center group">
                    <StickyNote className="h-8 w-8 text-muted-foreground mx-auto mb-2 group-hover:text-amber-600 transition-colors" />
                    <p className="text-sm font-semibold group-hover:text-amber-600 transition-colors">Viết ghi chú</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Thông báo, nhắc nhở</p>
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Thống kê nhanh</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Bài giảng đã đăng</span><span className="font-bold">{lectures.filter(l => l.is_published).length}/{lectures.length}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tài liệu</span><span className="font-bold">{materials.length} file</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Ghi chú đã ghim</span><span className="font-bold">{notes.filter(n => n.is_pinned).length}</span></div>
                      <div className="flex justify-between text-sm pt-2 border-t border-border/50"><span className="text-muted-foreground">Sĩ số</span><span className="font-bold">{classStudents.length}/{cls.max_students}</span></div>
                    </div>
                  </CardContent>
                </Card>
                {onlineLink ? (
                  <Button
                    variant="gradient"
                    className="w-full shadow-lg shadow-primary/20"
                    onClick={() => window.open(onlineLink, "_blank", "noopener,noreferrer")}
                  >
                    <Video className="h-4 w-4 mr-2" />Mở phòng học Online
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full text-muted-foreground"
                    onClick={() => setActiveTab("schedule")}
                  >
                    <Video className="h-4 w-4 mr-2" />Cài đặt link Online
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── Curriculum ── */}
          {activeTab === "curriculum" && (
            <CurriculumTab classId={classId} schedule={scheduleForDisplay} />
          )}

          {/* ── Sessions ── */}
          {activeTab === "sessions" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Buổi học</h3>
                  <p className="text-sm text-muted-foreground">8 tuần qua + 4 tuần tới</p>
                </div>
              </div>

              {/* Upcoming & today */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" /> Sắp tới
                  <span className="text-xs font-normal text-muted-foreground">({upcomingSessions.length} buổi)</span>
                </h4>
                {upcomingSessions.length === 0 && (
                  <p className="text-sm text-muted-foreground">Không có buổi học sắp tới.</p>
                )}
                {upcomingSessions.map((session, i) => {
                  const currSession = curriculumByDate[session.date];
                  return (
                  <Card key={`${session.date}_${session.start_time}_${i}`} className={`transition-all hover:shadow-md ${session.isToday ? "border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-900/5" : "border-blue-200 dark:border-blue-800/50 bg-blue-50/20 dark:bg-blue-900/5"}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`h-12 w-12 rounded-xl flex flex-col items-center justify-center shrink-0 text-white font-bold ${session.isToday ? "bg-amber-500" : "bg-blue-500"}`}>
                            <span className="text-lg leading-none">{new Date(session.date + "T00:00:00").getDate()}</span>
                            <span className="text-[10px] leading-none opacity-80">{new Date(session.date + "T00:00:00").toLocaleDateString("vi-VN", { month: "short" })}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground">{formatDate(session.date)}</p>
                              <span className="text-xs text-muted-foreground capitalize">{session.dayLabel}</span>
                              {session.isToday && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Hôm nay</span>
                              )}
                              {!session.isToday && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Sắp tới</span>
                              )}
                              {currSession && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 flex items-center gap-1">
                                  <Map className="h-2.5 w-2.5" />{currSession.title}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Clock className="h-3 w-3" />{session.start_time} – {session.end_time}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-8"
                            onClick={() => setHomeworkModalForSession(session.date)}
                          >
                            <CheckSquare className="h-3.5 w-3.5 mr-1.5" />Giao bài
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-8"
                            onClick={() => setSessionNotesPanel(session.date)}
                          >
                            <FileText className="h-3.5 w-3.5 mr-1.5" />Tài liệu
                          </Button>
                          <Button
                            size="sm"
                            variant={openAttendanceDate === session.date ? "gradient" : "outline"}
                            className="text-xs h-8"
                            onClick={() => setOpenAttendanceDate(prev => prev === session.date ? null : session.date)}
                          >
                            <UserCheck className="h-3.5 w-3.5 mr-1.5" />Điểm danh
                          </Button>
                        </div>
                      </div>
                      {currSession && currSession.lessons.length > 0 && (
                        <CurriculumSessionPreview session={currSession} />
                      )}
                      {sessionNotes[session.date] && (
                        <div className="mt-3 p-2 bg-muted/40 rounded-lg">
                          <p className="text-xs text-muted-foreground line-clamp-2">{sessionNotes[session.date]}</p>
                        </div>
                      )}
                      {openAttendanceDate === session.date && (
                        <InlineAttendancePanel
                          classId={classId}
                          date={session.date}
                          students={classStudents}
                          savedRecords={savedAttendanceRecords}
                          onSaved={setSavedAttendanceRecords}
                        />
                      )}
                    </CardContent>
                  </Card>
                );
                })}
              </div>

              {/* Past sessions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" /> Đã qua
                    <span className="text-xs font-normal text-muted-foreground">({pastSessions.length} buổi)</span>
                  </h4>
                  <button
                    onClick={() => setShowPastSessions(v => !v)}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    {showPastSessions ? "Ẩn" : `Xem ${pastSessions.length} buổi đã qua`}
                  </button>
                </div>

                {showPastSessions && pastSessions.slice().reverse().map((session, i) => {
                  const stats = getAttendanceStatsForDate(session.date, classId);
                  const hasStats = stats.present + stats.late + stats.absent > 0;
                  const currSession = curriculumByDate[session.date];
                  return (
                    <Card key={`past_${session.date}_${session.start_time}_${i}`} className="border-border/50 bg-muted/10 hover:shadow-sm transition-all">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="h-12 w-12 rounded-xl flex flex-col items-center justify-center shrink-0 bg-muted text-muted-foreground font-bold">
                              <span className="text-lg leading-none">{new Date(session.date + "T00:00:00").getDate()}</span>
                              <span className="text-[10px] leading-none opacity-70">{new Date(session.date + "T00:00:00").toLocaleDateString("vi-VN", { month: "short" })}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-foreground">{formatDate(session.date)}</p>
                                <span className="text-xs text-muted-foreground capitalize">{session.dayLabel}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Đã qua</span>
                                {currSession && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 flex items-center gap-1">
                                    <Map className="h-2.5 w-2.5" />{currSession.title}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                <Clock className="h-3 w-3" />{session.start_time} – {session.end_time}
                              </p>
                              {hasStats && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  <span className="text-emerald-600 font-medium">{stats.present} có mặt</span>
                                  {stats.late > 0 && <span className="text-amber-600 font-medium"> · {stats.late} đi trễ</span>}
                                  {stats.absent > 0 && <span className="text-red-500 font-medium"> · {stats.absent} vắng</span>}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant={openAttendanceDate === session.date ? "gradient" : "outline"}
                              className="text-xs h-8"
                              onClick={() => setOpenAttendanceDate(prev => prev === session.date ? null : session.date)}
                            >
                              <UserCheck className="h-3.5 w-3.5 mr-1.5" />Điểm danh
                            </Button>
                          </div>
                        </div>
                        {currSession && currSession.lessons.length > 0 && (
                          <CurriculumSessionPreview session={currSession} />
                        )}
                        {openAttendanceDate === session.date && (
                          <InlineAttendancePanel
                            classId={classId}
                            date={session.date}
                            students={classStudents}
                            savedRecords={savedAttendanceRecords}
                            onSaved={setSavedAttendanceRecords}
                          />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Homework ── */}
          {activeTab === "homework" && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Bài tập</h3>
                  <p className="text-sm text-muted-foreground">{homeworks.length} bài tập đã giao cho lớp này</p>
                </div>
                <Button variant="gradient" onClick={() => setHomeworkModal({ open: true })}>
                  <Plus className="h-4 w-4 mr-2" />Giao bài mới
                </Button>
              </div>

              {homeworks.length === 0 && (
                <Card>
                  <CardContent className="p-10 text-center">
                    <CheckSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Chưa có bài tập nào. Hãy giao bài tập đầu tiên!</p>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-4">
                {homeworks.map((hw, i) => {
                  const status = dueStatus(hw.due_date);
                  const hwSubmissions = submissions.filter(s => s.homework_id === hw.id);
                  const gradedCount = hwSubmissions.filter(s => (s as any).score !== undefined && (s as any).score !== null).length;
                  return (
                    <Card key={hw.id} className="hover:shadow-md transition-all animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                      <CardContent className="p-5">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${status.color}`}>{status.label}</span>
                              <span className="text-xs text-muted-foreground">Hạn: {formatDate(hw.due_date)}</span>
                            </div>
                            <h3 className="font-semibold text-foreground">{hw.title}</h3>
                            {hw.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{hw.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>{hwSubmissions.length} nộp bài</span>
                              {gradedCount > 0 && <span className="text-emerald-600">{gradedCount} đã chấm</span>}
                              <span>Tạo: {formatDate(hw.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground"
                              onClick={() => setHomeworkModal({ open: true, editing: hw })}>
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-50"
                              onClick={() => handleDeleteHomework(hw.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Schedule ── */}
          {activeTab === "schedule" && currentSchedule !== null && (
            <div className="max-w-2xl space-y-8">
              <div>
                <div className="mb-5">
                  <h2 className="text-base font-semibold">Cài đặt lịch học</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Chỉnh sửa lịch buổi học. Khi lưu, hệ thống tự động đẩy thông báo đến toàn bộ học viên trong lớp <strong>{cls.class_name}</strong>.
                  </p>
                </div>
                <ScheduleEditor
                  classId={classId}
                  className={cls.class_name}
                  initialSchedule={currentSchedule}
                />
              </div>

              {/* Online link editor */}
              <Card>
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Video className="h-4 w-4 text-primary" /> Phòng học Online
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Dán link phòng học (Zoom, Google Meet, Microsoft Teams…). Học viên sẽ thấy nút tham gia trực tiếp trên trang lớp học.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Zoom",          prefix: "https://zoom.us/j/" },
                      { label: "Google Meet",   prefix: "https://meet.google.com/" },
                      { label: "Microsoft Teams",prefix: "https://teams.microsoft.com/" },
                    ].map(p => (
                      <button
                        key={p.label}
                        onClick={() => {
                          if (!onlineLinkDraft.startsWith(p.prefix)) setOnlineLinkDraft(p.prefix);
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-border bg-muted hover:border-primary/40 hover:bg-primary/5 transition-colors font-medium text-muted-foreground"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      value={onlineLinkDraft}
                      onChange={e => { setOnlineLinkDraft(e.target.value); setLinkSaved(false); }}
                      placeholder="https://zoom.us/j/123456789  hoặc  meet.google.com/abc-defg-hij"
                      className="flex-1 font-mono text-xs"
                    />
                    <Button
                      onClick={handleSaveOnlineLink}
                      disabled={onlineLinkDraft === onlineLink}
                      className="shrink-0"
                    >
                      <Save className="h-4 w-4 mr-1.5" /> Lưu
                    </Button>
                  </div>

                  {onlineLink && (
                    <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span className="text-xs text-emerald-700 dark:text-emerald-400 truncate font-mono">{onlineLink}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 ml-2 text-xs"
                        onClick={() => window.open(onlineLink, "_blank", "noopener,noreferrer")}
                      >
                        <Video className="h-3.5 w-3.5 mr-1" /> Mở thử
                      </Button>
                    </div>
                  )}

                  {linkSaved && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Đã lưu link phòng học
                    </p>
                  )}

                  {onlineLink && (
                    <button
                      onClick={() => { setOnlineLinkDraft(""); saveOnlineLink(classId, ""); setOnlineLink(""); }}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Xoá link
                    </button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Lectures ── */}
          {activeTab === "lectures" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">{lectures.length} bài giảng</p>
                {addButton("lecture", "Thêm bài giảng")}
              </div>
              {lectures.sort((a, b) => a.order - b.order).map((lec, i) => (
                <Card key={lec.id} className={`overflow-hidden animate-fade-in transition-all hover:shadow-md ${!lec.is_published ? "border-dashed" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row">
                      <div className={`sm:w-44 flex items-center justify-center p-6 ${lec.is_published ? "bg-primary/5" : "bg-amber-50 dark:bg-amber-900/10"}`}>
                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${lec.is_published ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                          {lec.is_published ? <PlayCircle className="h-7 w-7" /> : <Lock className="h-5 w-5" />}
                        </div>
                      </div>
                      <div className="flex-1 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={lec.is_published ? "info" : "warning"} className="text-[10px]">{lec.is_published ? "Đã xuất bản" : "Bản nháp"}</Badge>
                              <span className="text-xs text-muted-foreground">Bài {lec.order}</span>
                            </div>
                            <h3 className="font-semibold text-foreground">{lec.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{lec.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{lec.duration}</span>
                              <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{lec.views} lượt xem</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground"><Edit3 className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ── Materials ── */}
          {activeTab === "materials" && (
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">{materials.length} tài liệu</p>
                {addButton("material", "Tải lên tài liệu")}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {materials.map((mat, i) => {
                  const cat = CATEGORY_MAP[mat.category] || { label: mat.category, color: "bg-muted text-muted-foreground" };
                  return (
                    <Card key={mat.id} className="group hover:shadow-lg hover:border-primary/30 transition-all animate-fade-in flex flex-col" style={{ animationDelay: `${i * 60}ms` }}>
                      <CardContent className="p-5 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-3">
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${mat.file_type === "pdf" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                            {getFileIcon(mat.file_type)}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${cat.color}`}>{cat.label}</span>
                            {mat.id.startsWith("mat_") && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  deleteClassMaterial(mat.id);
                                  setUploadedMaterials(getClassMaterials(classId));
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <h3 className="font-semibold text-sm text-foreground line-clamp-2 mb-1">{mat.title}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{mat.description}</p>
                        {"packages" in mat && mat.packages && mat.packages.length > 0 && (
                          <div className="flex gap-1 flex-wrap mb-2">
                            {(mat.packages as StudentPackage[]).map(pkg => (
                              <span key={pkg} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                                pkg === "online" ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
                                : pkg === "advanced" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                                : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                              }`}>
                                {pkg === "online" ? "Online" : pkg === "advanced" ? "Nâng cao" : "Offline"}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-auto mb-3">
                          <span>{mat.file_size}</span><span>·</span>
                          <span className="flex items-center gap-1"><Download className="h-3 w-3" />{mat.download_count}</span>
                        </div>
                        <div className="pt-3 border-t border-border/50">
                          {mat.file_url && !mat.file_url.startsWith("/uploads/") ? (
                            <a
                              href={mat.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-1.5 w-full h-8 text-xs rounded-lg border border-border bg-background hover:bg-muted transition-colors font-medium text-foreground"
                            >
                              <Eye className="h-3 w-3" />Xem / Tải xuống
                            </a>
                          ) : (
                            <Button size="sm" variant="outline" className="w-full text-xs h-8"><Eye className="h-3 w-3 mr-1.5" />Xem trước</Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Notes ── */}
          {activeTab === "notes" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">{notes.length} ghi chú</p>
                {addButton("note", "Viết ghi chú")}
              </div>
              {notes.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((note, i) => (
                <Card key={note.id} className={`animate-fade-in transition-all hover:shadow-md ${note.is_pinned ? "border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-900/5" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
                  <CardContent className="p-5 md:p-6">
                    <div className="flex items-start gap-4">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${note.is_pinned ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" : "bg-primary/10 text-primary"}`}>
                        {note.is_pinned ? <Pin className="h-4 w-4" /> : <StickyNote className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {note.is_pinned && <Badge variant="warning" className="text-[10px]">Đã ghim</Badge>}
                          <span className="text-xs text-muted-foreground">{formatDate(note.created_at)}</span>
                        </div>
                        <h3 className="font-semibold text-foreground">{note.title}</h3>
                        <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line leading-relaxed">{note.content}</p>
                        {note.tags && note.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {note.tags.map((tag: string) => (
                              <span key={tag} className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                                <Tag className="h-2.5 w-2.5" />{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground"><Edit3 className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ── Students ── */}
          {activeTab === "students" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Danh sách học viên</h3>
                  <p className="text-sm text-muted-foreground">Quản lý và theo dõi tiến độ của {classStudents.length} học viên</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Input
                      placeholder="Tìm tên học viên..."
                      className="pl-9"
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                    />
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                  <Button variant="outline" onClick={() => setAddStudentModal(true)}><Plus className="h-4 w-4 mr-2" /> Thêm học viên</Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(PACKAGE_TYPES).map(([key, info]) => (
                  <Card key={key} className="bg-card/50">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${info.color.split(" ")[1]}`} />
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{info.label}</p>
                          <p className="text-sm font-semibold">{classStudents.filter(s => s.package === key).length} học viên</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Học viên</th>
                        <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Gói đăng ký</th>
                        <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">Tiến độ</th>
                        <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {classStudents.filter(s => !studentSearch || s.full_name.toLowerCase().includes(studentSearch.toLowerCase())).map(student => (
                        <tr key={student.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                {student.full_name.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-foreground">{student.full_name}</p>
                                  {comments[student.id]?.length > 0 && (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-200">
                                      {comments[student.id].length} nhận xét
                                    </Badge>
                                  )}
                                </div>
                                {(student.school || student.grade) && (
                                  <p className="text-[11px] text-muted-foreground">
                                    {[student.school, student.grade].filter(Boolean).join(" · ")}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex gap-1 flex-wrap">
                                {(["online", "advanced", "offline"] as StudentPackage[]).map(pkg => (
                                  <button
                                    key={pkg}
                                    onClick={() => handleSetPackage(student.id, pkg)}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${student.package === pkg ? `${PACKAGE_TYPES[pkg].color} border-transparent` : "border-border text-muted-foreground hover:border-primary/40"}`}
                                  >
                                    {PACKAGE_TYPES[pkg].label}
                                  </button>
                                ))}
                              </div>
                              <p className="text-[10px] text-muted-foreground italic">{PACKAGE_TYPES[student.package].description}</p>
                            </div>
                          </td>
                          <td className="p-4 min-w-[150px]">
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px] font-medium">
                                <span className="text-muted-foreground">Hoàn thành</span>
                                <span className="text-primary">{student.progress}%</span>
                              </div>
                              <ProgressBar value={student.progress} className="h-1.5" />
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="sm" variant="outline" onClick={() => setCommentModalStudent(student)}
                                className="text-xs h-8 flex items-center gap-1 hover:bg-primary/5 hover:text-primary transition-all font-semibold">
                                <MessageSquare className="h-3.5 w-3.5" /> Nhận xét
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground"><Eye className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground"><Edit3 className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "tuition" && (
            <TuitionTab classId={classId} students={classStudents} />
          )}
        </div>
      </div>

      {uploadModal && (
        <UploadModal
          type={uploadModal}
          classId={classId}
          onClose={() => setUploadModal(null)}
          onMaterialSaved={mat => setUploadedMaterials(prev => [...prev, mat])}
        />
      )}
      {commentModalStudent && (
        <FeedbackModal
          student={commentModalStudent}
          commentsList={comments[commentModalStudent.id] || []}
          onSave={(text, date, rating) => handleSaveComment(commentModalStudent.id, text, date, rating)}
          onClose={() => setCommentModalStudent(null)}
        />
      )}
      {(homeworkModal.open || homeworkModalForSession) && (
        <HomeworkModal
          classId={classId}
          initial={homeworkModal.editing}
          onSave={hw => {
            handleSaveHomework(hw);
            if (homeworkModalForSession) setHomeworkModalForSession(null);
          }}
          onClose={() => {
            setHomeworkModal({ open: false });
            setHomeworkModalForSession(null);
          }}
        />
      )}
      {sessionNotesPanel && (
        <SessionNotesPanel
          classId={classId}
          dateStr={sessionNotesPanel}
          onClose={() => {
            // Refresh notes from localStorage after closing
            try {
              const raw = localStorage.getItem(`tutorhub_session_notes_${classId}`);
              if (raw) setSessionNotes(JSON.parse(raw));
            } catch {}
            setSessionNotesPanel(null);
          }}
        />
      )}
      {addStudentModal && (
        <AddStudentModal
          classId={classId}
          enrolledIds={allEnrolledIds}
          approvedEnrollments={approvedEnrollments}
          onAdd={newIds => setExtraStudentIds(prev => [...new Set([...prev, ...newIds])])}
          onClose={() => setAddStudentModal(false)}
        />
      )}
    </PortalLayout>
  );
}
