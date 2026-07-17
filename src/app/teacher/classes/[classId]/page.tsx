"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PortalLayout from "@/components/layout/PortalLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LearningModeBadge } from "@/components/shared";
import {
  MOCK_CLASSES, MOCK_TEACHERS, MOCK_CLASS_MATERIALS, MOCK_LECTURES, MOCK_CLASS_NOTES, MOCK_STUDENTS,
  MOCK_ATTENDANCE, MOCK_HOMEWORK, MOCK_SUBMISSIONS
} from "@/lib/mock-data";
import {
  getStudentComments, saveStudentComment,
  getClassScheduleOverride,
  getOnlineLink, saveOnlineLink,
  getCurriculum, type CurriculumSession as CurriculumSessionData,
  getStudentPackages, saveStudentPackages, type StudentPackage,
  getClassMaterials, type StoredClassMaterial,
  kvGet, kvSet, kvUpdate,
  getClasses, removeStudentFromClass,
} from "@/lib/storage";
import { toLocalDateKey } from "@/lib/utils";
import { ClassSchedule } from "@/types";
import {
  BookOpen, Users, ArrowLeft, FileText, Plus,
  Calendar, Presentation, StickyNote,
  CalendarDays, CheckSquare, Map, Wallet,
} from "lucide-react";
import CurriculumTab from "@/components/teacher/CurriculumTab";
import TuitionTab from "@/components/teacher/TuitionTab";
import OverviewTab from "@/components/teacher/OverviewTab";
import SessionsTab from "@/components/teacher/SessionsTab";
import HomeworkTab from "@/components/teacher/HomeworkTab";
import ScheduleTab from "@/components/teacher/ScheduleTab";
import LecturesTab from "@/components/teacher/LecturesTab";
import MaterialsTab from "@/components/teacher/MaterialsTab";
import NotesTab from "@/components/teacher/NotesTab";
import StudentsTab from "@/components/teacher/StudentsTab";
import AddStudentModal from "@/components/teacher/AddStudentModal";
import HomeworkModal from "@/components/teacher/HomeworkModal";
import SessionNotesPanel from "@/components/teacher/SessionNotesPanel";
import UploadModal from "@/components/teacher/UploadModal";
import FeedbackModal from "@/components/teacher/FeedbackModal";
import {
  generateSessions,
  type Homework,
  type Submission,
  type AttendanceStatus,
  type SavedAttendanceRecord,
} from "@/components/teacher/classDetail.types";

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

  // Approved enrolled students from Supabase — only those assigned to THIS class.
  // Id dùng `enr_${e.id}` cho khớp với id mà approveEnrollment ghi vào classes.student_ids.
  const [approvedEnrollments, setApprovedEnrollments] = useState<{ id: string; full_name: string; email: string; school: string; grade: string; created_at?: string }[]>([]);
  useEffect(() => {
    import("@/lib/storage").then(({ getEnrollments }) =>
      getEnrollments().then(list => {
        setApprovedEnrollments(
          list
            .filter(e => e.status === "approved" && e.assigned_class_id === classId)
            .map(e => ({
              id: `enr_${e.id}`,
              full_name: e.full_name,
              email: e.email,
              school: e.school ?? "",
              grade: e.grade ?? "",
              created_at: e.created_at,
            }))
        );
      })
    );
  }, [classId]);

  // DB class row (Supabase) — nguồn chính cho danh sách student_ids của lớp
  const [dbStudentIds, setDbStudentIds] = useState<string[] | null>(null);
  useEffect(() => {
    getClasses()
      .then(list => {
        const row = list.find(c => c.id === classId);
        if (row) setDbStudentIds((row.student_ids as string[] | null) ?? []);
      })
      .catch(() => {});
  }, [classId]);

  // Uploaded materials (localStorage) merged with mock
  const [uploadedMaterials, setUploadedMaterials] = useState<StoredClassMaterial[]>([]);
  useEffect(() => {
    getClassMaterials(classId).then(setUploadedMaterials);
  }, [classId]);

  // Student packages per class (persisted to localStorage)
  const [studentPackages, setStudentPackages] = useState<Record<string, StudentPackage>>({});

  // Teacher-created classes (persisted in localStorage) — normalized to the mock class shape
  const [extraClass, setExtraClass] = useState<(typeof MOCK_CLASSES)[number] | null>(null);
  const [extraClassLoaded, setExtraClassLoaded] = useState(false);
  useEffect(() => {
    kvGet<any[]>("tutorhub_teacher_classes", [])
      .then(list => {
        const found = list.find(c => c.id === classId);
        if (found) {
          setExtraClass({
            id: found.id,
            class_name: found.class_name ?? "Lớp học",
            subject: found.subject ?? "",
            grade: found.grade ?? 0,
            learning_mode: found.learning_mode ?? "offline",
            classroom: found.classroom ?? "",
            description: found.description ?? "",
            max_students: found.max_students ?? 15,
            student_ids: found.student_ids ?? [],
            schedule: found.schedule ?? [],
            color: found.color ?? "#6366f1",
            tutor_id: found.tutor_id ?? "t1",
            zoom_link: found.zoom_link,
          } as unknown as (typeof MOCK_CLASSES)[number]);
        }
        setExtraClassLoaded(true);
      })
      .catch(() => setExtraClassLoaded(true));
  }, [classId]);

  const cls = MOCK_CLASSES.find(c => c.id === classId) ?? extraClass ?? undefined;

  useEffect(() => {
    if (!cls) return;
    async function load() {
      const override = await getClassScheduleOverride(classId);
      setCurrentSchedule(override ?? cls!.schedule);
      // null = chưa từng đặt → dùng zoom_link mặc định; "" = giáo viên đã xóa → không hiện link
      const stored = await getOnlineLink(classId);
      const saved = stored === null ? (cls!.zoom_link ?? "") : stored;
      setOnlineLink(saved);
      setOnlineLinkDraft(saved);
    }
    load();
  }, [classId, cls]);

  // Load session notes from localStorage
  useEffect(() => {
    kvGet<Record<string, string> | null>(`tutorhub_session_notes_${classId}`, null)
      .then(notes => { if (notes) setSessionNotes(notes); })
      .catch(() => {});
  }, [classId]);

  // Build curriculum date-index + extract curriculum homework
  useEffect(() => {
    getCurriculum(classId).then(chapters => {
      const map: Record<string, CurriculumSessionData> = {};
      const currHws: Homework[] = [];
      for (const ch of chapters) {
        for (const s of ch.sessions) {
          if (s.date) map[s.date] = s;
          for (const lesson of s.lessons) {
            if (lesson.type === "homework") {
              currHws.push({
                id: lesson.id,
                class_id: classId,
                title: lesson.title,
                description: (lesson as any).description,
                due_date: (lesson as any).due_date ?? s.date ?? new Date().toISOString().slice(0, 10),
                created_at: s.date ?? new Date().toISOString().slice(0, 10),
                source: "curriculum",
              });
            }
          }
        }
      }
      setCurriculumByDate(map);
      if (currHws.length > 0) {
        setHomeworks(prev => {
          const existingIds = new Set(prev.map(h => h.id));
          const fresh = currHws.filter(h => !existingIds.has(h.id));
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
      }
    });
  }, [classId, activeTab]);

  // Load homework from localStorage
  useEffect(() => {
    if (!cls) return;
    (async () => {
      try {
        const all = await kvGet<Homework[]>("tutorhub_teacher_homework", []);
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
        const rawSub = await kvGet<Submission[] | null>("tutorhub_submissions", null);
        setSubmissions(rawSub ?? (MOCK_SUBMISSIONS as any[]));
      } catch {
        setSubmissions(MOCK_SUBMISSIONS as any[]);
      }
    })();
  }, [classId, cls]);

  // Load attendance from localStorage
  useEffect(() => {
    kvGet<SavedAttendanceRecord[]>("tutorhub_teacher_attendance", [])
      .then(setSavedAttendanceRecords)
      .catch(() => setSavedAttendanceRecords([]));
  }, []);

  // Load extra students from localStorage
  useEffect(() => {
    kvGet<string[]>(`tutorhub_class_extra_students_${classId}`, [])
      .then(setExtraStudentIds)
      .catch(() => setExtraStudentIds([]));
  }, [classId]);

  // Load student packages from localStorage
  useEffect(() => {
    getStudentPackages(classId).then(setStudentPackages);
  }, [classId]);

  // Load student comments (must run before any early return so hook order is stable)
  useEffect(() => {
    if (!cls) return;
    const ids = [...new Set([
      ...(dbStudentIds ?? cls.student_ids ?? []),
      ...extraStudentIds,
      ...approvedEnrollments.map(e => e.id),
    ])];
    async function loadComments() {
      const loaded: Record<string, any[]> = {};
      for (const id of ids) {
        loaded[id] = await getStudentComments(id);
      }
      setComments(loaded);
    }
    loadComments();
  }, [cls, dbStudentIds, extraStudentIds, approvedEnrollments]);

  async function handleSaveOnlineLink() {
    await saveOnlineLink(classId, onlineLinkDraft);
    setOnlineLink(onlineLinkDraft);
    setLinkSaved(true);
    setTimeout(() => setLinkSaved(false), 3000);
  }

  async function persistHomeworks(updated: Homework[]) {
    try {
      const all = await kvGet<Homework[]>("tutorhub_teacher_homework", []);
      const others = all.filter(h => h.class_id !== classId);
      await kvSet("tutorhub_teacher_homework", [...others, ...updated]);
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
        {!extraClassLoaded ? (
          <div className="py-20 text-center text-sm text-muted-foreground">Đang tải lớp học…</div>
        ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold">Không tìm thấy lớp học</h2>
          <Link href="/teacher/classes"><Button variant="outline" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" />Quay lại</Button></Link>
        </div>
        )}
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

  // Students enrolled in this class — DB class row is the source of truth for
  // student_ids (falls back to mock when offline), plus extras added by teacher.
  const allEnrolledIds = [...new Set([...(dbStudentIds ?? cls.student_ids ?? []), ...extraStudentIds])];
  // Progress from real data: distinct homework submissions / homework count (null → hiển thị "—")
  const progressFor = (studentId: string): number | null => {
    if (homeworks.length === 0) return null;
    const hwIds = new Set(homeworks.map(h => h.id));
    const done = new Set(
      submissions.filter(sub => sub.student_id === studentId && hwIds.has(sub.homework_id)).map(sub => sub.homework_id)
    ).size;
    return Math.round((done / homeworks.length) * 100);
  };
  const mockClassStudents = MOCK_STUDENTS.filter(s => allEnrolledIds.includes(s.id)).map(s => ({
    ...s,
    package: (studentPackages[s.id] ?? "online") as StudentPackage,
    join_date: toLocalDateKey(new Date()),
    progress: progressFor(s.id),
  }));
  const enrolledClassStudents = approvedEnrollments
    .filter(e => allEnrolledIds.includes(e.id))
    .map(e => ({
      id: e.id, user_id: e.id, full_name: e.full_name, email: e.email,
      dob: "", school: e.school, grade: e.grade, learning_type: "online" as const,
      parent_id: undefined, avatar_url: undefined, created_at: e.created_at ?? "",
      package: (studentPackages[e.id] ?? "online") as StudentPackage,
      join_date: e.created_at ? e.created_at.slice(0, 10) : toLocalDateKey(new Date()),
      progress: progressFor(e.id),
    }));
  const classStudents = [...mockClassStudents, ...enrolledClassStudents];

  async function handleRemoveStudent(student: { id: string; full_name: string }) {
    if (!window.confirm(`Xóa ${student.full_name} khỏi lớp?`)) return;
    await kvUpdate<string[]>(`tutorhub_class_extra_students_${classId}`, [], ids => ids.filter(id => id !== student.id));
    setExtraStudentIds(prev => prev.filter(id => id !== student.id));
    await removeStudentFromClass(classId, student.id);
    setDbStudentIds(prev => (prev ? prev.filter(id => id !== student.id) : prev));
  }

  async function handleSetPackage(studentId: string, pkg: StudentPackage) {
    const updated = { ...studentPackages, [studentId]: pkg };
    setStudentPackages(updated);
    await saveStudentPackages(classId, updated);
  }

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
            <OverviewTab
              description={cls.description}
              scheduleForDisplay={scheduleForDisplay}
              lectures={lectures}
              materials={materials}
              notes={notes}
              classStudentsCount={classStudents.length}
              maxStudents={cls.max_students}
              onlineLink={onlineLink}
              onEditSchedule={() => setActiveTab("schedule")}
              onQuickAdd={type => {
                setActiveTab(type === "lecture" ? "lectures" : type === "material" ? "materials" : "notes");
                setUploadModal(type);
              }}
              onSetupOnlineLink={() => setActiveTab("schedule")}
            />
          )}

          {/* ── Curriculum ── */}
          {activeTab === "curriculum" && (
            <CurriculumTab classId={classId} schedule={scheduleForDisplay} />
          )}

          {/* ── Sessions ── */}
          {activeTab === "sessions" && (
            <SessionsTab
              classId={classId}
              upcomingSessions={upcomingSessions}
              pastSessions={pastSessions}
              showPastSessions={showPastSessions}
              setShowPastSessions={setShowPastSessions}
              curriculumByDate={curriculumByDate}
              sessionNotes={sessionNotes}
              classStudents={classStudents}
              savedAttendanceRecords={savedAttendanceRecords}
              setSavedAttendanceRecords={setSavedAttendanceRecords}
              openAttendanceDate={openAttendanceDate}
              setOpenAttendanceDate={setOpenAttendanceDate}
              setHomeworkModalForSession={setHomeworkModalForSession}
              setSessionNotesPanel={setSessionNotesPanel}
              getAttendanceStatsForDate={getAttendanceStatsForDate}
            />
          )}

          {/* ── Homework ── */}
          {activeTab === "homework" && (
            <HomeworkTab
              homeworks={homeworks}
              submissions={submissions}
              students={classStudents}
              onNewHomework={() => setHomeworkModal({ open: true })}
              onEditHomework={hw => setHomeworkModal({ open: true, editing: hw })}
              onDeleteHomework={handleDeleteHomework}
            />
          )}

          {/* ── Schedule ── */}
          {activeTab === "schedule" && currentSchedule !== null && (
            <ScheduleTab
              classId={classId}
              className={cls.class_name}
              currentSchedule={currentSchedule}
              onlineLink={onlineLink}
              setOnlineLink={setOnlineLink}
              onlineLinkDraft={onlineLinkDraft}
              setOnlineLinkDraft={setOnlineLinkDraft}
              linkSaved={linkSaved}
              setLinkSaved={setLinkSaved}
              onSaveOnlineLink={handleSaveOnlineLink}
              onSaved={newSchedule => setCurrentSchedule(newSchedule)}
            />
          )}

          {/* ── Lectures ── */}
          {activeTab === "lectures" && (
            <LecturesTab lectures={lectures} addButton={addButton("lecture", "Thêm bài giảng")} />
          )}

          {/* ── Materials ── */}
          {activeTab === "materials" && (
            <MaterialsTab
              classId={classId}
              materials={materials}
              addButton={addButton("material", "Tải lên tài liệu")}
              setUploadedMaterials={setUploadedMaterials}
            />
          )}

          {/* ── Notes ── */}
          {activeTab === "notes" && (
            <NotesTab notes={notes} addButton={addButton("note", "Viết ghi chú")} />
          )}

          {/* ── Students ── */}
          {activeTab === "students" && (
            <StudentsTab
              classStudents={classStudents}
              studentSearch={studentSearch}
              setStudentSearch={setStudentSearch}
              comments={comments}
              onAddStudent={() => setAddStudentModal(true)}
              onSetPackage={handleSetPackage}
              onOpenComment={setCommentModalStudent}
              onRemoveStudent={handleRemoveStudent}
            />
          )}

          {activeTab === "tuition" && (
            <TuitionTab classId={classId} className={cls.class_name} students={classStudents} />
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
          defaultDueDate={homeworkModalForSession ?? undefined}
          students={classStudents}
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
            kvGet<Record<string, string> | null>(`tutorhub_session_notes_${classId}`, null)
              .then(notes => { if (notes) setSessionNotes(notes); })
              .catch(() => {});
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
