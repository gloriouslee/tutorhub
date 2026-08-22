"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { replaceClassAttendanceForDate, type CurriculumSession as CurriculumSessionData } from "@/lib/storage";
import {
  attendanceMarksChanged,
  toggleAttendanceStatus,
} from "@/lib/attendance";
import {
  Clock, FileText, Save, CheckCircle2, CalendarDays, CheckSquare,
  UserCheck, UserX, Map, Wifi, RotateCcw, X,
} from "lucide-react";
import {
  formatDate,
  type Session,
  type AttendanceStatus,
  type SavedAttendanceRecord,
} from "./classDetail.types";

// ── Curriculum session preview (shown inside Buổi học cards) ─────────────────

const LESSON_TYPE_META: Record<string, { label: string; color: string }> = {
  lecture:  { label: "Bài giảng",      color: "text-blue-600 dark:text-blue-400" },
  material: { label: "Tài liệu",       color: "text-emerald-600 dark:text-emerald-400" },
  homework: { label: "Bài tập",        color: "text-amber-600 dark:text-amber-400" },
  solution: { label: "Video chữa bài", color: "text-violet-600 dark:text-violet-400" },
  exam:     { label: "Bài kiểm tra",   color: "text-rose-600 dark:text-rose-400" },
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

// ── Inline attendance panel (inside session cards) ────────────────────────────

function attendanceMarksFor(
  records: SavedAttendanceRecord[],
  classId: string,
  date: string,
  studentIds: readonly string[],
): Record<string, AttendanceStatus> {
  const marks: Record<string, AttendanceStatus> = {};
  const managedStudentIds = new Set(studentIds);
  for (const record of records) {
    if (
      record.class_id === classId
      && record.date === date
      && managedStudentIds.has(record.student_id)
    ) {
      marks[record.student_id] = record.status;
    }
  }
  return marks;
}

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
  const studentIds = useMemo(() => students.map((student) => student.id), [students]);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(
    () => attendanceMarksFor(savedRecords, classId, date, studentIds),
  );
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Re-sync when the persisted attendance records arrive.
  useEffect(() => {
    setMarks(attendanceMarksFor(savedRecords, classId, date, studentIds));
  }, [classId, date, savedRecords, studentIds]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setSaveError("");
    const managedStudentIds = students.map((student) => student.id);
    const managedSet = new Set(managedStudentIds);
    const newRecs: SavedAttendanceRecord[] = Object.entries(marks).map(([student_id, status]) => ({
      class_id: classId,
      student_id,
      date,
      status,
      saved_at: new Date().toISOString(),
    }));
    const updated: SavedAttendanceRecord[] = [
      ...savedRecords.filter(r => !(
        r.class_id === classId
        && r.date === date
        && managedSet.has(r.student_id)
      )),
      ...newRecs,
    ];
    try {
      await replaceClassAttendanceForDate(
        classId,
        date,
        newRecs,
        managedStudentIds,
      );
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError("Không thể lưu điểm danh. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  const persistedMarks = attendanceMarksFor(savedRecords, classId, date, studentIds);
  const hasChanges = attendanceMarksChanged(marks, persistedMarks);
  const presentCount = Object.values(marks).filter(s => s === "present").length;
  const onlineCount  = Object.values(marks).filter(s => s === "online").length;
  const lateCount    = Object.values(marks).filter(s => s === "late").length;
  const absentCount  = Object.values(marks).filter(s => s === "absent").length;

  return (
    <div className="mt-3 border border-border/60 rounded-xl overflow-hidden">
      {/* Stats row */}
      <div className="grid grid-cols-2 divide-x divide-border/60 bg-muted/20 sm:grid-cols-4">
        <div className="px-4 py-2 text-center">
          <p className="text-base font-bold text-emerald-600">{presentCount}</p>
          <p className="text-[10px] text-emerald-600/80 font-medium">Có mặt</p>
        </div>
        <div className="px-4 py-2 text-center">
          <p className="text-base font-bold text-sky-600">{onlineCount}</p>
          <p className="text-[10px] text-sky-600/80 font-medium">Học online</p>
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
              <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setMarks(prev => toggleAttendanceStatus(prev, student.id, "present"))}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${status === "present" ? "bg-emerald-500 text-white border-emerald-500 shadow-sm" : "bg-background border-border text-muted-foreground hover:border-emerald-400 hover:text-emerald-600"}`}
                >
                  <UserCheck className="h-3 w-3" />Có mặt
                </button>
                <button
                  type="button"
                  onClick={() => setMarks(prev => toggleAttendanceStatus(prev, student.id, "online"))}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${status === "online" ? "bg-sky-500 text-white border-sky-500 shadow-sm" : "bg-background border-border text-muted-foreground hover:border-sky-400 hover:text-sky-600"}`}
                >
                  <Wifi className="h-3 w-3" />Xin học online
                </button>
                <button
                  type="button"
                  onClick={() => setMarks(prev => toggleAttendanceStatus(prev, student.id, "late"))}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${status === "late" ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-background border-border text-muted-foreground hover:border-amber-400 hover:text-amber-600"}`}
                >
                  <Clock className="h-3 w-3" />Đi trễ
                </button>
                <button
                  type="button"
                  onClick={() => setMarks(prev => toggleAttendanceStatus(prev, student.id, "absent"))}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${status === "absent" ? "bg-red-500 text-white border-red-500 shadow-sm" : "bg-background border-border text-muted-foreground hover:border-red-400 hover:text-red-500"}`}
                >
                  <UserX className="h-3 w-3" />Vắng
                </button>
                {status && (
                  <button
                    type="button"
                    onClick={() => setMarks((current) => {
                      const next = { ...current };
                      delete next[student.id];
                      return next;
                    })}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Bỏ điểm danh ${student.full_name}`}
                    title="Đưa về chưa điểm danh"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Save row */}
      <div className="px-4 py-3 bg-muted/10 border-t border-border/40 flex flex-wrap items-center gap-3">
        {Object.keys(marks).length > 0 && (
          <Button size="sm" variant="outline" className="h-8" onClick={() => setMarks({})}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Reset buổi này
          </Button>
        )}
        <Button size="sm" variant="gradient" className="h-8" onClick={handleSave} disabled={!hasChanges || saving}>
          <Save className="h-3.5 w-3.5 mr-1.5" />{saving ? "Đang lưu…" : "Lưu điểm danh"}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />Đã lưu
          </span>
        )}
        {saveError && <span role="alert" className="text-xs font-medium text-red-600">{saveError}</span>}
      </div>
    </div>
  );
}

