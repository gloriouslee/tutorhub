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

  // Load student comments (must run before any early return so hook order is stable)
  useEffect(() => {
    if (!cls) return;
    const ids = [...new Set([
      ...(cls.student_ids ?? []),
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
  }, [cls, extraStudentIds, approvedEnrollments]);

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
      join_date: toLocalDateKey(new Date()),
      progress: [72, 85, 61, 90, 78][idx] ?? 70,
    }));
  const classStudents = [...mockClassStudents, ...enrolledClassStudents];

  function handleSetPackage(studentId: string, pkg: StudentPackage) {
    const updated = { ...studentPackages, [studentId]: pkg };
    setStudentPackages(updated);
    saveStudentPackages(classId, updated);
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
            />
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
