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
  getStudentComments, saveStudentComment,
  getClassScheduleOverride,
  getOnlineLink, saveOnlineLink,
  getCurriculum, type CurriculumSession as CurriculumSessionData,
  getAllExamResults,
  getStudentPackages, saveStudentPackages, type StudentPackage,
  getClassMaterials, type StoredClassMaterial,
  kvGet, kvUpdate,
  getClasses, getStudents, removeStudentFromClass,
  getTeacherHomework, upsertTeacherHomework, removeTeacherHomework,
  getAllTeacherAttendance, getHwSubmissions,
} from "@/lib/storage";
import { toLocalDateKey } from "@/lib/utils";
import { ClassSchedule, type Student } from "@/types";
import { useTeacherContext } from "@/hooks/useTeacherContext";
import {
  BookOpen, Users, ArrowLeft, FileText, Plus,
  Calendar, Presentation, StickyNote,
  CalendarDays, CheckSquare, Map, Wallet,
} from "lucide-react";
import OverviewTab from "@/components/teacher/OverviewTab";
import {
  generateSessions,
  type Homework,
  type Submission,
  type SavedAttendanceRecord,
} from "@/components/teacher/classDetail.types";

function DeferredPanelFallback() {
  return (
    <div className="space-y-3 p-6" aria-label="Đang tải nội dung">
      <div className="h-6 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="h-28 animate-pulse rounded-2xl bg-muted/70" />
      <div className="h-28 animate-pulse rounded-2xl bg-muted/50" />
    </div>
  );
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
const HomeworkModal = dynamic(() => import("@/components/teacher/HomeworkModal"));
const SessionNotesPanel = dynamic(() => import("@/components/teacher/SessionNotesPanel"));
const UploadModal = dynamic(() => import("@/components/teacher/UploadModal"));
const FeedbackModal = dynamic(() => import("@/components/teacher/FeedbackModal"));

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

const VALID_TABS: TabKey[] = TABS.map(t => t.key);

export default function TeacherClassDetailPage() {
  const params = useParams();
  const classId = params.classId as string;
  const router = useRouter();
  const { teacherName, myClasses, ready } = useTeacherContext();

  // Tab hiện tại đồng bộ với URL (?tab=) để nút back của trình duyệt khôi phục đúng tab.
  // Đọc từ URL khi mount + khi back/forward (popstate); mặc định "overview" để khớp SSR.
  const [activeTab, setActiveTabState] = useState<TabKey>("overview");
  useEffect(() => {
    const sync = () => {
      const t = new URLSearchParams(window.location.search).get("tab") as TabKey | null;
      setActiveTabState(t && VALID_TABS.includes(t) ? t : "overview");
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const setActiveTab = (key: TabKey) => {
    setActiveTabState(key);
    const sp = new URLSearchParams(window.location.search);
    sp.set("tab", key);
    router.replace(`?${sp.toString()}`, { scroll: false });
  };
  // "Xem & chấm" ở tab Bài tập → chuyển sang tab Lộ trình và mở trình chấm đúng bài
  const [gradeLessonId, setGradeLessonId] = useState<string | null>(null);
  const gradeExamInCurriculum = (lessonId: string) => {
    setGradeLessonId(lessonId);
    setActiveTabState("curriculum");
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
  useEffect(() => {
    getClasses()
      .then(list => {
        const row = list.find(c => c.id === classId);
        if (row) setDbStudentIds((row.student_ids as string[] | null) ?? []);
      })
      .catch(() => {});
  }, [classId]);

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

  // Tài liệu / Bài giảng nguồn từ Lộ trình — hiển thị ở tab Tài liệu / Bài giảng.
  const [currMaterials, setCurrMaterials] = useState<StoredClassMaterial[]>([]);
  const [currLectures, setCurrLectures] = useState<StoredClassMaterial[]>([]);

  // Student packages per class (persisted to localStorage)
  const [studentPackages, setStudentPackages] = useState<Record<string, StudentPackage>>({});

  const cls = myClasses.find(c => c.id === classId);

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

  // Build curriculum date-index + extract curriculum bài tập (nộp file + làm câu hỏi)
  useEffect(() => {
    (async () => {
      const chapters = await getCurriculum(classId);
      const today = new Date().toISOString().slice(0, 10);
      const map: Record<string, CurriculumSessionData> = {};
      const fileHws: Homework[] = [];
      const examLessons: { id: string; title: string; description?: string; date?: string; assigned_to?: string[] | null; exam_status?: "draft" | "open" | "closed"; opens_at?: string }[] = [];
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
                kind: "file",
                file_url: lesson.file_url,
              });
            } else if (lesson.type === "exam") {
              examLessons.push({
                id: lesson.id, title: lesson.title, description: lesson.description,
                date: s.date, assigned_to: lesson.assigned_to ?? null,
                exam_status: lesson.exam_status ?? "draft", opens_at: lesson.exam_opens_at,
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
      // Kết quả bài thi (kind "exam") → đếm số bài nộp + điểm từng học sinh
      const examHws: Homework[] = await Promise.all(examLessons.map(async ex => {
        const results = await getAllExamResults(classId, ex.id).catch(() => []);
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
          kind: "exam" as const,
          exam_status: ex.exam_status,
          exam_results,
        };
      }));
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
    })();
  }, [classId, activeTab]);

  // Load persisted homework and submissions.
  useEffect(() => {
    if (!cls) return;
    (async () => {
      try {
        const all = await getTeacherHomework<Homework>([classId]);
        const forClass = all.filter(h => h.class_id === classId && h.source !== "curriculum");
        const base: Homework[] = forClass;
        // Giữ lại các bài tập từ lộ trình mà effect curriculum đã nạp vào state,
        // tránh race giữa hai effect ghi đè lẫn nhau (mất bài tập lộ trình khi mới load).
        setHomeworks(prev => {
          const curr = prev.filter(h => h.source === "curriculum");
          const currIds = new Set(curr.map(h => h.id));
          return [...base.filter(h => !currIds.has(h.id)), ...curr];
        });
      } catch {
        setHomeworks([]);
      }

      try {
        const rawSub = await getHwSubmissions<Submission>({
          classIds: [classId],
        });
        setSubmissions(rawSub);
      } catch {
        setSubmissions([]);
      }
    })();
  }, [classId, cls]);

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
      const loaded: Record<string, any[]> = {};
      for (const id of ids) {
        loaded[id] = await getStudentComments(id);
      }
      setComments(loaded);
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
      for (const h of prevManual) {
        if (!nextIds.has(h.id)) await removeTeacherHomework(h.id);
      }
      // Bài thêm mới / cập nhật → upsert từng row.
      for (const h of nextManual) {
        await upsertTeacherHomework(h);
      }
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

  const materials = [
    ...uploadedMaterials,
    ...currMaterials,
  ];
  const lectureMaterials = [...uploadedMaterials, ...currLectures].filter(m => m.kind === "lecture");
  const overviewLectures = lectureMaterials.map((lecture, index) => ({
    ...lecture,
    is_published: true,
    order: index + 1,
  }));
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
      late: records.filter(r => r.status === "late").length,
      absent: records.filter(r => r.status === "absent").length,
    };
  }

  return (
    <PortalLayout role="teacher" userName={teacherName || "Giáo viên"} pageTitle={cls.class_name}>
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
                  <p className="text-2xl font-bold">{lectureMaterials.length}</p>
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
              description={cls.description ?? ""}
              scheduleForDisplay={scheduleForDisplay}
              lectures={overviewLectures}
              materials={materials}
              notes={notes}
              classStudentsCount={classStudents.length}
              maxStudents={cls.max_students ?? 0}
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
            <CurriculumTab
              classId={classId}
              schedule={scheduleForDisplay}
              students={classStudents}
              gradeLessonId={gradeLessonId}
              onGradingOpened={() => setGradeLessonId(null)}
            />
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
              classId={classId}
              homeworks={homeworks}
              submissions={submissions}
              students={classStudents}
              onNewHomework={() => setHomeworkModal({ open: true })}
              onEditHomework={hw => setHomeworkModal({ open: true, editing: hw })}
              onDeleteHomework={handleDeleteHomework}
              onGradeExam={gradeExamInCurriculum}
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
            <LecturesTab classId={classId} lectures={[]} materials={[...uploadedMaterials, ...currLectures]} addButton={addButton("lecture", "Thêm bài giảng")} setUploadedMaterials={setUploadedMaterials} />
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
            <NotesTab classId={classId} notes={notes} materials={uploadedMaterials} addButton={addButton("note", "Viết ghi chú")} setUploadedMaterials={setUploadedMaterials} />
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
    </PortalLayout>
  );
}
