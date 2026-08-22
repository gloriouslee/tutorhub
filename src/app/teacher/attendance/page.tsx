"use client";

import { useState, useEffect, useMemo } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AttendanceBadge, LearningModeBadge, SectionHeader } from "@/components/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate, toLocalDateKey } from "@/lib/utils";
import { getAllTeacherAttendance, replaceClassAttendanceForDate, getTeacherExtraClasses, getStudents } from "@/lib/storage";
import {
  attendanceMarksChanged,
  toggleAttendanceStatus,
  type AttendanceStatus,
} from "@/lib/attendance";
import { useTeacherContext } from "@/hooks/useTeacherContext";
import type { Student } from "@/types";
import {
  CheckSquare, Users, UserCheck, UserX, Clock,
  CalendarDays, ChevronLeft, ChevronRight, Save, Wifi, RotateCcw, X,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
type Status = AttendanceStatus;

// ── Persistence ───────────────────────────────────────────────────────────────
interface SavedRecord {
  class_id: string;
  student_id: string;
  date: string;
  status: Status;
  saved_at: string;
}

async function loadSaved(classIds: string[]): Promise<SavedRecord[]> {
  try {
    return await getAllTeacherAttendance({ classIds });
  } catch {
    return [];
  }
}
// ── Helpers ───────────────────────────────────────────────────────────────────
function today(): string { return toLocalDateKey(new Date()); }

function shiftDate(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return toLocalDateKey(d);
}

// ── Page ──────────────────────────────────────────────────────────────────────
interface ExtraClass {
  id: string;
  class_name: string;
  student_ids: string[];
  tutor_id: string;
  learning_mode: "online" | "offline" | "hybrid";
  color: string;
}

async function loadExtraClasses(): Promise<ExtraClass[]> {
  try { return await getTeacherExtraClasses<ExtraClass>(); } catch { return []; }
}

export default function TeacherAttendancePage() {
  const { teacherId, teacherName, myClasses, ready } = useTeacherContext();
  const [extraClasses, setExtraClasses] = useState<ExtraClass[]>([]);
  useEffect(() => {
    if (!teacherId) return;
    loadExtraClasses().then(list => setExtraClasses(list.filter(c => c.tutor_id === teacherId)));
  }, [teacherId]);

  const teacherClasses = useMemo(
    () => [
      ...myClasses,
      ...extraClasses,
    ],
    [myClasses, extraClasses]
  );
  const teacherClassIds = useMemo(
    () => teacherClasses.map(c => c.id),
    [teacherClasses],
  );
  const teacherClassKey = teacherClassIds.join(",");

  const [selectedClassId, setSelectedClassId] = useState(teacherClasses[0]?.id ?? "");
  const [date,            setDate]            = useState(today());
  const [marks,           setMarks]           = useState<Record<string, Status>>({});
  const [savedRecords,    setSavedRecords]    = useState<SavedRecord[]>([]);
  const [students,        setStudents]        = useState<Student[]>([]);
  const [saveFlash,       setSaveFlash]       = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [saveError,       setSaveError]       = useState("");

  const selectedClass = teacherClasses.find(c => c.id === selectedClassId) ?? teacherClasses[0];

  useEffect(() => {
    if (teacherClasses.length === 0) return;
    const requestedClass = new URLSearchParams(window.location.search).get("class");
    if (requestedClass && teacherClasses.some((item) => item.id === requestedClass)) {
      setSelectedClassId(requestedClass);
    } else if (!selectedClassId) {
      setSelectedClassId(teacherClasses[0].id);
    }
    const requestedDate = new URLSearchParams(window.location.search).get("date");
    if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate <= today()) {
      setDate(requestedDate);
    }
  }, [teacherClassKey, selectedClassId, teacherClasses]);

  useEffect(() => {
    Promise.all([loadSaved(teacherClassIds), getStudents()])
      .then(([records, studentRows]) => {
        setSavedRecords(records);
        setStudents(studentRows);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherClassKey]);

  // When class or date changes, pre-fill marks from saved data.
  useEffect(() => {
    if (!selectedClass) return;
    const newMarks: Record<string, Status> = {};

    const entries = savedRecords.filter(
      r => r.class_id === selectedClass.id
        && r.date === date
        && (selectedClass.student_ids ?? []).includes(r.student_id)
    );
    entries.forEach(r => { newMarks[r.student_id] = r.status; });

    setMarks(newMarks);
  }, [selectedClass, date, savedRecords]);

  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students.filter(s => (selectedClass.student_ids ?? []).includes(s.id));
  }, [selectedClass, students]);

  const savedMarks = useMemo(() => {
    if (!selectedClass) return {};
    const managedStudentIds = new Set(classStudents.map((student) => student.id));
    return Object.fromEntries(
      savedRecords
        .filter((record) =>
          record.class_id === selectedClass.id
          && record.date === date
          && managedStudentIds.has(record.student_id)
        )
        .map((record) => [record.student_id, record.status]),
    ) as Record<string, Status>;
  }, [classStudents, date, savedRecords, selectedClass]);

  const markedCount  = Object.keys(marks).length;
  const presentCount = Object.values(marks).filter(s => s === "present").length;
  const onlineCount  = Object.values(marks).filter(s => s === "online").length;
  const lateCount    = Object.values(marks).filter(s => s === "late").length;
  const absentCount  = Object.values(marks).filter(s => s === "absent").length;
  const hasChanges = attendanceMarksChanged(marks, savedMarks);
  const isMakeupAttendance = date < today();

  const history = useMemo(() => {
    if (!selectedClass) return [];
    return savedRecords
      .filter(r => r.class_id === selectedClass.id)
      .map(r => ({ student_id: r.student_id, date: r.date, status: r.status }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 12);
  }, [selectedClass, savedRecords]);

  function mark(studentId: string, status: Status) {
    setMarks((current) => toggleAttendanceStatus(current, studentId, status));
    setSaveError("");
  }

  function clearMark(studentId: string) {
    setMarks((current) => {
      const next = { ...current };
      delete next[studentId];
      return next;
    });
    setSaveError("");
  }

  async function handleSave() {
    if (!selectedClass || !hasChanges || saving) return;
    setSaving(true);
    setSaveError("");
    const managedStudentIds = classStudents.map((student) => student.id);
    const managedSet = new Set(managedStudentIds);
    const existing = savedRecords.filter(
      r => !(
        r.class_id === selectedClass.id
        && r.date === date
        && managedSet.has(r.student_id)
      ),
    );
    const newEntries: SavedRecord[] = Object.entries(marks).map(([student_id, status]) => ({
      class_id: selectedClass.id, student_id, date, status,
      saved_at: new Date().toISOString(),
    }));
    try {
      await replaceClassAttendanceForDate(
        selectedClass.id,
        date,
        newEntries,
        managedStudentIds,
      );
      setSavedRecords([...newEntries, ...existing]);
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 2000);
    } catch {
      setSaveError("Không thể lưu điểm danh. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <PortalLayout role="teacher" userName={teacherName || "Giáo viên"} pageTitle="Điểm danh">
        <p className="text-muted-foreground text-sm">Đang tải...</p>
      </PortalLayout>
    );
  }

  if (teacherClasses.length === 0) {
    return (
      <PortalLayout role="teacher" userName={teacherName || "Giáo viên"} pageTitle="Điểm danh">
        <p className="text-muted-foreground text-sm">Bạn chưa có lớp nào.</p>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout role="teacher" userName={teacherName || "Giáo viên"} pageTitle="Điểm danh">
      <div className="space-y-6 max-w-5xl mx-auto">
        <SectionHeader
          title="Điểm danh học viên"
          subtitle="Điểm danh hôm nay hoặc chọn ngày đã qua để điểm danh bù"
          action={
            <Button
              variant={saveFlash ? "default" : "gradient"}
              className={saveFlash ? "bg-emerald-600 hover:bg-emerald-600 text-white" : ""}
              onClick={handleSave}
              disabled={!hasChanges || saving}
            >
              {saveFlash
                ? <><CheckSquare className="h-4 w-4 mr-1.5" /> Đã lưu!</>
                : <><Save className="h-4 w-4 mr-1.5" /> {saving ? "Đang lưu…" : "Lưu điểm danh"}</>}
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: "Học viên",  value: classStudents.length, icon: Users,      color: "text-primary" },
            { label: "Có mặt",   value: presentCount,          icon: UserCheck,  color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Học online", value: onlineCount,          icon: Wifi,       color: "text-sky-600 dark:text-sky-400" },
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
                  <div>
                    <CardTitle className="text-sm font-semibold">{selectedClass?.class_name}</CardTitle>
                    <p className={`mt-1 text-xs ${isMakeupAttendance ? "font-medium text-violet-600" : "text-muted-foreground"}`}>
                      {isMakeupAttendance
                        ? "Đang điểm danh bù cho một buổi đã qua"
                        : "Điểm danh buổi hôm nay"}
                    </p>
                  </div>

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
                        max={today()}
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
                    {date !== today() && (
                      <button
                        type="button"
                        onClick={() => setDate(today())}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                      >
                        Hôm nay
                      </button>
                    )}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-2">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Có mặt</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" />Xin học online</span>
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
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              {(["present", "online", "late", "absent"] as const).map(s => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => mark(student.id, s)}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    status === s
                                      ? s === "present" ? "bg-emerald-500 text-white shadow-sm"
                                        : s === "online" ? "bg-sky-500 text-white shadow-sm"
                                        : s === "late"    ? "bg-amber-500 text-white shadow-sm"
                                        :                   "bg-red-500 text-white shadow-sm"
                                      : "bg-muted text-muted-foreground hover:bg-accent"
                                  }`}
                                >
                                  {s === "present" ? "Có mặt" : s === "online" ? "Xin học online" : s === "late" ? "Đi trễ" : "Vắng"}
                                </button>
                              ))}
                              {status && (
                                <button
                                  type="button"
                                  onClick={() => clearMark(student.id)}
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

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border mt-3">
                      <p className="text-xs text-muted-foreground">
                        Đã điểm danh <span className="font-semibold text-foreground">{markedCount}</span>/{classStudents.length} học viên
                      </p>
                      <div className="flex items-center gap-2">
                        {markedCount > 0 && (
                          <Button size="sm" variant="outline" onClick={() => setMarks({})}>
                            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset buổi này
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={saveFlash ? "default" : "gradient"}
                          className={saveFlash ? "bg-emerald-600 hover:bg-emerald-600 text-white" : ""}
                          onClick={handleSave}
                          disabled={!hasChanges || saving}
                        >
                          {saveFlash
                            ? <><CheckSquare className="h-3.5 w-3.5 mr-1" /> Đã lưu!</>
                            : <><Save className="h-3.5 w-3.5 mr-1" /> {saving ? "Đang lưu…" : "Lưu"}</>}
                        </Button>
                      </div>
                    </div>
                    {saveError && <p role="alert" className="mt-2 text-xs text-red-600">{saveError}</p>}
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
                    const student = students.find(s => s.id === h.student_id);
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
