"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LearningModeBadge, SectionHeader, ProgressBar } from "@/components/shared";
import {
  MOCK_CLASSES, MOCK_TEACHERS, MOCK_CLASS_MATERIALS, MOCK_LECTURES, MOCK_CLASS_NOTES, MOCK_STUDENTS
} from "@/lib/mock-data";
import {
  getStudentComments, saveStudentComment,
  getClassScheduleOverride, saveClassScheduleOverride,
  pushScheduleNotification,
} from "@/lib/storage";
import { ClassSchedule } from "@/types";
import {
  BookOpen, Clock, Video, Users, ArrowLeft, FileText, Download,
  PlayCircle, StickyNote, Pin, Eye, Plus, Upload,
  Calendar, Presentation, Tag, Trash2, Edit3, X, Check,
  Lock, Send, MessageSquare, Save, AlertCircle, CheckCircle2,
  Image, Loader2
} from "lucide-react";

type TabKey = "overview" | "schedule" | "lectures" | "materials" | "notes" | "students";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "overview",  label: "Tổng quan",  icon: BookOpen },
  { key: "schedule",  label: "Lịch học",   icon: Calendar },
  { key: "lectures",  label: "Bài giảng",  icon: Presentation },
  { key: "materials", label: "Tài liệu",   icon: FileText },
  { key: "notes",     label: "Ghi chú",    icon: StickyNote },
  { key: "students",  label: "Học viên",   icon: Users },
];

const DAYS_VI = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

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

      // Push schedule-change notification for student portal
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
      {/* Schedule rows */}
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

      {/* Notification message */}
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

      {/* Save button */}
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

      {/* Preview */}
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

function UploadModal({ type, onClose }: { type: "lecture" | "material" | "note"; onClose: () => void }) {
  const titles = { lecture: "Thêm bài giảng mới", material: "Tải lên tài liệu", note: "Viết ghi chú mới" };
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
            <Input placeholder={type === "note" ? "VD: Lưu ý quan trọng..." : "VD: Chương 5 - Tích phân..."} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Mô tả</label>
            <textarea className="w-full min-h-[100px] p-3 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder={type === "note" ? "Nội dung ghi chú..." : "Mô tả ngắn gọn..."} />
          </div>
          {type !== "note" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Tải file lên</label>
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Kéo thả file hoặc nhấn để chọn</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, PPTX, MP4 · Tối đa 100MB</p>
              </div>
            </div>
          )}
          {type === "note" && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="pin-note" className="rounded" />
              <label htmlFor="pin-note" className="text-sm text-muted-foreground flex items-center gap-1.5"><Pin className="h-3.5 w-3.5" />Ghim ghi chú này</label>
            </div>
          )}
          {type === "material" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Phân loại</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CATEGORY_MAP).map(([key, val]) => (
                  <button key={key} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:shadow-sm ${val.color}`}>{val.label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="p-5 border-t border-border bg-muted/20 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button variant="gradient"><Send className="h-4 w-4 mr-2" />{type === "note" ? "Đăng ghi chú" : "Tải lên"}</Button>
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

  const cls = MOCK_CLASSES.find(c => c.id === classId);

  useEffect(() => {
    if (!cls) return;
    // Load schedule override from localStorage (falls back to mock if none)
    const override = getClassScheduleOverride(classId);
    setCurrentSchedule(override ?? cls.schedule);
  }, [classId, cls]);

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
  const materials = MOCK_CLASS_MATERIALS.filter(m => m.class_id === classId);
  const lectures = MOCK_LECTURES.filter(l => l.class_id === classId);
  const notes = MOCK_CLASS_NOTES.filter(n => n.class_id === classId);

  const classStudents = MOCK_STUDENTS.map((s, idx) => ({
    ...s,
    package: idx % 3 === 0 ? "online" : idx % 3 === 1 ? "advanced" : "offline",
    join_date: "2024-09-0" + (idx + 1),
    progress: [72, 85, 61, 90, 78][idx] ?? 70,
  }));

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
                {cls.zoom_link && (
                  <Button variant="gradient" className="w-full shadow-lg shadow-primary/20"><Video className="h-4 w-4 mr-2" />Mở phòng học Online</Button>
                )}
              </div>
            </div>
          )}

          {/* ── Schedule ── */}
          {activeTab === "schedule" && currentSchedule !== null && (
            <div className="max-w-2xl">
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
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                        <h3 className="font-semibold text-sm text-foreground line-clamp-2 mb-1">{mat.title}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{mat.description}</p>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-auto mb-3">
                          <span>{mat.file_size}</span><span>·</span>
                          <span className="flex items-center gap-1"><Download className="h-3 w-3" />{mat.download_count}</span>
                        </div>
                        <div className="pt-3 border-t border-border/50">
                          <Button size="sm" variant="outline" className="w-full text-xs h-8"><Eye className="h-3 w-3 mr-1.5" />Xem trước</Button>
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
                    <Input placeholder="Tìm tên học viên..." className="pl-9" />
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                  <Button variant="outline"><Plus className="h-4 w-4 mr-2" /> Thêm học viên</Button>
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
                      {classStudents.map(student => (
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
                                <p className="text-[11px] text-muted-foreground">{student.school} · {student.grade}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1">
                              <Badge className={`w-fit text-[10px] font-bold ${PACKAGE_TYPES[student.package].color} border-0`}>
                                {PACKAGE_TYPES[student.package].label}
                              </Badge>
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
        </div>
      </div>

      {uploadModal && <UploadModal type={uploadModal} onClose={() => setUploadModal(null)} />}
      {commentModalStudent && (
        <FeedbackModal
          student={commentModalStudent}
          commentsList={comments[commentModalStudent.id] || []}
          onSave={(text, date, rating) => handleSaveComment(commentModalStudent.id, text, date, rating)}
          onClose={() => setCommentModalStudent(null)}
        />
      )}
    </PortalLayout>
  );
}