// ── Sessions tab ──────────────────────────────────────────────────────────────

export default function SessionsTab({
  classId,
  upcomingSessions,
  pastSessions,
  showPastSessions,
  setShowPastSessions,
  curriculumByDate,
  sessionNotes,
  classStudents,
  savedAttendanceRecords,
  setSavedAttendanceRecords,
  openAttendanceDate,
  setOpenAttendanceDate,
  setHomeworkModalForSession,
  setSessionNotesPanel,
  getAttendanceStatsForDate,
}: {
  classId: string;
  upcomingSessions: Session[];
  pastSessions: Session[];
  showPastSessions: boolean;
  setShowPastSessions: React.Dispatch<React.SetStateAction<boolean>>;
  curriculumByDate: Record<string, CurriculumSessionData>;
  sessionNotes: Record<string, string>;
  classStudents: { id: string; full_name: string; school: string }[];
  savedAttendanceRecords: SavedAttendanceRecord[];
  setSavedAttendanceRecords: (updated: SavedAttendanceRecord[]) => void;
  openAttendanceDate: string | null;
  setOpenAttendanceDate: React.Dispatch<React.SetStateAction<string | null>>;
  setHomeworkModalForSession: (dateStr: string | null) => void;
  setSessionNotesPanel: (dateStr: string | null) => void;
  getAttendanceStatsForDate: (dateStr: string, cid: string) => { present: number; online: number; late: number; absent: number };
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground">Buổi học</h3>
          <p className="text-sm text-muted-foreground">Điểm danh hôm nay, điểm danh bù 12 tuần gần nhất hoặc chọn một ngày cũ hơn</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/teacher/attendance?class=${encodeURIComponent(classId)}`}>
            <CalendarDays className="mr-1.5 h-3.5 w-3.5" />Điểm danh ngày khác
          </Link>
        </Button>
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
                  {session.isToday ? (
                    <Button
                      size="sm"
                      variant={openAttendanceDate === session.date ? "gradient" : "outline"}
                      className="text-xs h-8"
                      onClick={() => setOpenAttendanceDate(prev => prev === session.date ? null : session.date)}
                    >
                      <UserCheck className="h-3.5 w-3.5 mr-1.5" />Điểm danh
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="text-xs h-8" disabled>
                      Chưa đến buổi học
                    </Button>
                  )}
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
            <Clock className="h-4 w-4 text-muted-foreground" /> Điểm danh bù buổi đã qua
            <span className="text-xs font-normal text-muted-foreground">({pastSessions.length} buổi)</span>
          </h4>
          <button
            onClick={() => setShowPastSessions(v => !v)}
            className="text-xs text-primary hover:underline font-medium"
          >
            {showPastSessions ? "Ẩn các buổi đã qua" : `Mở ${pastSessions.length} buổi để điểm danh bù`}
          </button>
        </div>

        {showPastSessions && pastSessions.slice().reverse().map((session, i) => {
          const stats = getAttendanceStatsForDate(session.date, classId);
          const hasStats = stats.present + stats.online + stats.late + stats.absent > 0;
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
                          {stats.online > 0 && <span className="text-sky-600 font-medium"> · {stats.online} học online</span>}
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
                      <UserCheck className="h-3.5 w-3.5 mr-1.5" />{hasStats ? "Sửa điểm danh" : "Điểm danh bù"}
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
  );
}
