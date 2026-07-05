"use client";

import { toLocalDateKey } from "@/lib/utils";

import { useState, useEffect, useMemo } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader, ProgressBar } from "@/components/shared";
import {
  MOCK_STUDENTS, MOCK_CLASSES, MOCK_EXAM_SCORES,
  MOCK_ATTENDANCE, MOCK_HOMEWORK, MOCK_SUBMISSIONS,
} from "@/lib/mock-data";
import {
  getStudentComments, saveStudentComment,
  getStudentPackages, type StudentPackage,
  getExamScoresByStudent, saveExamScore, deleteExamScore, type StoredExamScore,
} from "@/lib/storage";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search, GraduationCap, BookOpen, CheckSquare,
  Star, MessageSquare, X, ChevronDown, ChevronUp,
  ArrowLeft, TrendingUp, ClipboardList, UserCheck,
  Clock, AlertCircle, CheckCircle2, XCircle, Target, Plus, Trash2,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const TEACHER_ID   = "t1";
const TEACHER_NAME = "Thầy Hùng Toán";
const PKG_LABELS: Record<string, string> = { online: "Online", advanced: "Nâng cao", offline: "Offline" };

// ── Types ─────────────────────────────────────────────────────────────────────
interface SavedAttendanceRecord {
  class_id: string;
  student_id: string;
  date: string;
  status: string;
  saved_at: string;
}

interface Submission {
  homework_id: string;
  student_id: string;
  submitted_at?: string | null;
  score?: number | null;
  feedback?: string | null;
  status?: string;
}

type DetailTab = "overview" | "scores" | "attendance" | "homework" | "comments";

// ── Helpers ───────────────────────────────────────────────────────────────────
function avgScore(studentId: string, classIds: string[]): number | null {
  const scores = MOCK_EXAM_SCORES.filter(
    e => e.student_id === studentId && classIds.includes(e.class_id)
  );
  if (!scores.length) return null;
  return scores.reduce((s, e) => s + (e.score / e.max_score) * 10, 0) / scores.length;
}

function attendanceRate(studentId: string, classIds: string[], extra: SavedAttendanceRecord[]): number | null {
  const byKey = new Map<string, string>();
  for (const r of MOCK_ATTENDANCE.filter(a => a.student_id === studentId && classIds.includes(a.class_id)))
    byKey.set(`${r.class_id}|${r.attendance_date}`, r.status);
  for (const r of extra.filter(a => a.student_id === studentId && classIds.includes(a.class_id)))
    byKey.set(`${r.class_id}|${r.date}`, r.status);
  if (!byKey.size) return null;
  let ok = 0;
  byKey.forEach(s => { if (s === "present" || s === "late") ok++; });
  return Math.round((ok / byKey.size) * 100);
}

function gradeColor(val: number | null, max: number) {
  if (val === null) return "text-muted-foreground";
  const pct = val / max;
  if (pct >= 0.85) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 0.7)  return "text-indigo-600 dark:text-indigo-400";
  return "text-amber-600 dark:text-amber-400";
}

function barColor(val: number | null, max: number) {
  if (val === null) return "bg-muted";
  const pct = val / max;
  if (pct >= 0.85) return "bg-emerald-500";
  if (pct >= 0.7)  return "bg-indigo-500";
  return "bg-amber-500";
}

// ── Attendance meta ───────────────────────────────────────────────────────────
const ATTENDANCE_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  present: { label: "Có mặt",   color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400", Icon: CheckCircle2 },
  late:    { label: "Đi trễ",   color: "text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400",         Icon: Clock },
  absent:  { label: "Vắng mặt", color: "text-rose-700 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400",             Icon: XCircle },
  excused: { label: "Có phép",  color: "text-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400",     Icon: AlertCircle },
};

