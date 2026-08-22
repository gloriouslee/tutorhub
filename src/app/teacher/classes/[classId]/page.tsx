"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import PortalLayout from "@/components/layout/PortalLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LearningModeBadge } from "@/components/shared";
import {
  getStudentCommentsMany, saveStudentComment,
  saveOnlineLink,
  getCurriculum, type CurriculumSession as CurriculumSessionData,
  getStudentPackages, saveStudentPackages, type StudentPackage,
  getClassMaterials, type StoredClassMaterial,
  kvGet,
  getStudents, removeStudentFromClass,
  getTeacherHomework, upsertTeacherHomework, removeTeacherHomework,
  getAllTeacherAttendance,
} from "@/lib/storage";
import { emptyTeacherSubmissionSnapshot, getTeacherSubmissionSnapshot } from "@/lib/teacher-submissions";
import { useWindowFocusRevision } from "@/hooks/useWindowFocusRevision";
import { toLocalDateKey } from "@/lib/utils";
import { ClassSchedule, type Student } from "@/types";
import { useTeacherContext } from "@/hooks/useTeacherContext";
import { resetAccountContextCache } from "@/hooks/useAccountContext";
import {
  resolveTeacherClassWorkspace,
  type CurriculumContentFilter,
  type TeacherResourceView,
} from "@/lib/class-workspace-tabs";
import {
  BookOpen, Users, ArrowLeft, FileText, Plus,
  Calendar, Presentation, StickyNote,
  CalendarDays, CheckSquare, Map, Wallet, Trophy,
} from "lucide-react";
import OverviewTab from "@/components/teacher/OverviewTab";
import {
  generateSessions,
  type Homework,
  type Submission,
  type SavedAttendanceRecord,
} from "@/components/teacher/classDetail.types";

function PanelFallback({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3 p-6" aria-label={label}>
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <div className="h-6 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="h-28 animate-pulse rounded-2xl bg-muted/70" />
      <div className="h-28 animate-pulse rounded-2xl bg-muted/50" />
    </div>
  );
}

function DeferredPanelFallback() {
  return <PanelFallback label="Đang tải nội dung…" />;
}

function HomeworkPanelFallback() {
  return <PanelFallback label="Đang tải bài tập…" />;
}

const CurriculumTab = dynamic(() => import("@/components/teacher/CurriculumTab"), {
  loading: DeferredPanelFallback,
});
const TuitionTab = dynamic(() => import("@/components/teacher/TuitionTab"), {
  loading: DeferredPanelFallback,
});
const SessionsTab = dynamic(() => import("@/components/teacher/SessionsTab"), {
  loading: DeferredPanelFallback,
});
const HomeworkTab = dynamic(() => import("@/components/teacher/HomeworkTab"), {
  loading: DeferredPanelFallback,
});
const ScheduleTab = dynamic(() => import("@/components/teacher/ScheduleTab"), {
  loading: DeferredPanelFallback,
});
const LecturesTab = dynamic(() => import("@/components/teacher/LecturesTab"), {
  loading: DeferredPanelFallback,
});
const MaterialsTab = dynamic(() => import("@/components/teacher/MaterialsTab"), {
  loading: DeferredPanelFallback,
});
const NotesTab = dynamic(() => import("@/components/teacher/NotesTab"), {
  loading: DeferredPanelFallback,
});
const StudentsTab = dynamic(() => import("@/components/teacher/StudentsTab"), {
  loading: DeferredPanelFallback,
});
const LeaderboardTab = dynamic(() => import("@/components/teacher/LeaderboardTab"), {
  loading: DeferredPanelFallback,
});
const HomeworkModal = dynamic(() => import("@/components/teacher/HomeworkModal"));
const SessionNotesPanel = dynamic(() => import("@/components/teacher/SessionNotesPanel"));
const UploadModal = dynamic(() => import("@/components/teacher/UploadModal"));
const FeedbackModal = dynamic(() => import("@/components/teacher/FeedbackModal"));

