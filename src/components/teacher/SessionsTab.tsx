"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MOCK_ATTENDANCE } from "@/lib/mock-data";
import { kvSet, type CurriculumSession as CurriculumSessionData } from "@/lib/storage";
import {
  Clock, FileText, Save, CheckCircle2, CalendarDays, CheckSquare,
  UserCheck, UserX, Map,
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

  async function handleSave() {
    const newRecs: SavedAttendanceRecord[] = Object.entries(marks).map(([student_id, status]) => ({
      class_id: classId,
      student_id,
      date,
      status,
      saved_at: new Date().toISOString(),
    }));
    const others = savedRecords.filter(r => !(r.class_id === classId && r.date === date));
    const updated = [...others, ...newRecs];
    try { await kvSet("tutorhub_teacher_attendance", updated); } catch {}
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
  getAttendanceStatsForDate: (dateStr: string, cid: string) => { present: number; late: number; absent: number };
}) {
  return (
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
  );
}
