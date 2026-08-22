"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LearningModeBadge, SectionHeader } from "@/components/shared";
import { getOnlineLink, getTeacherExtraClasses, upsertTeacherExtraClass } from "@/lib/storage";
import { useTeacherContext } from "@/hooks/useTeacherContext";
import { resetAccountContextCache } from "@/hooks/useAccountContext";
import {
  BookOpen, Clock, Video, MapPin, Users, Settings, Search,
  GraduationCap, X, Plus, Trash2, Check, Copy, Loader2,
} from "lucide-react";
import { WEEKDAYS_VI, weekdayLabelVi } from "@/lib/weekday";

// ── Constants ─────────────────────────────────────────────────────────────────
// Lưu thẳng nhãn tiếng Việt làm giá trị — trước đây form này lưu "Monday" và chỉ
// dịch sang tiếng Việt khi hiển thị, nên mọi lớp tạo mới qua đây đều mang lịch học
// tiếng Anh vào dữ liệu, dù các trang khác đều hiển thị tiếng Việt.
type DayKey = (typeof WEEKDAYS_VI)[number];

const CLASS_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ec4899",
  "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6",
];

// ── Persisted extra classes ───────────────────────────────────────────────────
interface ExtraClass {
  id: string;
  class_name: string;
  subject: string;
  grade: number;
  learning_mode: "online" | "offline" | "hybrid";
  classroom: string;
  description: string;
  max_students: number;
  student_ids: string[];
  schedule: { day: string; start_time: string; end_time: string }[];
  color: string;
  tutor_id: string;
  zoom_link?: string;
  created_at: string;
}

async function loadExtraClasses(): Promise<ExtraClass[]> {
  try { return await getTeacherExtraClasses<ExtraClass>(); } catch { return []; }
}

// ── Form state ────────────────────────────────────────────────────────────────
interface ScheduleRow { day: DayKey; start_time: string; end_time: string }
interface FormState {
  class_name: string;
  subject: string;
  grade: string;
  learning_mode: "online" | "offline" | "hybrid";
  classroom: string;
  description: string;
  max_students: string;
  color: string;
  schedule: ScheduleRow[];
}

const EMPTY_FORM: FormState = {
  class_name: "", subject: "", grade: "", learning_mode: "offline",
  classroom: "", description: "", max_students: "15", color: CLASS_COLORS[0],
  schedule: [{ day: WEEKDAYS_VI[0], start_time: "18:00", end_time: "19:30" }],
};

