"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LearningModeBadge, SectionHeader } from "@/components/shared";
import { MOCK_CLASSES } from "@/lib/mock-data";
import { getOnlineLink, getClassTeacherOverrides, kvGet, kvSet } from "@/lib/storage";
import {
  BookOpen, Clock, Video, MapPin, Users, Settings, Search,
  GraduationCap, X, Plus, Trash2, Check,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const TEACHER_ID   = "t1";
const TEACHER_NAME = "Thầy Hùng Toán";
const LS_KEY       = "tutorhub_teacher_classes";

const DAY_VI: Record<string, string> = {
  Monday: "Thứ Hai", Tuesday: "Thứ Ba", Wednesday: "Thứ Tư",
  Thursday: "Thứ Năm", Friday: "Thứ Sáu", Saturday: "Thứ Bảy", Sunday: "Chủ Nhật",
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type DayKey = typeof DAYS[number];

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
  try { return await kvGet<ExtraClass[]>(LS_KEY, []); } catch { return []; }
}
async function saveExtraClasses(list: ExtraClass[]) {
  await kvSet(LS_KEY, list);
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
  schedule: [{ day: "Monday", start_time: "18:00", end_time: "19:30" }],
};

// ── Create class modal ────────────────────────────────────────────────────────
function CreateClassModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (cls: ExtraClass) => void;
}) {
  const [form, setForm]     = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const overlayRef          = useRef<HTMLDivElement>(null);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: undefined }));
  }

  function addRow() {
    setForm(f => ({ ...f, schedule: [...f.schedule, { day: "Monday", start_time: "18:00", end_time: "19:30" }] }));
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
      tutor_id:      TEACHER_ID,
      created_at:    new Date().toISOString(),
    };
    const list = await loadExtraClasses();
    await saveExtraClasses([cls, ...list]);
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
                    {DAYS.map(d => <option key={d} value={d}>{DAY_VI[d]}</option>)}
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
  const [search,       setSearch]       = useState("");
  const [onlineLinks,  setOnlineLinks]  = useState<Record<string, string>>({});
  const [extraClasses, setExtraClasses] = useState<ExtraClass[]>([]);
  const [showCreate,   setShowCreate]   = useState(false);

  const [teacherOverrides, setTeacherOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    getClassTeacherOverrides().then(setTeacherOverrides);
    loadExtraClasses().then(list => setExtraClasses(list.filter(c => c.tutor_id === TEACHER_ID)));
  }, []);

  const baseClasses = useMemo(
    () => MOCK_CLASSES.filter(c => {
      const effectiveTutor = teacherOverrides[c.id] ?? c.tutor_id;
      return effectiveTutor === TEACHER_ID;
    }),
    [teacherOverrides]
  );

  const myClasses = useMemo(
    () => [...baseClasses, ...extraClasses],
    [baseClasses, extraClasses]
  );

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

  return (
    <PortalLayout role="teacher" userName={TEACHER_NAME} pageTitle="Lớp học của tôi">
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
                  className="overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group animate-fade-in border-border/50 flex flex-col"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {/* Color bar */}
                  <div className="h-1.5 w-full shrink-0" style={{ background: cls.color }} />

                  <CardHeader className="pb-3 bg-muted/10">
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

                  <CardContent className="space-y-3 flex-1 flex flex-col pt-3">
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
                            {DAY_VI[s.day] ?? s.day}
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
                    <div className="flex items-center gap-2 pt-1 mt-auto border-t border-border/50">
                      {liveLink ? (
                        <Button
                          size="sm"
                          variant="gradient"
                          className="flex-1"
                          onClick={() => window.open(liveLink, "_blank", "noopener,noreferrer")}
                        >
                          <Video className="h-3.5 w-3.5 mr-1.5" /> Mở Online
                        </Button>
                      ) : isNew ? (
                        <Button size="sm" variant="outline" className="flex-1 text-muted-foreground" disabled>
                          <Video className="h-3.5 w-3.5 mr-1.5" /> Thêm link
                        </Button>
                      ) : (
                        <Link href={`/teacher/classes/${cls.id}?tab=schedule`} className="flex-1">
                          <Button size="sm" variant="outline" className="w-full gap-1.5 text-muted-foreground">
                            <Video className="h-3.5 w-3.5" /> Thêm link
                          </Button>
                        </Link>
                      )}
                      {isNew ? (
                        <Button size="sm" variant="outline" className="gap-1.5 text-muted-foreground" disabled>
                          <Settings className="h-3.5 w-3.5" /> Quản lý
                        </Button>
                      ) : (
                        <Link href={`/teacher/classes/${cls.id}`}>
                          <Button size="sm" variant="outline" className="gap-1.5">
                            <Settings className="h-3.5 w-3.5" /> Quản lý
                          </Button>
                        </Link>
                      )}
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
        />
      )}
    </PortalLayout>
  );
}