// ── Comments Tab ──────────────────────────────────────────────────────────────
function CommentsTab({ studentId }: { studentId: string }) {
  const [comments, setComments] = useState<{ text: string; date: string; rating: number }[]>([]);
  const [text,   setText]   = useState("");
  const [rating, setRating] = useState(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getStudentComments(studentId).then(setComments); }, [studentId]);

  async function handleAdd() {
    if (!text.trim()) return;
    setSaving(true);
    const today = toLocalDateKey(new Date());
    const updated = [{ text: text.trim(), date: today, rating }, ...comments];
    await saveStudentComment(studentId, updated);
    setComments(updated);
    setText("");
    setRating(5);
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Thêm nhận xét mới</p>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, j) => (
              <button key={j} onClick={() => setRating(j + 1)}>
                <Star className={`h-5 w-5 transition-colors ${j < rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30 hover:text-amber-300"}`} />
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-2">{rating}/5 sao</span>
          </div>
          <textarea
            rows={3}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Nhập nhận xét về học viên..."
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground"
          />
          <div className="flex justify-end">
            <Button size="sm" variant="gradient" onClick={handleAdd} disabled={!text.trim() || saving}>
              Lưu nhận xét
            </Button>
          </div>
        </CardContent>
      </Card>

      {comments.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Chưa có nhận xét nào.</div>
      ) : (
        <div className="space-y-3">
          {comments.map((c, i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className={`h-3.5 w-3.5 ${j < c.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20"}`} />
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{new Date(c.date).toLocaleDateString("vi-VN")}</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{c.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Student Detail Panel ──────────────────────────────────────────────────────
function StudentDetailPanel({
  student,
  studentClasses,
  packagesMap,
  savedAttendance,
  onBack,
}: {
  student: (typeof MOCK_STUDENTS)[0];
  studentClasses: typeof MOCK_CLASSES;
  packagesMap: Record<string, Record<string, StudentPackage>>;
  savedAttendance: SavedAttendanceRecord[];
  onBack: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const [lsSubmissions, setLsSubmissions] = useState<Submission[]>([]);
  const [gpaTarget, setGpaTarget] = useState<number | null>(null);
  const [storedScores, setStoredScores] = useState<StoredExamScore[]>([]);
  const [showScoreForm, setShowScoreForm] = useState(false);
  const [scoreForm, setScoreForm] = useState({ exam_name: "", score: "", max_score: "10", exam_date: toLocalDateKey(new Date()), class_id: "" });

  const studentClassIds = studentClasses.map(c => c.id);
  const classNameMap = Object.fromEntries(studentClasses.map(c => [c.id, c.class_name]));

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tutorhub_submissions");
      if (raw) setLsSubmissions(JSON.parse(raw));
    } catch {}
    try {
      const val = localStorage.getItem(`tutorhub_gpa_target_${student.id}`);
      if (val) setGpaTarget(parseFloat(val));
    } catch {}
    getExamScoresByStudent(student.id).then(setStoredScores);
    setScoreForm(f => ({ ...f, class_id: studentClasses[0]?.id ?? "" }));
  }, [student.id]);

  // Scores — merge mock + localStorage, deduped
  const examScores = useMemo(() => {
    const mock = MOCK_EXAM_SCORES.filter(e => e.student_id === student.id && studentClassIds.includes(e.class_id));
    const real = storedScores.filter(e => studentClassIds.includes(e.class_id));
    const seen = new Set<string>();
    return [...mock, ...real]
      .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; })
      .sort((a, b) => a.exam_date.localeCompare(b.exam_date));
  }, [student.id, studentClassIds, storedScores]);

  const avgVal = examScores.length
    ? examScores.reduce((s, e) => s + (e.score / e.max_score) * 10, 0) / examScores.length
    : null;

  async function handleSaveScore() {
    const s = parseFloat(scoreForm.score);
    const m = parseFloat(scoreForm.max_score);
    if (!scoreForm.exam_name.trim() || isNaN(s) || isNaN(m) || !scoreForm.class_id) return;
    await saveExamScore({
      student_id: student.id,
      class_id:   scoreForm.class_id,
      exam_name:  scoreForm.exam_name.trim(),
      score:      s,
      max_score:  m,
      exam_date:  scoreForm.exam_date,
    });
    getExamScoresByStudent(student.id).then(setStoredScores);
    setShowScoreForm(false);
    setScoreForm(f => ({ ...f, exam_name: "", score: "" }));
  }

  async function handleDeleteScore(id: string) {
    await deleteExamScore(id);
    getExamScoresByStudent(student.id).then(setStoredScores);
  }

  // Attendance
  const mergedAttendance = useMemo(() => {
    const byKey = new Map<string, { date: string; class_id: string; status: string }>();
    for (const r of MOCK_ATTENDANCE.filter(a => a.student_id === student.id && studentClassIds.includes(a.class_id)))
      byKey.set(`${r.class_id}|${r.attendance_date}`, { date: r.attendance_date, class_id: r.class_id, status: r.status });
    for (const r of savedAttendance.filter(a => a.student_id === student.id && studentClassIds.includes(a.class_id)))
      byKey.set(`${r.class_id}|${r.date}`, { date: r.date, class_id: r.class_id, status: r.status });
    return [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [student.id, studentClassIds, savedAttendance]);

  const attPresent = mergedAttendance.filter(r => r.status === "present").length;
  const attLate    = mergedAttendance.filter(r => r.status === "late").length;
  const attAbsent  = mergedAttendance.filter(r => r.status === "absent").length;
  const attExcused = mergedAttendance.filter(r => r.status === "excused").length;
  const attRate    = mergedAttendance.length
    ? Math.round(((attPresent + attLate) / mergedAttendance.length) * 100)
    : null;

  // Homework
  const homework = useMemo(
    () => MOCK_HOMEWORK.filter(h => studentClassIds.includes(h.class_id)),
    [studentClassIds]
  );
  const allSubmissions: Submission[] = [
    ...MOCK_SUBMISSIONS.filter(s => s.student_id === student.id),
    ...lsSubmissions.filter(s => s.student_id === student.id),
  ];
  const submittedHwIds = new Set(allSubmissions.map(s => s.homework_id));
  const hwSubmitted = homework.filter(h => submittedHwIds.has(h.id)).length;
  const hwRate = homework.length ? Math.round((hwSubmitted / homework.length) * 100) : null;

  const TABS: { key: DetailTab; label: string; Icon: React.ElementType }[] = [
    { key: "overview",   label: "Tổng quan",  Icon: UserCheck },
    { key: "scores",     label: "Điểm số",    Icon: TrendingUp },
    { key: "attendance", label: "Chuyên cần", Icon: CheckSquare },
    { key: "homework",   label: "Bài tập",    Icon: ClipboardList },
    { key: "comments",   label: "Nhận xét",   Icon: MessageSquare },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
      </button>

      {/* Student header card */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="flex items-center gap-4 flex-wrap">
            <Avatar className="h-16 w-16 border-2 border-border shrink-0">
              <AvatarFallback name={student.full_name} />
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground">{student.full_name}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <GraduationCap className="h-3.5 w-3.5" />
                {student.grade} · {student.school}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {studentClasses.map(cls => {
                  const pkg = packagesMap[cls.id]?.[student.id];
                  return (
                    <span key={cls.id} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: cls.color }}>
                      <BookOpen className="h-2.5 w-2.5" />
                      {cls.class_name}
                      {pkg && <span className="opacity-80">· {PKG_LABELS[pkg]}</span>}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Quick stat pills */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-center">
                <p className={`text-2xl font-black ${gradeColor(avgVal, 10)}`}>{avgVal !== null ? avgVal.toFixed(1) : "—"}</p>
                <p className="text-[10px] text-muted-foreground font-medium">Điểm TB</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-black ${gpaTarget !== null ? gradeColor(gpaTarget, 10) : "text-muted-foreground"}`}>
                  {gpaTarget !== null ? gpaTarget.toFixed(1) : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-0.5 justify-center"><Target className="h-2.5 w-2.5" />Mục tiêu</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-black ${gradeColor(attRate, 100)}`}>{attRate !== null ? `${attRate}%` : "—"}</p>
                <p className="text-[10px] text-muted-foreground font-medium">Chuyên cần</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-black ${gradeColor(hwRate, 100)}`}>{hwRate !== null ? `${hwRate}%` : "—"}</p>
                <p className="text-[10px] text-muted-foreground font-medium">Nộp BT</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/60 p-1 rounded-xl overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              tab === t.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.Icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tổng quan ── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Summary cards */}
          <Card className="border-border/60">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Điểm trung bình</p>
              <p className={`text-3xl font-black ${gradeColor(avgVal, 10)}`}>{avgVal !== null ? avgVal.toFixed(2) : "—"}</p>
              <ProgressBar value={avgVal !== null ? avgVal * 10 : 0} size="sm" color={barColor(avgVal, 10)} />
              <p className="text-xs text-muted-foreground">{examScores.length} bài kiểm tra</p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chuyên cần</p>
              <p className={`text-3xl font-black ${gradeColor(attRate, 100)}`}>{attRate !== null ? `${attRate}%` : "—"}</p>
              <ProgressBar value={attRate ?? 0} size="sm" color={barColor(attRate, 100)} />
              <p className="text-xs text-muted-foreground">{mergedAttendance.length} buổi học</p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nộp bài tập</p>
              <p className={`text-3xl font-black ${gradeColor(hwRate, 100)}`}>{hwRate !== null ? `${hwRate}%` : "—"}</p>
              <ProgressBar value={hwRate ?? 0} size="sm" color={barColor(hwRate, 100)} />
              <p className="text-xs text-muted-foreground">{hwSubmitted}/{homework.length} bài đã nộp</p>
            </CardContent>
          </Card>

          {/* GPA target — always shown */}
          <Card className="border-border/60 sm:col-span-3">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-sm font-semibold text-foreground">Mục tiêu GPA của học viên</p>
                </div>
                {gpaTarget !== null ? (
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className={`text-2xl font-black ${gradeColor(gpaTarget, 10)}`}>{gpaTarget.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">/10</span>
                    </div>
                    {avgVal !== null && (
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${avgVal >= gpaTarget ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"}`}>
                        {avgVal >= gpaTarget ? `Đạt mục tiêu (+${(avgVal - gpaTarget).toFixed(1)})` : `Chưa đạt (−${(gpaTarget - avgVal).toFixed(1)})`}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Học viên chưa đặt mục tiêu</span>
                )}
              </div>
              {gpaTarget !== null && avgVal !== null && (
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Điểm hiện tại: <span className={`font-semibold ${gradeColor(avgVal, 10)}`}>{avgVal.toFixed(2)}</span></span>
                    <span>Mục tiêu: <span className="font-semibold text-foreground">{gpaTarget.toFixed(1)}</span></span>
                  </div>
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`absolute left-0 top-0 h-full rounded-full transition-all ${barColor(avgVal, 10)}`} style={{ width: `${Math.min((avgVal / 10) * 100, 100)}%` }} />
                    <div className="absolute top-0 h-full w-0.5 bg-foreground/40" style={{ left: `${(gpaTarget / 10) * 100}%` }} />
                  </div>
                </div>
              )}
              {gpaTarget === null && (
                <p className="mt-2 text-xs text-muted-foreground">Học viên có thể đặt mục tiêu GPA trong phần Điểm thi ở cổng học viên.</p>
              )}
            </CardContent>
          </Card>

          {/* Per-class breakdown */}
          {studentClasses.map(cls => {
            const clsScores = MOCK_EXAM_SCORES.filter(e => e.student_id === student.id && e.class_id === cls.id);
            const clsAvg = clsScores.length
              ? clsScores.reduce((s, e) => s + (e.score / e.max_score) * 10, 0) / clsScores.length
              : null;
            const clsAttMap = new Map<string, string>();
            for (const r of MOCK_ATTENDANCE.filter(a => a.student_id === student.id && a.class_id === cls.id))
              clsAttMap.set(r.attendance_date, r.status);
            for (const r of savedAttendance.filter(a => a.student_id === student.id && a.class_id === cls.id))
              clsAttMap.set(r.date, r.status);
            const clsAttOk = [...clsAttMap.values()].filter(s => s === "present" || s === "late").length;
            const clsAtt = clsAttMap.size ? Math.round((clsAttOk / clsAttMap.size) * 100) : null;
            const pkg = packagesMap[cls.id]?.[student.id];
            return (
              <Card key={cls.id} className="border-border/60">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: cls.color }} />
                    <p className="text-sm font-semibold text-foreground truncate flex-1">{cls.class_name}</p>
                    {pkg && <Badge variant="outline" className="text-[9px] shrink-0">{PKG_LABELS[pkg]}</Badge>}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Điểm TB</span>
                      <span className={`font-semibold ${gradeColor(clsAvg, 10)}`}>{clsAvg !== null ? clsAvg.toFixed(1) : "—"}</span>
                    </div>
                    <ProgressBar value={clsAvg !== null ? clsAvg * 10 : 0} size="sm" color={barColor(clsAvg, 10)} />
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Chuyên cần</span>
                      <span className={`font-semibold ${gradeColor(clsAtt, 100)}`}>{clsAtt !== null ? `${clsAtt}%` : "—"}</span>
                    </div>
                    <ProgressBar value={clsAtt ?? 0} size="sm" color={barColor(clsAtt, 100)} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Điểm số ── */}
      {tab === "scores" && (
        <div className="space-y-4">
          {/* Add score button + form */}
          {!showScoreForm ? (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowScoreForm(true)}>
              <Plus className="h-3.5 w-3.5" /> Thêm điểm kiểm tra
            </Button>
          ) : (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Nhập điểm kiểm tra mới</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-muted-foreground">Tên bài kiểm tra *</label>
                    <input className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="VD: Kiểm tra 15' – Hàm số" value={scoreForm.exam_name} onChange={e => setScoreForm(f => ({ ...f, exam_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Điểm *</label>
                    <input type="number" min="0" step="0.1" className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="8.5" value={scoreForm.score} onChange={e => setScoreForm(f => ({ ...f, score: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Tổng điểm</label>
                    <input type="number" min="1" className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary" value={scoreForm.max_score} onChange={e => setScoreForm(f => ({ ...f, max_score: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Ngày kiểm tra</label>
                    <input type="date" className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary" value={scoreForm.exam_date} onChange={e => setScoreForm(f => ({ ...f, exam_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Lớp</label>
                    <select className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary" value={scoreForm.class_id} onChange={e => setScoreForm(f => ({ ...f, class_id: e.target.value }))}>
                      {studentClasses.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="gap-1" onClick={handleSaveScore}><CheckCircle2 className="h-3.5 w-3.5" /> Lưu điểm</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowScoreForm(false)}>Huỷ</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {examScores.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Chưa có dữ liệu điểm. Nhấn "Thêm điểm kiểm tra" để nhập.</div>
          ) : (
            <>
              {/* Bar chart */}
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Xu hướng điểm số</p>
                  <div className="flex items-end gap-2" style={{ height: "80px" }}>
                    {examScores.map((e, i) => {
                      const pct = (e.score / e.max_score) * 100;
                      const h = Math.max(Math.round(pct * 0.7), 4);
                      return (
                        <div key={e.id} title={`${e.exam_name}: ${e.score}/${e.max_score}`} className="flex flex-col items-center gap-1 flex-1 min-w-0 justify-end h-full">
                          <span className={`text-[9px] font-bold ${gradeColor(e.score, e.max_score)}`}>{((e.score / e.max_score) * 10).toFixed(1)}</span>
                          <div className={`w-full rounded-t-sm ${barColor(e.score, e.max_score)}`} style={{ height: `${h}px` }} />
                          <span className="text-[8px] text-muted-foreground">{i + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Score list */}
              <div className="space-y-2">
                {examScores.map(e => {
                  const normalized = (e.score / e.max_score) * 10;
                  const isStored = storedScores.some(s => s.id === e.id);
                  return (
                    <Card key={e.id} className={`border-border/60 ${isStored ? "ring-1 ring-primary/20" : ""}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-foreground">{e.exam_name}</p>
                              {isStored && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Thực tế</span>}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {new Date(e.exam_date).toLocaleDateString("vi-VN")} · {classNameMap[e.class_id] ?? e.class_id}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <span className={`text-xl font-black ${gradeColor(e.score, e.max_score)}`}>{e.score}</span>
                              <span className="text-xs text-muted-foreground">/{e.max_score}</span>
                              <p className={`text-[10px] font-semibold ${gradeColor(normalized, 10)}`}>({normalized.toFixed(1)}/10)</p>
                            </div>
                            {isStored && (
                              <button onClick={() => handleDeleteScore(e.id)} className="text-muted-foreground hover:text-red-500 transition-colors p-1">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <ProgressBar value={(e.score / e.max_score) * 100} size="sm" color={barColor(e.score, e.max_score)} className="mt-2" />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card className="border-border/60 bg-muted/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Điểm trung bình tổng hợp</span>
                  <span className={`text-xl font-black ${gradeColor(avgVal, 10)}`}>{avgVal !== null ? avgVal.toFixed(2) : "—"}/10</span>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── Chuyên cần ── */}
      {tab === "attendance" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Có mặt",  count: attPresent, colorClass: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/40" },
              { label: "Đi trễ",  count: attLate,    colorClass: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/40" },
              { label: "Có phép", count: attExcused, colorClass: "text-indigo-600",  bg: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/40" },
              { label: "Vắng",    count: attAbsent,  colorClass: "text-rose-600",    bg: "bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/40" },
            ].map(s => (
              <Card key={s.label} className={`border ${s.bg}`}>
                <CardContent className="p-3 text-center">
                  <p className={`text-2xl font-black ${s.colorClass}`}>{s.count}</p>
                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {attRate !== null && (
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-foreground">Tỉ lệ chuyên cần</span>
                  <span className={`font-bold ${gradeColor(attRate, 100)}`}>{attRate}%</span>
                </div>
                <ProgressBar value={attRate} size="sm" color={barColor(attRate, 100)} />
              </CardContent>
            </Card>
          )}

          {mergedAttendance.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Chưa có dữ liệu điểm danh.</div>
          ) : (
            <div className="space-y-2">
              {mergedAttendance.map((r, i) => {
                const meta = ATTENDANCE_META[r.status] ?? ATTENDANCE_META.absent;
                const Icon = meta.Icon;
                return (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${meta.color}`}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">
                        {new Date(r.date).toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      </p>
                      <p className="text-[11px] opacity-70">{classNameMap[r.class_id] ?? r.class_id}</p>
                    </div>
                    <span className="text-xs font-semibold shrink-0">{meta.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Bài tập ── */}
      {tab === "homework" && (
        <div className="space-y-4">
          {hwRate !== null && (
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-foreground">Tỉ lệ nộp bài</span>
                  <span className={`font-bold ${gradeColor(hwRate, 100)}`}>{hwRate}% ({hwSubmitted}/{homework.length})</span>
                </div>
                <ProgressBar value={hwRate} size="sm" color={barColor(hwRate, 100)} />
              </CardContent>
            </Card>
          )}

          {homework.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Chưa có bài tập nào.</div>
          ) : (
            <div className="space-y-3">
              {homework.map(hw => {
                const sub = allSubmissions.find(s => s.homework_id === hw.id);
                const isSubmitted = !!sub;
                const isPastDue = new Date(hw.due_date) < new Date();
                return (
                  <Card key={hw.id} className={`border-border/60 ${!isSubmitted && isPastDue ? "border-rose-200 dark:border-rose-800/40" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${isSubmitted ? "bg-emerald-100 dark:bg-emerald-900/30" : isPastDue ? "bg-rose-100 dark:bg-rose-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
                          {isSubmitted
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            : isPastDue
                            ? <XCircle className="h-4 w-4 text-rose-600" />
                            : <Clock className="h-4 w-4 text-amber-600" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{hw.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {classNameMap[hw.class_id] ?? hw.class_id} · Hạn: {new Date(hw.due_date).toLocaleDateString("vi-VN")}
                          </p>
                          {sub && (
                            <div className="mt-2 space-y-1">
                              {sub.submitted_at && (
                                <p className="text-[11px] text-emerald-600">Nộp lúc: {new Date(sub.submitted_at).toLocaleDateString("vi-VN")}</p>
                              )}
                              {sub.score != null && (
                                <p className="text-[11px] font-semibold text-foreground">
                                  Điểm: <span className={gradeColor(sub.score, 10)}>{sub.score}/10</span>
                                </p>
                              )}
                              {sub.feedback && (
                                <p className="text-[11px] text-muted-foreground italic line-clamp-2">"{sub.feedback}"</p>
                              )}
                            </div>
                          )}
                          {!isSubmitted && (
                            <p className="text-[11px] mt-1 font-semibold text-rose-500">
                              {isPastDue ? "Chưa nộp (quá hạn)" : "Chưa nộp"}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Nhận xét ── */}
      {tab === "comments" && <CommentsTab studentId={student.id} />}
    </div>
  );
}

// ── Comment modal (quick-access from card) ────────────────────────────────────
function CommentModal({
  student,
  onClose,
}: {
  student: { id: string; full_name: string };
  onClose: () => void;
}) {
  const [comments, setComments] = useState<{ text: string; date: string; rating: number }[]>([]);
  const [text,     setText]     = useState("");
  const [rating,   setRating]   = useState(5);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => { getStudentComments(student.id).then(setComments); }, [student.id]);

  async function handleAdd() {
    if (!text.trim()) return;
    setSaving(true);
    const today = toLocalDateKey(new Date());
    const updated = [{ text: text.trim(), date: today, rating }, ...comments];
    await saveStudentComment(student.id, updated);
    setComments(updated);
    setText("");
    setRating(5);
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-sm text-foreground">Nhận xét học viên</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{student.full_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Chưa có nhận xét nào.</p>
          ) : (
            comments.map((c, i) => (
              <div key={i} className="p-3 rounded-xl bg-muted/50 border border-border/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className={`h-3 w-3 ${j < c.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{new Date(c.date).toLocaleDateString("vi-VN")}</span>
                </div>
                <p className="text-xs text-foreground leading-relaxed">{c.text}</p>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border p-4 space-y-3">
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, j) => (
              <button key={j} onClick={() => setRating(j + 1)}>
                <Star className={`h-5 w-5 transition-colors ${j < rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30 hover:text-amber-300"}`} />
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Nhập nhận xét về học viên..."
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Đóng</Button>
            <Button size="sm" variant="gradient" onClick={handleAdd} disabled={!text.trim() || saving}>
              Lưu nhận xét
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TeacherStudentsPage() {
  const [search,            setSearch]            = useState("");
  const [filterClassId,     setFilterClassId]     = useState("all");
  const [commentTarget,     setCommentTarget]     = useState<{ id: string; full_name: string } | null>(null);
  const [expanded,          setExpanded]          = useState<Set<string>>(new Set());
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [packagesMap,       setPackagesMap]       = useState<Record<string, Record<string, StudentPackage>>>({});
  const [savedAttendance,   setSavedAttendance]   = useState<SavedAttendanceRecord[]>([]);

  const myClasses = useMemo(
    () => MOCK_CLASSES.filter(c => c.tutor_id === TEACHER_ID),
    []
  );

  useEffect(() => {
    const map: Record<string, Record<string, StudentPackage>> = {};
    for (const cls of myClasses) map[cls.id] = getStudentPackages(cls.id);
    setPackagesMap(map);
    try {
      const raw = localStorage.getItem("tutorhub_teacher_attendance");
      if (raw) setSavedAttendance(JSON.parse(raw));
    } catch {}
  }, [myClasses]);

  const allStudentIds = useMemo(
    () => [...new Set(myClasses.flatMap(c => c.student_ids ?? []))],
    [myClasses]
  );
  const allStudents = useMemo(
    () => MOCK_STUDENTS.filter(s => allStudentIds.includes(s.id)),
    [allStudentIds]
  );

  const displayed = useMemo(() => {
    let list = allStudents;
    if (filterClassId !== "all") {
      const cls = myClasses.find(c => c.id === filterClassId);
      list = list.filter(s => (cls?.student_ids ?? []).includes(s.id));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.full_name.toLowerCase().includes(q) ||
        s.school.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allStudents, filterClassId, search, myClasses]);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedStudent = selectedStudentId
    ? allStudents.find(s => s.id === selectedStudentId) ?? null
    : null;
  const selectedClasses = selectedStudent
    ? myClasses.filter(c => (c.student_ids ?? []).includes(selectedStudent.id))
    : [];

  return (
    <PortalLayout role="teacher" userName={TEACHER_NAME} pageTitle="Học viên">
      <div className="space-y-6 max-w-6xl mx-auto">

        {selectedStudent ? (
          <StudentDetailPanel
            student={selectedStudent}
            studentClasses={selectedClasses}
            packagesMap={packagesMap}
            savedAttendance={savedAttendance}
            onBack={() => setSelectedStudentId(null)}
          />
        ) : (
          <>
            <SectionHeader
              title="Danh sách Học viên"
              subtitle={`${allStudentIds.length} học viên trong ${myClasses.length} lớp của bạn`}
            />

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm theo tên, trường..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-card text-sm outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setFilterClassId("all")}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${filterClassId === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                >
                  Tất cả lớp
                </button>
                {myClasses.map(cls => (
                  <button
                    key={cls.id}
                    onClick={() => setFilterClassId(cls.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${filterClassId === cls.id ? "text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                    style={filterClassId === cls.id ? { background: cls.color } : {}}
                  >
                    {cls.class_name}
                  </button>
                ))}
              </div>
            </div>

            {/* Student grid */}
            {displayed.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-border/50 rounded-2xl">
                <GraduationCap className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Không tìm thấy học viên nào.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {displayed.map((student, i) => {
                  const studentClasses  = myClasses.filter(c => (c.student_ids ?? []).includes(student.id));
                  const studentClassIds = studentClasses.map(c => c.id);
                  const avg  = avgScore(student.id, studentClassIds);
                  const rate = attendanceRate(student.id, studentClassIds, savedAttendance);
                  const isEx = expanded.has(student.id);

                  return (
                    <Card
                      key={student.id}
                      className="hover:shadow-md hover:-translate-y-0.5 transition-all animate-fade-in border-border/60 flex flex-col cursor-pointer"
                      style={{ animationDelay: `${i * 50}ms` }}
                      onClick={() => setSelectedStudentId(student.id)}
                    >
                      <CardContent className="p-4 space-y-4">
                        {/* Header */}
                        <div className="flex items-start gap-3">
                          <Avatar className="h-12 w-12 border-2 border-border shrink-0">
                            <AvatarFallback name={student.full_name} />
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm text-foreground truncate">{student.full_name}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <GraduationCap className="h-3 w-3 shrink-0" />
                              {student.grade} · {student.school}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {studentClasses.map(cls => {
                                const pkg = packagesMap[cls.id]?.[student.id];
                                return (
                                  <span key={cls.id} className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white" style={{ background: cls.color }}>
                                    <BookOpen className="h-2.5 w-2.5" />
                                    {cls.class_name}
                                    {pkg && <span className="opacity-75">· {PKG_LABELS[pkg]}</span>}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="space-y-2.5">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Điểm trung bình</span>
                              <span className={`font-semibold ${gradeColor(avg, 10)}`}>{avg !== null ? avg.toFixed(1) : "—"}</span>
                            </div>
                            <ProgressBar value={avg !== null ? avg * 10 : 0} size="sm" color={barColor(avg, 10)} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <CheckSquare className="h-3 w-3" /> Chuyên cần
                              </span>
                              <span className={`font-semibold ${gradeColor(rate, 100)}`}>{rate !== null ? `${rate}%` : "—"}</span>
                            </div>
                            <ProgressBar value={rate ?? 0} size="sm" color={barColor(rate, 100)} />
                          </div>
                        </div>

                        {/* Expanded exam scores */}
                        {isEx && (
                          <div className="space-y-1 pt-1 border-t border-border/50" onClick={e => e.stopPropagation()}>
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Các bài kiểm tra</p>
                            {MOCK_EXAM_SCORES
                              .filter(e => e.student_id === student.id && studentClassIds.includes(e.class_id))
                              .map(e => (
                                <div key={e.id} className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground truncate flex-1 mr-2">{e.exam_name}</span>
                                  <span className={`font-semibold shrink-0 ${gradeColor(e.score, e.max_score)}`}>{e.score}/{e.max_score}</span>
                                </div>
                              ))}
                            {MOCK_EXAM_SCORES.filter(e => e.student_id === student.id && studentClassIds.includes(e.class_id)).length === 0 && (
                              <p className="text-xs text-muted-foreground">Chưa có dữ liệu kiểm tra.</p>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-border/50" onClick={e => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs h-8 gap-1.5"
                            onClick={() => setCommentTarget({ id: student.id, full_name: student.full_name })}
                          >
                            <MessageSquare className="h-3.5 w-3.5" /> Nhận xét
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2.5 text-xs gap-1 text-muted-foreground"
                            onClick={() => toggleExpand(student.id)}
                          >
                            {isEx
                              ? <><ChevronUp className="h-3.5 w-3.5" /> Thu gọn</>
                              : <><ChevronDown className="h-3.5 w-3.5" /> Chi tiết</>
                            }
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {commentTarget && (
        <CommentModal student={commentTarget} onClose={() => setCommentTarget(null)} />
      )}
    </PortalLayout>
  );
}