// ── Create class modal ────────────────────────────────────────────────────────
function CreateClassModal({
  onClose,
  onCreated,
  teacherId,
}: {
  onClose: () => void;
  onCreated: (cls: ExtraClass) => void;
  teacherId: string;
}) {
  const [form, setForm]     = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const overlayRef          = useRef<HTMLDivElement>(null);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: undefined }));
  }

  function addRow() {
    setForm(f => ({ ...f, schedule: [...f.schedule, { day: WEEKDAYS_VI[0], start_time: "18:00", end_time: "19:30" }] }));
  }
  function removeRow(i: number) {
    setForm(f => ({ ...f, schedule: f.schedule.filter((_, idx) => idx !== i) }));
  }
  function setRow(i: number, patch: Partial<ScheduleRow>) {
    setForm(f => ({
      ...f,
      schedule: f.schedule.map((r, idx) => idx === i ? { ...r, ...patch } : r),
    }));
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.class_name.trim()) e.class_name = "Vui lòng nhập tên lớp";
    if (!form.subject.trim())    e.subject    = "Vui lòng nhập môn học";
    if (!form.grade || isNaN(Number(form.grade)) || Number(form.grade) < 1 || Number(form.grade) > 12)
      e.grade = "Lớp phải từ 1–12";
    if (form.schedule.length === 0) e.schedule = "Cần ít nhất 1 buổi học";
    for (const r of form.schedule) {
      if (r.start_time >= r.end_time) { e.schedule = "Giờ bắt đầu phải trước giờ kết thúc"; break; }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    const id = `cls_${Date.now()}`;
    const cls: ExtraClass = {
      id,
      class_name:    form.class_name.trim(),
      subject:       form.subject.trim(),
      grade:         Number(form.grade),
      learning_mode: form.learning_mode,
      classroom:     form.classroom.trim(),
      description:   form.description.trim(),
      max_students:  Math.max(1, Number(form.max_students) || 15),
      student_ids:   [],
      schedule:      form.schedule,
      color:         form.color,
      tutor_id:      teacherId,
      created_at:    new Date().toISOString(),
    };
    await upsertTeacherExtraClass(cls);
    onCreated(cls);
    onClose();
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Tạo lớp mới</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Thông tin lớp học sẽ hiển thị với học viên</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-5 flex-1">

          {/* Tên lớp */}
          <Field label="Tên lớp *" error={errors.class_name}>
            <input
              className={input(errors.class_name)}
              placeholder="VD: Toán Nâng Cao 12A"
              value={form.class_name}
              onChange={e => set("class_name", e.target.value)}
            />
          </Field>

          {/* Môn học + Lớp */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Môn học *" error={errors.subject}>
              <input
                className={input(errors.subject)}
                placeholder="VD: Toán học"
                value={form.subject}
                onChange={e => set("subject", e.target.value)}
              />
            </Field>
            <Field label="Khối lớp *" error={errors.grade}>
              <input
                type="number" min={1} max={12}
                className={input(errors.grade)}
                placeholder="10"
                value={form.grade}
                onChange={e => set("grade", e.target.value)}
              />
            </Field>
          </div>

          {/* Hình thức */}
          <Field label="Hình thức học">
            <div className="flex gap-2">
              {(["offline", "online", "hybrid"] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set("learning_mode", m)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                    form.learning_mode === m
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {m === "offline" ? "Trực tiếp" : m === "online" ? "Online" : "Kết hợp"}
                </button>
              ))}
            </div>
          </Field>

          {/* Phòng học */}
          {(form.learning_mode === "offline" || form.learning_mode === "hybrid") && (
            <Field label="Phòng học">
              <input
                className={input()}
                placeholder="VD: Phòng 201"
                value={form.classroom}
                onChange={e => set("classroom", e.target.value)}
              />
            </Field>
          )}

          {/* Mô tả */}
          <Field label="Mô tả lớp học">
            <textarea
              rows={2}
              className={`${input()} resize-none`}
              placeholder="Nội dung chính của lớp học..."
              value={form.description}
              onChange={e => set("description", e.target.value)}
            />
          </Field>

          {/* Sĩ số tối đa */}
          <Field label="Sĩ số tối đa">
            <input
              type="number" min={1} max={50}
              className={input()}
              value={form.max_students}
              onChange={e => set("max_students", e.target.value)}
            />
          </Field>

          {/* Màu sắc */}
          <Field label="Màu thẻ lớp">
            <div className="flex gap-2 flex-wrap">
              {CLASS_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("color", c)}
                  style={{ background: c }}
                  className={`h-7 w-7 rounded-full transition-all ${
                    form.color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"
                  }`}
                >
                  {form.color === c && <Check className="h-3 w-3 text-white mx-auto" />}
                </button>
              ))}
            </div>
          </Field>

          {/* Lịch học */}
          <Field label="Lịch học *" error={errors.schedule}>
            <div className="space-y-2">
              {form.schedule.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={row.day}
                    onChange={e => setRow(i, { day: e.target.value as DayKey })}
                    className="flex-1 h-9 rounded-xl border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {WEEKDAYS_VI.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <input
                    type="time" value={row.start_time}
                    onChange={e => setRow(i, { start_time: e.target.value })}
                    className="w-[90px] h-9 rounded-xl border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">–</span>
                  <input
                    type="time" value={row.end_time}
                    onChange={e => setRow(i, { end_time: e.target.value })}
                    className="w-[90px] h-9 rounded-xl border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {form.schedule.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
              >
                <Plus className="h-3.5 w-3.5" /> Thêm buổi học
              </button>
            </div>
          </Field>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>Huỷ</Button>
          <Button variant="gradient" size="sm" onClick={handleSubmit}>
            <Plus className="h-4 w-4 mr-1.5" /> Tạo lớp
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
function input(error?: string) {
  return `w-full h-9 rounded-xl border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground transition-all ${
    error ? "border-destructive" : "border-border"
  }`;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TeacherClassesPage() {
  const { teacherId, teacherName, myClasses: dbClasses } = useTeacherContext();
  const [search,       setSearch]       = useState("");
  const [onlineLinks,  setOnlineLinks]  = useState<Record<string, string>>({});
  const [extraClasses, setExtraClasses] = useState<ExtraClass[]>([]);
  const [showCreate,   setShowCreate]   = useState(false);
  const [hiddenClassIds, setHiddenClassIds] = useState<Set<string>>(new Set());
  const [classAction, setClassAction] = useState<{
    classId: string;
    action: "clone" | "delete";
  } | null>(null);
  const [classActionError, setClassActionError] = useState("");

  useEffect(() => {
    if (!teacherId) return;
    loadExtraClasses().then(list => setExtraClasses(list.filter(c => c.tutor_id === teacherId)));
  }, [teacherId]);

  const myClasses = useMemo(() => {
    const byId = new Map(
      [...dbClasses, ...extraClasses].map((item) => [item.id, item]),
    );
    return [...byId.values()].filter((item) => !hiddenClassIds.has(item.id));
  }, [dbClasses, extraClasses, hiddenClassIds]);

  // Load saved online links from localStorage
  useEffect(() => {
    async function loadLinks() {
      const links: Record<string, string> = {};
      for (const cls of myClasses) {
        const saved = await getOnlineLink(cls.id);
        links[cls.id] = saved ?? (cls as any).zoom_link ?? "";
      }
      setOnlineLinks(links);
    }
    loadLinks();
  }, [myClasses]);

  const displayed = useMemo(() =>
    search.trim()
      ? myClasses.filter(c =>
          c.class_name.toLowerCase().includes(search.toLowerCase()) ||
          c.subject.toLowerCase().includes(search.toLowerCase())
        )
      : myClasses,
    [myClasses, search]
  );

  const totalStudents = myClasses.reduce((s, c) => s + (c.student_ids?.length ?? 0), 0);

  function handleCreated(cls: ExtraClass) {
    setExtraClasses(prev => [cls, ...prev]);
  }

  async function cloneClass(cls: ExtraClass) {
    setClassAction({ classId: cls.id, action: "clone" });
    setClassActionError("");
    try {
      const response = await fetch(
        `/api/teacher/classes/${encodeURIComponent(cls.id)}`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clone" }),
        },
      );
      const result = await response.json() as ExtraClass & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "class_clone_failed");
      setExtraClasses((current) => [result, ...current]);
      resetAccountContextCache();
    } catch {
      setClassActionError(
        `Không thể nhân bản lớp “${cls.class_name}”. Vui lòng thử lại.`,
      );
    } finally {
      setClassAction(null);
    }
  }

  async function deleteClass(cls: ExtraClass) {
    const studentCount = cls.student_ids?.length ?? 0;
    const warning = studentCount > 0
      ? ` Lớp hiện có ${studentCount} học viên.`
      : "";
    if (!window.confirm(
      `Xóa vĩnh viễn lớp “${cls.class_name}”?${warning} Nội dung lớp sẽ bị xóa và không thể hoàn tác.`,
    )) return;

    setClassAction({ classId: cls.id, action: "delete" });
    setClassActionError("");
    try {
      const response = await fetch(
        `/api/teacher/classes/${encodeURIComponent(cls.id)}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "class_delete_failed");
      setHiddenClassIds((current) => new Set(current).add(cls.id));
      setExtraClasses((current) => current.filter((item) => item.id !== cls.id));
      resetAccountContextCache();
    } catch {
      setClassActionError(
        `Không thể xóa lớp “${cls.class_name}”. Vui lòng thử lại.`,
      );
    } finally {
      setClassAction(null);
    }
  }

  return (
    <PortalLayout role="teacher" userName={teacherName || "Giáo viên"} pageTitle="Lớp học của tôi">
      <div className="space-y-6 max-w-6xl mx-auto">
        <SectionHeader
          title="Danh sách lớp đang dạy"
          subtitle={`${myClasses.length} lớp · ${totalStudents} học viên trong học kỳ này`}
          action={
            <Button size="sm" variant="gradient" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Tạo lớp mới
            </Button>
          }
        />

        {classActionError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {classActionError}
          </div>
        )}

        {/* ── Summary stats ─────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Lớp đang dạy",  value: myClasses.length, icon: BookOpen, color: "text-primary" },
            { label: "Tổng học viên", value: totalStudents,    icon: Users,    color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Có link Online",  value: Object.values(onlineLinks).filter(Boolean).length, icon: Video, color: "text-blue-600 dark:text-blue-400" },
          ].map(stat => (
            <Card key={stat.label} className="shadow-none border-border/60">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0 ${stat.color}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Search ────────────────────────────────────── */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm tên lớp, môn học..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-card text-sm outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
          />
        </div>

        {/* ── Class grid ────────────────────────────────── */}
        {displayed.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-border/50 rounded-2xl">
            <BookOpen className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-base font-semibold text-foreground">Không tìm thấy lớp học</h3>
            <p className="text-sm text-muted-foreground mt-1">Thử thay đổi từ khoá tìm kiếm.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {displayed.map((cls, i) => {
              const studentCount = cls.student_ids?.length ?? 0;
              const liveLink     = onlineLinks[cls.id] || "";
              const isNew        = cls.id.startsWith("cls_");
              return (
                <Card
                  key={cls.id}
                  className="relative cursor-pointer overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group animate-fade-in border-border/50 flex flex-col"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {/* Color bar */}
                  <div className="h-1.5 w-full shrink-0" style={{ background: cls.color }} />

                  {/* Stretched link: toàn bộ phần thông tin của thẻ mở trang quản lý.
                      Khu vực thao tác bên dưới có z-index riêng nên vẫn hoạt động độc lập. */}
                  <Link
                    href={`/teacher/classes/${cls.id}`}
                    aria-label={`Quản lý lớp ${cls.class_name}`}
                    className="absolute inset-0 z-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  />

                  <CardHeader className="pointer-events-none relative z-10 pb-3 bg-muted/10">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="h-11 w-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm transition-transform group-hover:scale-110"
                          style={{ background: cls.color }}
                        >
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm leading-snug group-hover:text-primary transition-colors truncate">
                            {cls.class_name}
                            {isNew && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 align-middle">Mới</Badge>}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5 font-medium">{cls.subject}</p>
                        </div>
                      </div>
                      <LearningModeBadge mode={cls.learning_mode} />
                    </div>
                  </CardHeader>

                  <CardContent className="pointer-events-none relative z-10 space-y-3 flex-1 flex flex-col pt-3">
                    {/* Grade badge */}
                    {cls.grade && (
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Lớp {cls.grade}</span>
                      </div>
                    )}

                    {/* Description */}
                    {cls.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{cls.description}</p>
                    )}

                    {/* Schedule */}
                    <div className="space-y-1.5 p-2.5 bg-muted/30 rounded-xl border border-border/50">
                      {cls.schedule.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-foreground font-medium">
                          <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>
                            {weekdayLabelVi(s.day)}
                            <span className="text-muted-foreground mx-1.5">·</span>
                            {s.start_time} – {s.end_time}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {cls.classroom && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          {cls.classroom}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        {studentCount}/{cls.max_students} học viên
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="pointer-events-none relative z-20 flex items-center gap-2 pt-1 mt-auto border-t border-border/50">
                      {liveLink ? (
                        <Button
                          size="sm"
                          variant="gradient"
                          className="pointer-events-auto flex-1"
                          onClick={() => window.open(liveLink, "_blank", "noopener,noreferrer")}
                        >
                          <Video className="h-3.5 w-3.5 mr-1.5" /> Mở Online
                        </Button>
                      ) : (
                        <Button asChild size="sm" variant="outline" className="pointer-events-auto flex-1 gap-1.5 text-muted-foreground">
                          <Link href={`/teacher/classes/${cls.id}?tab=schedule`}>
                            <Video className="h-3.5 w-3.5" /> Thêm link
                          </Link>
                        </Button>
                      )}
                      <Button asChild size="sm" variant="outline" className="pointer-events-auto gap-1.5">
                        <Link href={`/teacher/classes/${cls.id}`}>
                          <Settings className="h-3.5 w-3.5" /> Quản lý
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="pointer-events-auto px-2.5"
                        aria-label={`Nhân bản lớp ${cls.class_name}`}
                        title="Nhân bản lớp (không sao chép học viên)"
                        disabled={classAction !== null}
                        onClick={() => void cloneClass(cls as ExtraClass)}
                      >
                        {classAction?.classId === cls.id
                          && classAction.action === "clone" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="pointer-events-auto px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Xóa lớp ${cls.class_name}`}
                        title="Xóa lớp"
                        disabled={classAction !== null}
                        onClick={() => void deleteClass(cls as ExtraClass)}
                      >
                        {classAction?.classId === cls.id
                          && classAction.action === "delete" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateClassModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          teacherId={teacherId}
        />
      )}
    </PortalLayout>
  );
}
