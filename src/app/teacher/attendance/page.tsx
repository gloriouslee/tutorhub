"use client";

import { useState, useEffect, useMemo } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AttendanceBadge, LearningModeBadge, SectionHeader } from "@/components/shared";
import { MOCK_STUDENTS, MOCK_CLASSES, MOCK_ATTENDANCE } from "@/lib/mock-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";
import {
  CheckSquare, Users, UserCheck, UserX, Clock,
  CalendarDays, ChevronLeft, ChevronRight, Save,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const TEACHER_ID   = "t1";
const TEACHER_NAME = "Thầy Hùng Toán";
const LS_KEY       = "tutorhub_teacher_attendance";

type Status = "present" | "absent" | "late";

// ── Persistence ───────────────────────────────────────────────────────────────
interface SavedRecord {
  class_id: string;
  student_id: string;
  date: string;
  status: Status;
  saved_at: string;
}

function loadSaved(): SavedRecord[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; }
}
function persistSaved(list: SavedRecord[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function today(): string { return new Date().toISOString().split("T")[0]; }

function shiftDate(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TeacherAttendancePage() {
  const teacherClasses = useMemo(
    () => MOCK_CLASSES.filter(c => c.tutor_id === TEACHER_ID),
    []
  );

  const [selectedClassId, setSelectedClassId] = useState(teacherClasses[0]?.id ?? "");
  const [date,            setDate]            = useState(today());
  const [marks,           setMarks]           = useState<Record<string, Status>>({});
  const [savedRecords,    setSavedRecords]    = useState<SavedRecord[]>([]);
  const [saveFlash,       setSaveFlash]       = useState(false);

  const selectedClass = teacherClasses.find(c => c.id === selectedClassId) ?? teacherClasses[0];

  // Load saved records from localStorage
  useEffect(() => {
    setSavedRecords(loadSaved());
  }, []);

  // When class or date changes, pre-fill marks from saved/mock data
  useEffect(() => {
    if (!selectedClass) return;
    const newMarks: Record<string, Status> = {};

    // From localStorage first
    const lsEntries = savedRecords.filter(
      r => r.class_id === selectedClass.id && r.date === date
    );
    lsEntries.forEach(r => { newMarks[r.student_id] = r.status; });

    // Fill remaining from MOCK_ATTENDANCE
    if (lsEntries.length === 0) {
      MOCK_ATTENDANCE
        .filter(a => a.class_id === selectedClass.id && a.attendance_date === date)
        .forEach(a => { newMarks[a.student_id] = a.status; });
    }

    setMarks(newMarks);
  }, [selectedClass, date, savedRecords]);

  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    return MOCK_STUDENTS.filter(s => (selectedClass.student_ids ?? []).includes(s.id));
  }, [selectedClass]);

  const markedCount  = Object.keys(marks).length;
  const presentCount = Object.values(marks).filter(s => s === "present").length;
  const lateCount    = Object.values(marks).filter(s => s === "late").length;
  const absentCount  = Object.values(marks).filter(s => s === "absent").length;

  // History: merge MOCK_ATTENDANCE + savedRecords for selected class, sorted newest first
  const history = useMemo(() => {
    if (!selectedClass) return [];
    const map = new Map<string, { student_id: string; date: string; status: Status }>();

    MOCK_ATTENDANCE
      .filter(a => a.class_id === selectedClass.id)
      .forEach(a => map.set(`${a.student_id}_${a.attendance_date}`, {
        student_id: a.student_id, date: a.attendance_date, status: a.status,
      }));

    savedRecords
      .filter(r => r.class_id === selectedClass.id)
      .forEach(r => map.set(`${r.student_id}_${r.date}`, {
        student_id: r.student_id, date: r.date, status: r.status,
      }));

    return [...map.values()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 12);
  }, [selectedClass, savedRecords]);

  function mark(studentId: string, status: Status) {
    setMarks(prev => ({ ...prev, [studentId]: status }));
  }

  function handleSave() {
    if (!selectedClass) return;
    const existing = loadSaved().filter(
      r => !(r.class_id === selectedClass.id && r.date === date)
    );
    const newEntries: SavedRecord[] = Object.entries(marks).map(([student_id, status]) => ({
      class_id: selectedClass.id, student_id, date, status,
      saved_at: new Date().toISOString(),
    }));
    const updated = [...newEntries, ...existing];
    persistSaved(updated);
    setSavedRecords(updated);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
  }

  if (teacherClasses.length === 0) {
    return (
      <PortalLayout role="teacher" userName={TEACHER_NAME} pageTitle="Điểm danh">
        <p className="text-muted-foreground text-sm">Bạn chưa có lớp nào.</p>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout role="teacher" userName={TEACHER_NAME} pageTitle="Điểm danh">
      <div className="space-y-6 max-w-5xl mx-auto">
        <SectionHeader
          title="Điểm danh học viên"
          subtitle="Ghi nhận chuyên cần cho các lớp của bạn"
          action={
            <Button
              variant={saveFlash ? "default" : "gradient"}
              className={saveFlash ? "bg-emerald-600 hover:bg-emerald-600 text-white" : ""}
              onClick={handleSave}
              disabled={markedCount === 0}
            >
              {saveFlash
                ? <><CheckSquare className="h-4 w-4 mr-1.5" /> Đã lưu!</>
                : <><Save className="h-4 w-4 mr-1.5" /> Lưu điểm danh</>}
            </Button>
          }
        />

        {/* ── Class tabs ────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {teacherClasses.map(cls => (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(cls.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedClassId === cls.id
                  ? "text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
              style={selectedClassId === cls.id ? { background: cls.color } : {}}
            >
              {cls.class_name}
              <LearningModeBadge mode={cls.learning_mode} />
            </button>
          ))}
        </div>

        {/* ── Stats row ─────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Học viên",  value: classStudents.length, icon: Users,      color: "text-primary" },
            { label: "Có mặt",   value: presentCount,          icon: UserCheck,  color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Đi trễ",   value: lateCount,             icon: Clock,      color: "text-amber-600 dark:text-amber-400" },
            { label: "Vắng mặt", value: absentCount,           icon: UserX,      color: "text-red-600 dark:text-red-400" },
          ].map(s => (
            <Card key={s.label} className="shadow-none border-border/60">
              <CardContent className="p-3 flex items-center gap-2.5">
                <div className={`h-8 w-8 rounded-xl bg-muted flex items-center justify-center shrink-0 ${s.color}`}>
                  <s.icon className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className={`text-lg font-bold leading-none ${s.color}`}>{s.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Mark attendance ──────────────────────────── */}
          <div className="lg:col-span-2">
            <Card className="shadow-none border-border/60">
              <CardHeader className="pb-3 border-b border-border/60">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm font-semibold">{selectedClass?.class_name}</CardTitle>

                  {/* Date picker */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setDate(d => shiftDate(d, -1))}
                      className="p-1 rounded-lg hover:bg-accent text-muted-foreground"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="text-xs text-foreground bg-transparent outline-none cursor-pointer"
                      />
                    </div>
                    <button
                      onClick={() => setDate(d => shiftDate(d, 1))}
                      disabled={date >= today()}
                      className="p-1 rounded-lg hover:bg-accent text-muted-foreground disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-2">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Có mặt</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Đi trễ</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />Vắng mặt</span>
                </div>
              </CardHeader>

              <CardContent className="pt-3">
                {classStudents.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Lớp này chưa có học viên nào.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      {classStudents.map((student, i) => {
                        const status = marks[student.id];
                        return (
                          <div
                            key={student.id}
                            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors animate-fade-in"
                            style={{ animationDelay: `${i * 50}ms` }}
                          >
                            <Avatar size="sm"><AvatarFallback name={student.full_name} /></Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground leading-none">{student.full_name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{student.grade} · {student.school}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              {(["present", "late", "absent"] as const).map(s => (
                                <button
                                  key={s}
                                  onClick={() => mark(student.id, s)}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    status === s
                                      ? s === "present" ? "bg-emerald-500 text-white shadow-sm"
                                        : s === "late"    ? "bg-amber-500 text-white shadow-sm"
                                        :                   "bg-red-500 text-white shadow-sm"
                                      : "bg-muted text-muted-foreground hover:bg-accent"
                                  }`}
                                >
                                  {s === "present" ? "Có mặt" : s === "late" ? "Đi trễ" : "Vắng"}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border mt-3">
                      <p className="text-xs text-muted-foreground">
                        Đã điểm danh <span className="font-semibold text-foreground">{markedCount}</span>/{classStudents.length} học viên
                      </p>
                      <Button
                        size="sm"
                        variant={saveFlash ? "default" : "gradient"}
                        className={saveFlash ? "bg-emerald-600 hover:bg-emerald-600 text-white" : ""}
                        onClick={handleSave}
                        disabled={markedCount === 0}
                      >
                        {saveFlash
                          ? <><CheckSquare className="h-3.5 w-3.5 mr-1" /> Đã lưu!</>
                          : <><Save className="h-3.5 w-3.5 mr-1" /> Lưu</>}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── History ──────────────────────────────────── */}
          <div>
            <Card className="shadow-none border-border/60">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-semibold">Lịch sử điểm danh</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedClass?.class_name}</p>
              </CardHeader>
              <CardContent className="pt-3 space-y-1.5">
                {history.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Chưa có dữ liệu điểm danh.</p>
                ) : (
                  history.map((h, i) => {
                    const student = MOCK_STUDENTS.find(s => s.id === h.student_id);
                    return (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <Avatar size="sm"><AvatarFallback name={student?.full_name ?? "?"} /></Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{student?.full_name ?? "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDate(h.date)}</p>
                        </div>
                        <AttendanceBadge status={h.status} />
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