type TabKey = "overview" | "curriculum" | "sessions" | "homework" | "resources" | "schedule" | "lectures" | "materials" | "notes" | "students" | "leaderboard" | "tuition";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "overview",    label: "Tổng quan",  icon: BookOpen },
  { key: "curriculum",  label: "Lộ trình & nội dung", icon: Map },
  { key: "homework",    label: "Bài tập & chấm", icon: CheckSquare },
  { key: "sessions",    label: "Vận hành buổi học", icon: CalendarDays },
  { key: "resources",   label: "Tài nguyên", icon: FileText },
  { key: "students",    label: "Học viên",   icon: Users },
  { key: "leaderboard", label: "Bảng xếp hạng", icon: Trophy },
  { key: "tuition",    label: "Học phí",    icon: Wallet },
];

export default function TeacherClassDetailPage() {
  const params = useParams();
  const classId = params.classId as string;
  const router = useRouter();
  const { teacherName, myClasses, ready } = useTeacherContext();
  const submissionRefreshRevision = useWindowFocusRevision();

  // Tab hiện tại đồng bộ với URL (?tab=) để nút back của trình duyệt khôi phục đúng tab.
  // Đọc từ URL khi mount + khi back/forward (popstate); mặc định "overview" để khớp SSR.
  const [activeTab, setActiveTabState] = useState<TabKey>("overview");
  const [curriculumContentFilter, setCurriculumContentFilter] = useState<CurriculumContentFilter>("all");
  const [resourceView, setResourceView] = useState<TeacherResourceView>("materials");
  const [operationsView, setOperationsView] = useState<"sessions" | "schedule">("sessions");
  useEffect(() => {
    const sync = () => {
      const sp = new URLSearchParams(window.location.search);
      const resolved = resolveTeacherClassWorkspace(sp.get("tab"), sp.get("content"));
      setActiveTabState(resolved.tab);
      setCurriculumContentFilter(resolved.content);
      setResourceView(resolved.resource);
      setOperationsView(resolved.operations);

      const rawTab = sp.get("tab");
      if (rawTab && rawTab !== resolved.tab) {
        sp.set("tab", resolved.tab);
        if (resolved.tab === "curriculum" && resolved.content !== "all") sp.set("content", resolved.content);
        else if (resolved.tab === "sessions" && resolved.operations === "schedule") sp.set("content", "schedule");
        else if (resolved.tab === "resources") sp.set("content", resolved.resource);
        else sp.delete("content");
        window.history.replaceState(null, "", `?${sp.toString()}`);
      }
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const setActiveTab = (key: TabKey) => {
    const resolved = resolveTeacherClassWorkspace(key);
    setActiveTabState(resolved.tab);
    setCurriculumContentFilter(resolved.content);
    setResourceView(resolved.resource);
    setOperationsView(resolved.operations);
    const sp = new URLSearchParams(window.location.search);
    sp.set("tab", resolved.tab);
    if (resolved.tab === "curriculum" && resolved.content !== "all") sp.set("content", resolved.content);
    else if (resolved.tab === "sessions" && resolved.operations === "schedule") sp.set("content", "schedule");
    else if (resolved.tab === "resources") sp.set("content", resolved.resource);
    else sp.delete("content");
    router.replace(`?${sp.toString()}`, { scroll: false });
  };
  const setSessionWorkspaceView = (view: "sessions" | "schedule") => {
    setActiveTabState("sessions");
    setOperationsView(view);
    const sp = new URLSearchParams(window.location.search);
    sp.set("tab", "sessions");
    if (view === "schedule") sp.set("content", "schedule"); else sp.delete("content");
    router.replace(`?${sp.toString()}`, { scroll: false });
  };
  const setResourceWorkspaceView = (view: TeacherResourceView) => {
    setActiveTabState("resources");
    setResourceView(view);
    const sp = new URLSearchParams(window.location.search);
    sp.set("tab", "resources");
    sp.set("content", view);
    router.replace(`?${sp.toString()}`, { scroll: false });
  };
  // "Xem & chấm" ở tab Bài tập → chuyển sang tab Lộ trình và mở trình chấm đúng bài
  const [gradeLessonId, setGradeLessonId] = useState<string | null>(null);
  const gradeExamInCurriculum = (lessonId: string) => {
    setGradeLessonId(lessonId);
    setActiveTabState("curriculum");
    setCurriculumContentFilter("all");
    const sp = new URLSearchParams(window.location.search);
    sp.set("tab", "curriculum");
    router.replace(`?${sp.toString()}`, { scroll: false });
  };
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
  const [curriculumHomeworkLoaded, setCurriculumHomeworkLoaded] = useState(false);
  const [persistedHomeworkLoaded, setPersistedHomeworkLoaded] = useState(false);

  // Attendance state
  const [openAttendanceDate, setOpenAttendanceDate] = useState<string | null>(null);
  const [savedAttendanceRecords, setSavedAttendanceRecords] = useState<SavedAttendanceRecord[]>([]);

  // Curriculum state — a flat map of date → CurriculumSession for quick lookup
  const [curriculumByDate, setCurriculumByDate] = useState<Record<string, CurriculumSessionData>>({});

  // Extra students added by teacher (persisted to localStorage)
  const [extraStudentIds, setExtraStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [students, setStudents] = useState<Student[]>([]);

  // DB class row (Supabase) — nguồn chính cho danh sách student_ids của lớp
  const [dbStudentIds, setDbStudentIds] = useState<string[] | null>(null);
  const cls = myClasses.find(c => c.id === classId);
  useEffect(() => {
    setDbStudentIds((cls?.student_ids as string[] | null | undefined) ?? null);
  }, [cls?.student_ids]);

  useEffect(() => {
    getStudents()
      .then(setStudents)
      .catch(() => setStudents([]));
  }, []);

  // Materials uploaded by the teacher.
  const [uploadedMaterials, setUploadedMaterials] = useState<StoredClassMaterial[]>([]);
  useEffect(() => {
    getClassMaterials(classId).then(setUploadedMaterials);
  }, [classId]);

  // Vẫn lập chỉ mục nội dung lộ trình cho các luồng liên quan; thư viện chỉ hiển thị
  // tài nguyên độc lập để tránh trùng với nội dung đã nằm trong Lộ trình.
  const [, setCurrMaterials] = useState<StoredClassMaterial[]>([]);
  const [, setCurrLectures] = useState<StoredClassMaterial[]>([]);

  // Student packages per class (persisted to localStorage)
  const [studentPackages, setStudentPackages] = useState<Record<string, StudentPackage>>({});

  useEffect(() => {
    if (!cls) return;
    setCurrentSchedule(cls.schedule);
    setOnlineLink(cls.zoom_link ?? "");
    setOnlineLinkDraft(cls.zoom_link ?? "");
  }, [classId, cls]);

  // Load session notes from localStorage
  useEffect(() => {
    kvGet<Record<string, string> | null>(`tutorhub_session_notes_${classId}`, null)
      .then(notes => { if (notes) setSessionNotes(notes); })
      .catch(() => {});
  }, [classId]);

  // Build curriculum date-index + extract curriculum bài tập (nộp file + làm câu hỏi)
  useEffect(() => {
    setCurriculumHomeworkLoaded(false);
    (async () => {
      const chapters = await getCurriculum(classId);
      const today = new Date().toISOString().slice(0, 10);
      const map: Record<string, CurriculumSessionData> = {};
      const fileHws: Homework[] = [];
      const examLessons: { id: string; title: string; description?: string; date?: string; assigned_to?: string[] | null; exam_status?: "draft" | "open" | "closed"; opens_at?: string; chapter_id: string; chapter_title: string; chapter_order: number; session_id: string; session_title: string; session_order: number }[] = [];
      const currMats: StoredClassMaterial[] = [];
      const currLecs: StoredClassMaterial[] = [];
      for (const ch of chapters) {
        for (const s of ch.sessions) {
          if (s.date) map[s.date] = s;
          for (const lesson of s.lessons) {
            if (lesson.type === "homework") {
              fileHws.push({
                id: lesson.id,
                class_id: classId,
                title: lesson.title,
                description: lesson.description,
                due_date: lesson.due_date ?? s.date ?? today,
                created_at: s.date ?? today,
                assigned_to: lesson.assigned_to ?? null,
                source: "curriculum",
                chapter_id: ch.id, chapter_title: ch.title, chapter_order: chapters.indexOf(ch),
                session_id: s.id, session_title: s.title, session_order: ch.sessions.indexOf(s),
                kind: "file",
                file_url: lesson.file_url,
              });
            } else if (lesson.type === "exam") {
              examLessons.push({
                id: lesson.id, title: lesson.title, description: lesson.description,
                date: s.date, assigned_to: lesson.assigned_to ?? null,
                exam_status: lesson.exam_status ?? "draft", opens_at: lesson.exam_opens_at,
                chapter_id: ch.id, chapter_title: ch.title, chapter_order: chapters.indexOf(ch),
                session_id: s.id, session_title: s.title, session_order: ch.sessions.indexOf(s),
              });
            } else if (lesson.type === "material") {
              const u = (lesson.file_url ?? "").toLowerCase();
              currMats.push({
                id: lesson.id,
                class_id: classId,
                title: lesson.title,
                description: lesson.description ?? "",
                file_url: lesson.file_url ?? "",
                file_type: u.includes(".pdf") ? "pdf" : /\.(png|jpe?g|gif|webp|svg)/.test(u) ? "image" : "file",
                file_size: "",
                category: "material",
                uploaded_by: "",
                created_at: s.date ?? today,
                download_count: 0,
                kind: "material",
              });
            } else if (lesson.type === "lecture" || lesson.type === "solution") {
              currLecs.push({
                id: lesson.id,
                class_id: classId,
                title: lesson.title,
                description: lesson.description ?? "",
                file_url: lesson.video_url ?? "",
                file_type: "video",
                file_size: "",
                category: "lecture",
                uploaded_by: "",
                created_at: s.date ?? today,
                download_count: 0,
                kind: "lecture",
              });
            }
          }
        }
      }
      // Một nguồn server-scoped cho cả bài thi trên hệ thống và bài nộp file.
      const submissionSnapshot = await getTeacherSubmissionSnapshot(classId)
        .catch(emptyTeacherSubmissionSnapshot);
      const examHws: Homework[] = examLessons.map(ex => {
        const results = submissionSnapshot.examResults[ex.id] ?? [];
        const exam_results: Record<string, { score: number; total: number; submitted_at?: string; duration_seconds?: number; attempt?: number }> = {};
        for (const r of results) {
          const manual = Object.values(r.manual_scores ?? {}).reduce((a, b) => a + b, 0);
          exam_results[r.student_id] = {
            score: Math.round((r.score + manual) * 100) / 100,
            total: r.total,
            submitted_at: r.submitted_at,
            duration_seconds: r.duration_seconds,
            attempt: r.attempt,
          };
        }
        return {
          id: ex.id, class_id: classId, title: ex.title, description: ex.description,
          due_date: ex.opens_at?.slice(0, 10) ?? ex.date ?? today,
          created_at: ex.date ?? today,
          assigned_to: ex.assigned_to ?? null,
          source: "curriculum" as const,
          chapter_id: ex.chapter_id, chapter_title: ex.chapter_title, chapter_order: ex.chapter_order,
          session_id: ex.session_id, session_title: ex.session_title, session_order: ex.session_order,
          kind: "exam" as const,
          exam_status: ex.exam_status,
          exam_results,
        };
      });
      setSubmissions(submissionSnapshot.fileSubmissions);
      setCurriculumByDate(map);
      setCurrMaterials(currMats);
      setCurrLectures(currLecs);
      const currHws = [...fileHws, ...examHws];
      if (currHws.length > 0) {
        setHomeworks(prev => {
          // Cập nhật lại các bài lộ trình (kết quả bài thi có thể đổi) + thêm bài mới
          const currIds = new Set(currHws.map(h => h.id));
          const kept = prev.filter(h => !currIds.has(h.id));
          return [...kept, ...currHws];
        });
      }
    })()
      .catch(() => undefined)
      .finally(() => setCurriculumHomeworkLoaded(true));
  }, [classId, activeTab, submissionRefreshRevision]);

  // Load persisted homework and submissions.
  useEffect(() => {
    if (!cls) return;
    setPersistedHomeworkLoaded(false);
    Promise.all([
      getTeacherHomework<Homework>([classId]).catch(() => []),
      getTeacherSubmissionSnapshot(classId).catch(emptyTeacherSubmissionSnapshot),
    ])
      .then(([all, snapshot]) => {
        const base = all.filter(h => h.class_id === classId && h.source !== "curriculum");
        // Giữ lại các bài tập từ lộ trình mà effect curriculum đã nạp vào state,
        // tránh race giữa hai effect ghi đè lẫn nhau (mất bài tập lộ trình khi mới load).
        setHomeworks(prev => {
          const curr = prev.filter(h => h.source === "curriculum");
          const currIds = new Set(curr.map(h => h.id));
          return [...base.filter(h => !currIds.has(h.id)), ...curr];
        });
        setSubmissions(snapshot.fileSubmissions);
      })
      .finally(() => setPersistedHomeworkLoaded(true));
  }, [classId, cls, submissionRefreshRevision]);

  // Load attendance from localStorage
  useEffect(() => {
    getAllTeacherAttendance({ classIds: [classId] })
      .then(recs => setSavedAttendanceRecords(recs as SavedAttendanceRecord[]))
      .catch(() => setSavedAttendanceRecords([]));
  }, [classId]);

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
    ])];
    async function loadComments() {
      setComments(await getStudentCommentsMany(ids));
    }
    loadComments();
  }, [cls, dbStudentIds, extraStudentIds]);

  async function handleSaveOnlineLink() {
    await saveOnlineLink(classId, onlineLinkDraft);
    setOnlineLink(onlineLinkDraft);
    setLinkSaved(true);
    setTimeout(() => setLinkSaved(false), 3000);
  }

  async function persistHomeworks(updated: Homework[]) {
    try {
      // Lưu theo từng row: chỉ ghi/xóa bài tập của LỚP này, nguồn thủ công.
      // Không đụng bài tập nguồn từ lộ trình (source:"curriculum") — chúng sống
      // trong tutorhub_curriculum_*, ghi vào đây sẽ tạo bản sao "đông cứng".
      const prevManual = homeworks.filter(h => h.class_id === classId && h.source !== "curriculum");
      const nextManual = updated.filter(h => h.class_id === classId && h.source !== "curriculum");
      const nextIds = new Set(nextManual.map(h => h.id));
      // Bài bị bỏ khỏi danh sách so với lần trước → xóa từng row.
      await Promise.all([
        ...prevManual.filter(h => !nextIds.has(h.id)).map(h => removeTeacherHomework(h.id)),
        ...nextManual.map(h => upsertTeacherHomework(h)),
      ]);
      setHomeworks(updated);
    } catch {
      alert("Không thể lưu bài tập. Dữ liệu cũ vẫn được giữ nguyên.");
    }
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
      <PortalLayout role="teacher" userName={teacherName || "Giáo viên"} pageTitle="Lớp học">
        {!ready ? (
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

  const notes = Object.entries(sessionNotes)
    .filter(([, content]) => content.trim().length > 0)
    .map(([date, content]) => ({
      id: `session-note-${date}`,
      title: `Ghi chú buổi học ${date}`,
      content,
      is_pinned: false,
      created_at: date,
    }));

  // The class row and approved enrollments are the sources of truth for membership.
  const allEnrolledIds = [...new Set([
    ...(dbStudentIds ?? cls.student_ids ?? []),
    ...extraStudentIds,
  ])];
  // Progress from real data: distinct homework submissions / homework count (null → hiển thị "—")
  const progressFor = (studentId: string): number | null => {
    if (homeworks.length === 0) return null;
    const hwIds = new Set(homeworks.map(h => h.id));
    const done = new Set(
      submissions.filter(sub => sub.student_id === studentId && hwIds.has(sub.homework_id)).map(sub => sub.homework_id)
    ).size;
    return Math.round((done / homeworks.length) * 100);
  };
  const storedClassStudents = students.filter(s => allEnrolledIds.includes(s.id)).map(s => ({
    ...s,
    package: (studentPackages[s.id] ?? "online") as StudentPackage,
    join_date: s.created_at?.slice(0, 10) || toLocalDateKey(new Date()),
    progress: progressFor(s.id),
  }));
  const classStudents = storedClassStudents;

  async function handleRemoveStudent(student: { id: string; full_name: string }) {
    if (!window.confirm(
      `Xóa ${student.full_name} khỏi lớp? Học viên vẫn có thể đăng ký lại sau này.`,
    )) return;
    try {
      await removeStudentFromClass(classId, student.id);
      setExtraStudentIds(prev => prev.filter(id => id !== student.id));
      setDbStudentIds(prev => (prev ? prev.filter(id => id !== student.id) : prev));
      setStudentPackages((current) => {
        const next = { ...current };
        delete next[student.id];
        return next;
      });
      resetAccountContextCache();
    } catch {
      window.alert("Không thể xóa học viên khỏi lớp. Vui lòng thử lại.");
    }
  }

  async function handleSetPackage(studentId: string, pkg: StudentPackage) {
    const updated = { ...studentPackages, [studentId]: pkg };
    setStudentPackages(updated);
    await saveStudentPackages(classId, updated);
  }

  async function handleRegistrationApproved(
    studentId: string,
    pkg: StudentPackage,
  ) {
    setStudentPackages((current) => ({ ...current, [studentId]: pkg }));
    // The initial teacher-scoped read cannot include a pending student. Once the
    // approval commits, load again so the newly authorized profile is rendered.
    setStudents(await getStudents());
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
  const nextSession = upcomingSessions[0] ?? null;
  const pendingGradingCount = submissions.filter(submission => submission.score == null).length;

  // Dedupe persisted records by date and student.
  const dedupedHistory: SavedAttendanceRecord[] = [];
  const seen = new Set<string>();
  for (const rec of savedAttendanceRecords.filter(r => r.class_id === classId)) {
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
      online: records.filter(r => r.status === "online").length,
      late: records.filter(r => r.status === "late").length,
      absent: records.filter(r => r.status === "absent").length,
    };
  }

  return (
    <PortalLayout role="teacher" userName={teacherName || "Giáo viên"} pageTitle={cls.class_name}>
      <div className="mx-auto max-w-[1440px] space-y-4">
        <Link href="/teacher/classes" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Quay lại danh sách lớp
        </Link>

        {/* Header */}
        <div className="rounded-2xl overflow-hidden border border-border/50 shadow-sm">
          <div className="relative p-4 text-white md:p-5" style={{ background: `linear-gradient(135deg, ${cls.color} 0%, #000 250%)` }}>
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/20 shadow-md backdrop-blur-md">
                <BookOpen className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <LearningModeBadge mode={cls.learning_mode} />
                  <Badge className="bg-amber-500/80 text-white border-0 text-[10px]">Giáo viên</Badge>
                </div>
                <h1 className="text-2xl font-bold leading-tight">{cls.class_name}</h1>
                <p className="mt-0.5 text-sm font-medium text-white/70">{cls.subject}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <div className="min-w-[76px] rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-center backdrop-blur">
                  <p className="text-xl font-bold leading-tight">{classStudents.length}</p>
                  <p className="text-[11px] text-white/60">Học viên</p>
                </div>
                <div className="min-w-[76px] rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-center backdrop-blur">
                  <p className="text-xl font-bold leading-tight">{pendingGradingCount}</p>
                  <p className="text-[11px] text-white/60">Chờ chấm</p>
                </div>
                <div className="min-w-[76px] rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-center backdrop-blur">
                  <p className="text-base font-bold leading-tight">{nextSession ? nextSession.date.slice(5).split("-").reverse().join("/") : "—"}</p>
                  <p className="text-[11px] text-white/60">Buổi tới</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 overflow-x-auto border-b border-border bg-card px-2 md:px-3">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-xs font-semibold transition-all ${activeTab === tab.key ? "border-primary bg-primary/5 text-primary" : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"}`}>
                <tab.icon className="h-3.5 w-3.5" />{tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="animate-fade-in">

          {/* ── Overview ── */}
          {activeTab === "overview" && (
            <OverviewTab
              description={cls.description ?? ""}
              scheduleForDisplay={scheduleForDisplay}
              homeworks={homeworks}
              submissions={submissions}
              attendanceRecords={savedAttendanceRecords}
              classStudentsCount={classStudents.length}
              maxStudents={cls.max_students ?? 0}
              onlineLink={onlineLink}
              nextSession={nextSession}
              nextSessionContent={nextSession ? curriculumByDate[nextSession.date] : undefined}
              onEditSchedule={() => setSessionWorkspaceView("schedule")}
              onQuickAdd={type => {
                setResourceWorkspaceView(type === "lecture" ? "lectures" : type === "material" ? "materials" : "notes");
                setUploadModal(type);
              }}
              onSetupOnlineLink={() => setSessionWorkspaceView("schedule")}
              onOpenCurriculum={() => setActiveTab("curriculum")}
              onOpenHomework={() => setActiveTab("homework")}
              onCreateHomework={() => setHomeworkModal({ open: true })}
              onOpenSessions={() => setActiveTab("sessions")}
              onOpenStudents={() => setActiveTab("students")}
            />
          )}

          {/* ── Curriculum ── */}
          {activeTab === "curriculum" && (
            <CurriculumTab
              key={`curriculum:${curriculumContentFilter}`}
              classId={classId}
              schedule={scheduleForDisplay}
              students={classStudents}
              gradeLessonId={gradeLessonId}
              onGradingOpened={() => setGradeLessonId(null)}
              initialTypeFilter={curriculumContentFilter}
            />
          )}

          {/* ── Vận hành buổi học: buổi học, chuyên cần, lịch và liên kết ── */}
          {activeTab === "sessions" && (
            <div className="space-y-4">
              <div className="flex w-fit rounded-xl border border-border bg-card p-1 shadow-sm" aria-label="Khu vực vận hành lớp học">
                <button type="button" onClick={() => setSessionWorkspaceView("sessions")} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${operationsView === "sessions" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>
                  <CalendarDays className="h-3.5 w-3.5" /> Buổi học & chuyên cần
                </button>
                <button type="button" onClick={() => setSessionWorkspaceView("schedule")} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${operationsView === "schedule" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>
                  <Calendar className="h-3.5 w-3.5" /> Lịch & liên kết học
                </button>
              </div>

              {operationsView === "sessions" ? (
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
              ) : currentSchedule === null ? (
                <DeferredPanelFallback />
              ) : (
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
            </div>
          )}

          {/* ── Homework ── */}
          {activeTab === "homework" && (
            homeworks.length === 0 && (!curriculumHomeworkLoaded || !persistedHomeworkLoaded) ? (
              <HomeworkPanelFallback />
            ) : (
              <HomeworkTab
                classId={classId}
                homeworks={homeworks}
                submissions={submissions}
                students={classStudents}
                onNewHomework={() => setHomeworkModal({ open: true })}
                onEditHomework={hw => setHomeworkModal({ open: true, editing: hw })}
                onDeleteHomework={handleDeleteHomework}
                onGradeExam={gradeExamInCurriculum}
                assignmentsRefreshing={!curriculumHomeworkLoaded || !persistedHomeworkLoaded}
                submissionsLoading={!persistedHomeworkLoaded}
                onSubmissionGraded={(submissionId, patch) => {
                  setSubmissions(current => current.map(submission => (
                    submission.id === submissionId ? { ...submission, ...patch } : submission
                  )));
                }}
              />
            )
          )}

          {/* ── Tài nguyên độc lập, tách khỏi nội dung đã xếp trong lộ trình ── */}
          {activeTab === "resources" && (
            <div className="space-y-4">
              <div className="flex w-fit rounded-xl border border-border bg-card p-1 shadow-sm" aria-label="Loại tài nguyên">
                <button type="button" onClick={() => setResourceWorkspaceView("lectures")} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${resourceView === "lectures" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>
                  <Presentation className="h-3.5 w-3.5" /> Bài giảng
                </button>
                <button type="button" onClick={() => setResourceWorkspaceView("materials")} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${resourceView === "materials" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>
                  <FileText className="h-3.5 w-3.5" /> Tài liệu
                </button>
                <button type="button" onClick={() => setResourceWorkspaceView("notes")} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${resourceView === "notes" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>
                  <StickyNote className="h-3.5 w-3.5" /> Ghi chú
                </button>
              </div>

              {resourceView === "lectures" && (
                <LecturesTab classId={classId} lectures={[]} materials={uploadedMaterials} addButton={addButton("lecture", "Thêm bài giảng")} setUploadedMaterials={setUploadedMaterials} />
              )}
              {resourceView === "materials" && (
                <MaterialsTab classId={classId} materials={uploadedMaterials} addButton={addButton("material", "Tải lên tài liệu")} setUploadedMaterials={setUploadedMaterials} />
              )}
              {resourceView === "notes" && (
                <NotesTab classId={classId} notes={notes} materials={uploadedMaterials} addButton={addButton("note", "Viết ghi chú")} setUploadedMaterials={setUploadedMaterials} />
              )}
            </div>
          )}

          {/* ── Students ── */}
          {activeTab === "students" && (
            <StudentsTab
              classId={classId}
              teacherClasses={myClasses}
              classStudents={classStudents}
              studentSearch={studentSearch}
              setStudentSearch={setStudentSearch}
              comments={comments}
              onRosterChanged={setDbStudentIds}
              onRegistrationApproved={handleRegistrationApproved}
              onSetPackage={handleSetPackage}
              onOpenComment={setCommentModalStudent}
              onRemoveStudent={handleRemoveStudent}
            />
          )}

          {activeTab === "leaderboard" && (
            <LeaderboardTab classId={classId} />
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
    </PortalLayout>
  );
}
