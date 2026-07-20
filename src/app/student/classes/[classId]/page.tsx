"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LearningModeBadge, ProgressBar, SectionHeader } from "@/components/shared";
import {
  MOCK_CLASSES, MOCK_TEACHERS, MOCK_CLASS_MATERIALS,
  MOCK_LECTURES, MOCK_CLASS_NOTES, MOCK_EXAM_SCORES, MOCK_HOMEWORK, MOCK_ATTENDANCE,
} from "@/lib/mock-data";
import { getSubmissionsByStudent, type SubmissionRecord } from "@/lib/supabase/submissions";
import { kvGet, getClasses, getClassScheduleOverride, getOnlineLink, getStudentPackages, getCurriculum, getClassMaterials, getExamResult, incrementMaterialDownload, isLessonVisibleToStudent, isAssignedToStudent, type StudentPackage, type CurriculumSession, type StoredClassMaterial } from "@/lib/storage";
import CurriculumView from "@/components/student/CurriculumView";
import {
  BookOpen, Clock, Video, MapPin, Users, ArrowLeft, FileText, Download,
  PlayCircle, StickyNote, Pin, Eye, ChevronRight, GraduationCap,
  Calendar, Presentation, Tag, Lock, ShieldAlert, CheckCircle2, AlertCircle,
  ExternalLink, Check, Map, CalendarDays, UserCheck, UserX, Timer, Minus,
  ClipboardList, ChevronDown, Send, XCircle, CheckSquare, NotebookPen, PenSquare, Search,
} from "lucide-react";
import { formatDate, toLocalDateKey } from "@/lib/utils";
import { useStudentContext } from "@/hooks/useStudentContext";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

interface SavedAttendanceRecord {
  class_id: string;
  student_id: string;
  date: string;
  status: AttendanceStatus;
  saved_at: string;
}

const ATTENDANCE_META: Record<AttendanceStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  present: { label: "Có mặt",  icon: UserCheck, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  late:    { label: "Muộn",    icon: Timer,      color: "text-amber-700 dark:text-amber-400",     bg: "bg-amber-100 dark:bg-amber-900/30" },
  excused: { label: "Có phép", icon: Check,      color: "text-blue-700 dark:text-blue-400",       bg: "bg-blue-100 dark:bg-blue-900/30" },
  absent:  { label: "Vắng",   icon: UserX,      color: "text-red-700 dark:text-red-400",         bg: "bg-red-100 dark:bg-red-900/30" },
};

const DAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
  // Vietnamese day names (used by teacher schedule overrides)
  "Thứ 2": 1, "Thứ 3": 2, "Thứ 4": 3, "Thứ 5": 4,
  "Thứ 6": 5, "Thứ 7": 6, "Chủ nhật": 0,
};

function generateSessionDates(
  schedules: { day: string; start_time: string; end_time: string }[],
  from: Date,
  to: Date
): { date: string; start_time: string; end_time: string }[] {
  const results: { date: string; start_time: string; end_time: string }[] = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  while (cur <= end) {
    const dow = cur.getDay();
    for (const s of schedules) {
      if (DAY_INDEX[s.day] === dow) {
        results.push({ date: toLocalDateKey(cur), start_time: s.start_time, end_time: s.end_time });
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  return results;
}

function loadSavedAttendance(): Promise<SavedAttendanceRecord[]> {
  return kvGet<SavedAttendanceRecord[]>("tutorhub_teacher_attendance", []);
}

type TabKey = "overview" | "curriculum" | "sessions" | "attendance" | "homework" | "materials" | "lectures" | "notes";

const DAY_VI: Record<string, string> = {
  Monday: "Thứ Hai", Tuesday: "Thứ Ba", Wednesday: "Thứ Tư",
  Thursday: "Thứ Năm", Friday: "Thứ Sáu", Saturday: "Thứ Bảy", Sunday: "Chủ Nhật",
  // Vietnamese day names (teacher overrides) — display as-is
  "Thứ 2": "Thứ 2", "Thứ 3": "Thứ 3", "Thứ 4": "Thứ 4", "Thứ 5": "Thứ 5",
  "Thứ 6": "Thứ 6", "Thứ 7": "Thứ 7", "Chủ nhật": "Chủ nhật",
};

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  formula:  { label: "Công thức", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  exam_prep:{ label: "Ôn thi",    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  summary:  { label: "Tóm tắt",   color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  textbook: { label: "Giáo trình",color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
};

// ── Curriculum session preview for students ───────────────────────────────────

const LESSON_TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  lecture:  { label: "Bài giảng",      icon: PlayCircle,     color: "text-blue-600 dark:text-blue-400" },
  material: { label: "Tài liệu",       icon: FileText,        color: "text-emerald-600 dark:text-emerald-400" },
  homework: { label: "Bài tập",        icon: ClipboardList,   color: "text-amber-600 dark:text-amber-400" },
  solution: { label: "Video chữa bài", icon: Eye,             color: "text-violet-600 dark:text-violet-400" },
  exam:     { label: "Bài kiểm tra",   icon: GraduationCap,   color: "text-violet-600 dark:text-violet-400" },
};

function StudentCurriculumSessionPreview({ session, classId, studentId }: { session: CurriculumSession; classId: string; studentId: string }) {
  const [open, setOpen] = useState(false);
  const published = session.lessons.filter(l => isLessonVisibleToStudent(l, studentId));
  if (published.length === 0) return null;
  return (
    <div className="border border-border/60 rounded-lg overflow-hidden text-xs">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className="font-semibold text-foreground flex-1">{session.title}</span>
        <span className="text-muted-foreground">{published.length} nội dung</span>
      </button>
      {open && (
        <div className="divide-y divide-border/40">
          {published.map(l => {
            const meta = LESSON_TYPE_META[l.type] ?? LESSON_TYPE_META.lecture;
            const Icon = meta.icon;
            const row = (
              <>
                <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.color}`} />
                <span className="flex-1 text-foreground line-clamp-1">{l.title}</span>
                <span className={`shrink-0 ${meta.color} opacity-70`}>{meta.label}</span>
              </>
            );
            if (l.type === "exam") {
              return (
                <Link key={l.id} href={`/student/classes/${classId}/exam/${l.id}`} className="flex items-center gap-2 px-3 py-2 bg-background hover:bg-muted/40 transition-colors">
                  {row}
                </Link>
              );
            }
            return (
              <div key={l.id} className="flex items-center gap-2 px-3 py-2 bg-background">
                {row}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── localStorage: per-student watched lectures ────────────────────────────────
function loadWatched(studentId: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(`tutorhub_watched_${studentId}`) ?? "[]")); } catch { return new Set(); }
}
function saveWatched(studentId: string, s: Set<string>) {
  localStorage.setItem(`tutorhub_watched_${studentId}`, JSON.stringify([...s]));
}

// ── KV: submissions fallback ─────────────────────────────────────────────────
function loadLocalSubs(): Promise<SubmissionRecord[]> {
  return kvGet<SubmissionRecord[]>("tutorhub_submissions", []);
}

type ClassInfo = (typeof MOCK_CLASSES)[number];

interface HomeworkItem {
  id: string;
  class_id: string;
  title: string;
  description?: string;
  due_date: string;
  created_at?: string;
  assigned_to?: string[] | null;
  kind?: "file" | "exam";  // "exam" = làm câu hỏi trên hệ thống
  exam_done?: boolean;
  exam_score?: number;
  exam_total?: number;
}

// Video trong tab Bài giảng: gồm bài giảng (lecture) và video chữa bài (solution).
interface LectureCard {
  id: string;
  title: string;
  description?: string;
  video_url: string | null;
  is_published: boolean;
  kind: "lecture" | "solution";
  order?: number;
  duration?: string;
  views?: number;
  slides_url?: string | null;
  created_at?: string;
  linkedHomeworkTitle?: string;
}

// Sắp xếp mới nhất lên đầu: ưu tiên created_at, fallback due_date.
function recentFirst(a: { created_at?: string; due_date?: string }, b: { created_at?: string; due_date?: string }) {
  return (b.created_at ?? b.due_date ?? "").localeCompare(a.created_at ?? a.due_date ?? "");
}

// ── Page ──────────────────────────────────────────────────────────────────────
const VALID_TABS: TabKey[] = ["overview", "curriculum", "sessions", "attendance", "homework", "materials", "lectures", "notes"];

export default function StudentClassDetailPage() {
  const { studentId, studentName, assignedClassId, ready } = useStudentContext();
  const CURRENT_STUDENT_ID = studentId;
  const params  = useParams();
  const classId = params.classId as string;
  const router = useRouter();

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
  const [watched,      setWatched]      = useState<Set<string>>(new Set());
  const [submissions,  setSubmissions]  = useState<SubmissionRecord[]>([]);
  const [onlineLink,   setOnlineLink]   = useState<string>("");
  const [myPackage,    setMyPackage]    = useState<StudentPackage | null>(null);
  const [savedAttendance, setSavedAttendance] = useState<SavedAttendanceRecord[]>([]);
  const [curriculumByDate, setCurriculumByDate] = useState<Record<string, CurriculumSession>>({});
  const [sessionNotes, setSessionNotes] = useState<Record<string, string>>({});
  const [uploadedMaterials, setUploadedMaterials] = useState<StoredClassMaterial[]>([]);
  const [studentPkg, setStudentPkg] = useState<StudentPackage | undefined>(undefined);
  // undefined = still resolving, null = not found
  const [cls, setCls] = useState<ClassInfo | null | undefined>(undefined);
  const [scheduleOverride, setScheduleOverride] = useState<ClassInfo["schedule"] | null>(null);
  const [teacherHomework, setTeacherHomework] = useState<HomeworkItem[]>([]);
  // Bài giảng + video chữa bài + tài liệu lấy từ lộ trình của lớp
  const [curriculumLectures, setCurriculumLectures] = useState<LectureCard[]>([]);
  const [curriculumMaterials, setCurriculumMaterials] = useState<StoredClassMaterial[]>([]);
  // Bộ lọc / tìm kiếm cho các tab (giảm ngợp thông tin)
  const [hwFilter, setHwFilter]   = useState<"all" | "todo" | "done">("all");
  const [lecFilter, setLecFilter] = useState<"all" | "lecture" | "solution">("all");
  const [lecQuery, setLecQuery]   = useState("");
  const [matCat, setMatCat]       = useState<string>("all");
  const [matQuery, setMatQuery]   = useState("");

  // Resolve class from DB (includes admin-created), fallback to mock
  useEffect(() => {
    (async () => {
      let found: ClassInfo | null = null;
      try {
        const all = await getClasses();
        found = (all.find(c => c.id === classId) as unknown as ClassInfo) ?? null;
      } catch { /* offline */ }
      if (!found) found = MOCK_CLASSES.find(c => c.id === classId) ?? null;
      setCls(found);
    })();
    getClassScheduleOverride(classId).then(ov => setScheduleOverride(ov as ClassInfo["schedule"] | null));
    kvGet<HomeworkItem[]>("tutorhub_teacher_homework", [])
      .then(all => setTeacherHomework(all.filter(h => h.class_id === classId && isAssignedToStudent(h.assigned_to, studentId))));
  }, [classId]);

  useEffect(() => {
    getStudentPackages(classId).then(pkgs => setStudentPkg(pkgs[studentId]));
  }, [classId, studentId]);
  useEffect(() => { getClassMaterials(classId).then(setUploadedMaterials); }, [classId]);
  const materials = useMemo(() => {
    const mockMats = MOCK_CLASS_MATERIALS.filter(m => m.class_id === classId);
    const realMats = uploadedMaterials.filter(m => {
      if (!m.packages || m.packages.length === 0) return true;
      return studentPkg ? m.packages.includes(studentPkg) : false;
    });
    // Tài liệu từ lộ trình + mock + upload, mới nhất lên đầu
    return [...curriculumMaterials, ...mockMats, ...realMats].sort(recentFirst);
  }, [classId, uploadedMaterials, studentPkg, curriculumMaterials]);

  useEffect(() => {
    setWatched(loadWatched(studentId));
    getOnlineLink(classId).then(link => setOnlineLink(link ?? ""));
    // Load submissions for homework status
    getSubmissionsByStudent(CURRENT_STUDENT_ID).then(async remote => {
      if (remote.length > 0) { setSubmissions(remote); return; }
      const local = await loadLocalSubs();
      setSubmissions(local.filter(s => s.student_id === CURRENT_STUDENT_ID));
    });
    // Load my package for this class
    getStudentPackages(classId).then(pkgs => setMyPackage(pkgs[CURRENT_STUDENT_ID] ?? null));
    // Load attendance records
    loadSavedAttendance().then(setSavedAttendance);
    // Load curriculum → build date map + đẩy bài tập / bài giảng / video chữa bài / tài liệu về các tab
    getCurriculum(classId).then(async chapters => {
      const today = new Date().toISOString().slice(0, 10);
      const byDate: Record<string, CurriculumSession> = {};
      const currHws: HomeworkItem[] = [];
      const lectureCards: LectureCard[] = [];
      const matCards: StoredClassMaterial[] = [];
      // Tra tiêu đề bài tập (để hiển thị "Chữa cho: …" trên video chữa bài)
      const titleById: Record<string, string> = {};
      chapters.forEach(ch => ch.sessions.forEach(s => s.lessons.forEach(l => { titleById[l.id] = l.title; })));

      for (const ch of chapters) {
        for (const s of ch.sessions) {
          if (s.date) byDate[s.date] = s;
          for (const lesson of s.lessons) {
            if (!isLessonVisibleToStudent(lesson, studentId)) continue;
            const created = s.date ?? today;
            if (lesson.type === "homework") {
              currHws.push({
                id: lesson.id, class_id: classId, title: lesson.title,
                description: (lesson as any).description,
                due_date: (lesson as any).due_date ?? s.date ?? today,
                created_at: created, kind: "file",
              });
            } else if (lesson.type === "exam") {
              const result = await getExamResult(classId, lesson.id, studentId).catch(() => null);
              const manual = result ? Object.values(result.manual_scores ?? {}).reduce((a, b) => a + b, 0) : 0;
              currHws.push({
                id: lesson.id, class_id: classId, title: lesson.title,
                description: (lesson as any).description,
                due_date: (lesson as any).exam_opens_at?.slice(0, 10) ?? s.date ?? today,
                created_at: created, kind: "exam",
                exam_done: !!result,
                exam_score: result ? Math.round((result.score + manual) * 100) / 100 : undefined,
                exam_total: result?.total,
              });
            } else if (lesson.type === "lecture" || lesson.type === "solution") {
              lectureCards.push({
                id: lesson.id, title: lesson.title, description: (lesson as any).description,
                video_url: (lesson as any).video_url ?? null,
                is_published: lesson.is_published, kind: lesson.type,
                created_at: created,
                linkedHomeworkTitle: lesson.type === "solution" && (lesson as any).linked_homework_id
                  ? titleById[(lesson as any).linked_homework_id]
                  : undefined,
              });
            } else if (lesson.type === "material" && (lesson as any).file_url) {
              const url: string = (lesson as any).file_url;
              const ext = (url.split("?")[0].split(".").pop() || "").toLowerCase();
              matCards.push({
                id: lesson.id, class_id: classId, title: lesson.title,
                description: (lesson as any).description ?? "",
                file_url: url, file_type: ext === "pdf" ? "pdf" : ext || "file",
                file_size: "", category: "textbook", uploaded_by: cls?.tutor_id ?? "",
                created_at: created, download_count: 0, kind: "material",
              });
            }
          }
        }
      }
      setCurriculumByDate(byDate);
      setCurriculumLectures(lectureCards);
      setCurriculumMaterials(matCards);
      if (currHws.length > 0) {
        setTeacherHomework(prev => {
          const existingIds = new Set(prev.map(h => h.id));
          const fresh = currHws.filter(h => !existingIds.has(h.id));
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
      }
    });
    // Load session notes written by teacher
    kvGet<Record<string, string>>(`tutorhub_session_notes_${classId}`, {}).then(setSessionNotes);
  }, [classId, studentId]);

  // ── Loading (class resolution + student context) ──────────────────────────
  if (!ready || cls === undefined) {
    return (
      <PortalLayout role="student" userName={studentName} pageTitle="Lớp học">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground mt-4">Đang tải lớp học…</p>
        </div>
      </PortalLayout>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (!cls) {
    return (
      <PortalLayout role="student" userName={studentName} pageTitle="Lớp học">
        <div className="flex flex-col items-center justify-center py-20">
          <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold">Không tìm thấy lớp học</h2>
          <Link href="/student/classes"><Button variant="outline" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" />Quay lại</Button></Link>
        </div>
      </PortalLayout>
    );
  }

  // ── Enrollment check ──────────────────────────────────────────────────────
  if (!(cls.student_ids ?? []).includes(CURRENT_STUDENT_ID) && assignedClassId !== classId) {
    return (
      <PortalLayout role="student" userName={studentName} pageTitle="Lớp học">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold">Bạn không có quyền truy cập lớp này</h2>
          <p className="text-sm text-muted-foreground mt-1">Bạn chưa được đăng ký vào lớp học này.</p>
          <Link href="/student/classes"><Button variant="outline" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" />Quay lại</Button></Link>
        </div>
      </PortalLayout>
    );
  }

  // ── Data ──────────────────────────────────────────────────────────────────
  const schedule          = scheduleOverride ?? cls.schedule ?? [];
  const teacher           = MOCK_TEACHERS.find(t => t.id === cls.tutor_id);
  const notes             = MOCK_CLASS_NOTES.filter(n => n.class_id === classId);
  // Bài giảng + video chữa bài: lộ trình + mock, mới nhất lên đầu
  const mockLectureCards: LectureCard[] = MOCK_LECTURES.filter(l => l.class_id === classId).map(l => ({
    id: l.id, title: l.title, description: l.description, video_url: l.video_url,
    is_published: l.is_published, kind: "lecture", order: l.order, duration: l.duration,
    views: l.views, slides_url: l.slides_url, created_at: l.created_at,
  }));
  const mockLectureIds    = new Set(mockLectureCards.map(l => l.id));
  const lectureItems: LectureCard[] = [
    ...curriculumLectures.filter(l => !mockLectureIds.has(l.id)),
    ...mockLectureCards,
  ].sort(recentFirst);
  const publishedLectures = lectureItems.filter(l => l.is_published);
  // Merge teacher-created homework (kv) with mock — kv wins on id collision
  const kvHwIds           = new Set(teacherHomework.map(h => h.id));
  const classHomework: HomeworkItem[] = [
    ...teacherHomework,
    ...MOCK_HOMEWORK.filter(h => h.class_id === classId && !kvHwIds.has(h.id)),
  ];
  // Tất cả bài tập của lớp, mới nhất lên đầu (dùng cho tab Bài tập)
  const sortedClassHomework = [...classHomework].sort(recentFirst);
  // "done" = đã làm/đã nộp xong; "todo" = chưa làm / cần làm lại
  const isHwDone = (hw: HomeworkItem) => {
    if (hw.kind === "exam") return !!hw.exam_done;
    const s = submissions.find(x => x.homework_id === hw.id && x.student_id === CURRENT_STUDENT_ID);
    return !!s && s.status !== "returned";
  };
  const incompleteClassHomework = classHomework.filter(hw => !isHwDone(hw));
  const hwDoneCount = sortedClassHomework.length - incompleteClassHomework.length;
  const hwView = sortedClassHomework.filter(hw =>
    hwFilter === "all" ? true : hwFilter === "done" ? isHwDone(hw) : !isHwDone(hw));

  // Bài giảng: lọc theo loại + tìm kiếm
  const lecView = lectureItems.filter(l =>
    (lecFilter === "all" || l.kind === lecFilter) &&
    (!lecQuery.trim() || l.title.toLowerCase().includes(lecQuery.trim().toLowerCase())));
  const lecSolutionCount = lectureItems.filter(l => l.kind === "solution").length;

  // Tài liệu: các danh mục hiện có + lọc theo danh mục + tìm kiếm
  const matCategories = Array.from(new Set(materials.map(m => m.category)));
  const matView = materials.filter(m =>
    (matCat === "all" || m.category === matCat) &&
    (!matQuery.trim() || m.title.toLowerCase().includes(matQuery.trim().toLowerCase())));

  const chipCls = (active: boolean) =>
    `px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`;

  // Completion: per-student localStorage tracking
  const watchedCount    = publishedLectures.filter(l => watched.has(l.id)).length;
  const completionPct   = publishedLectures.length > 0
    ? Math.round((watchedCount / publishedLectures.length) * 100)
    : 0;

  // Scores
  const myScores = MOCK_EXAM_SCORES.filter(e => e.student_id === CURRENT_STUDENT_ID && e.class_id === classId);
  const avgScore = myScores.length
    ? (myScores.reduce((s, e) => s + e.score, 0) / myScores.length).toFixed(1)
    : null;

  const enrolledCount = (cls.student_ids ?? []).length;
  const showZoom      = !!(onlineLink || cls.zoom_link);

  // Mark lecture watched + open video
  function handleWatchLecture(lecId: string, videoUrl: string | null) {
    const next = new Set(watched);
    next.add(lecId);
    setWatched(next);
    saveWatched(studentId, next);
    if (videoUrl) window.open(videoUrl, "_blank", "noopener,noreferrer");
  }

  // ── Session dates (last 3 months + next 2 weeks) ──────────────────────────
  const today = new Date();
  const sessionFrom = new Date(today); sessionFrom.setMonth(sessionFrom.getMonth() - 3);
  const sessionTo   = new Date(today); sessionTo.setDate(sessionTo.getDate() + 14);
  const allSessions = generateSessionDates(schedule, sessionFrom, sessionTo)
    .sort((a, b) => b.date.localeCompare(a.date)); // newest first
  const todayStr = toLocalDateKey(today);
  const pastSessions     = allSessions.filter(s => s.date <= todayStr);
  const upcomingSessions = allSessions.filter(s => s.date > todayStr);

  // Chuẩn chuyên cần: excused không tính vắng, loại khỏi cả tử số lẫn mẫu số
  // tỷ lệ = (present + late) / (tổng buổi - excused)
  const pastRecords = pastSessions.map(s =>
    savedAttendance.find(r => r.class_id === classId && r.student_id === CURRENT_STUDENT_ID && r.date === s.date)
  );
  const attendedCount = pastRecords.filter(r => r?.status === "present" || r?.status === "late").length;
  const excusedCount  = pastRecords.filter(r => r?.status === "excused").length;
  const sessionRateDenom = pastSessions.length - excusedCount;

  const TABS: { key: TabKey; label: string; icon: React.ElementType; badge?: number | string }[] = [
    { key: "overview",    label: "Tổng quan",  icon: BookOpen },
    { key: "curriculum",  label: "Lộ trình",   icon: Map },
    { key: "sessions",    label: "Buổi học",   icon: CalendarDays, badge: pastSessions.length },
    { key: "attendance",  label: "Chuyên cần", icon: CheckSquare },
    { key: "homework",    label: "Bài tập",    icon: CheckCircle2, badge: incompleteClassHomework.length },
    { key: "materials",   label: "Tài liệu",   icon: FileText,     badge: materials.length },
    { key: "lectures",    label: "Bài giảng",  icon: Presentation, badge: publishedLectures.length },
    { key: "notes",       label: "Ghi chú",    icon: StickyNote,   badge: notes.length > 0 ? notes.length : undefined },
  ];

  return (
    <PortalLayout role="student" userName={studentName} pageTitle={cls.class_name}>
      <div className="space-y-6 max-w-6xl mx-auto">

        <Link href="/student/classes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Quay lại danh sách lớp
        </Link>

        {/* ── Hero ─────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden border border-border/50 shadow-sm">
          <div
            className="p-6 md:p-8 text-white relative"
            style={{ background: `linear-gradient(135deg, ${cls.color} 0%, color-mix(in srgb, ${cls.color} 40%, #000) 100%)` }}
          >
            <div className="flex flex-col md:flex-row gap-5 items-start">
              <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/30 shadow-lg shrink-0">
                <BookOpen className="h-8 w-8" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <LearningModeBadge mode={cls.learning_mode} />
                  {cls.grade && (
                    <Badge className="bg-white/20 text-white border-white/30 text-[10px]">
                      <GraduationCap className="h-3 w-3 mr-1" />Lớp {cls.grade}
                    </Badge>
                  )}
                  {showZoom && (
                    <Badge className="bg-white/20 text-white border-white/30 text-[10px]">
                      <Video className="h-3 w-3 mr-1" />Zoom
                    </Badge>
                  )}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold leading-tight">{cls.class_name}</h1>
                <p className="text-white/70 mt-1 font-medium">{cls.subject}</p>
              </div>
              <div className="flex flex-wrap gap-3 shrink-0">
                {[
                  { value: publishedLectures.length, label: "Bài giảng" },
                  { value: materials.length,         label: "Tài liệu" },
                  { value: classHomework.length,     label: "Bài tập" },
                ].map(stat => (
                  <div key={stat.label} className="bg-white/10 backdrop-blur px-4 py-2 rounded-xl text-center border border-white/20 min-w-[72px]">
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-[11px] text-white/60">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-card border-b border-border px-4 md:px-8 flex gap-0 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.badge != null && Number(tab.badge) > 0 && (
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{tab.badge}</span>
                )}
                {tab.key === "notes" && notes.some(n => n.is_pinned) && (
                  <span className="h-2 w-2 bg-red-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ───────────────────────────────────── */}
        <div key={activeTab} className="animate-fade-in">

          {/* ── Overview ── */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">

                {/* Description */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Mô tả khóa học</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {cls.description || "Khóa học cung cấp kiến thức nền tảng và nâng cao, bám sát chương trình chuẩn."}
                    </p>
                  </CardContent>
                </Card>

                {/* Schedule */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Lịch học</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {schedule.map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <Clock className="h-4 w-4 text-primary" />
                          {DAY_VI[s.day] ?? s.day}
                        </span>
                        <span className="text-sm text-muted-foreground font-medium">{s.start_time} – {s.end_time}</span>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-4 pt-1 text-sm text-muted-foreground">
                      {cls.classroom && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-amber-500" />
                          Phòng học: <strong className="text-foreground ml-1">{cls.classroom}</strong>
                        </span>
                      )}
                      {showZoom && (
                        <span className="flex items-center gap-1.5">
                          <Video className="h-4 w-4 text-blue-500" />
                          Có phòng học Online
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Recent lectures */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Bài giảng gần đây</CardTitle>
                      <Button size="sm" variant="ghost" className="group text-xs text-primary hover:text-primary hover:bg-primary/10" onClick={() => setActiveTab("lectures")}>
                        Xem tất cả <ChevronRight className="h-3.5 w-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {publishedLectures.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">
                        <Presentation className="h-10 w-10 mx-auto opacity-20 mb-2" />
                        <p className="text-sm">Chưa có bài giảng nào</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {publishedLectures.slice(0, 3).map(lec => {
                          const isWatched = watched.has(lec.id);
                          return (
                            <div
                              key={lec.id}
                              onClick={() => handleWatchLecture(lec.id, lec.video_url)}
                              className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group"
                            >
                              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isWatched ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white"}`}>
                                {isWatched ? <Check className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{lec.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{lec.duration}</p>
                              </div>
                              {isWatched
                                ? <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 shrink-0">Đã xem</Badge>
                                : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              }
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right sidebar */}
              <div className="space-y-5">

                {/* Teacher */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Giảng viên</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/50">
                      <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {teacher?.full_name.split(" ").slice(-2).map(n => n[0]).join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{teacher?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{teacher?.specialization}</p>
                      </div>
                    </div>
                    {teacher?.bio && (
                      <p className="text-xs text-muted-foreground leading-relaxed px-1">{teacher.bio}</p>
                    )}
                  </CardContent>
                </Card>

                {/* Class info */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Thông tin lớp</CardTitle></CardHeader>
                  <CardContent className="space-y-0 divide-y divide-border/50">
                    {[
                      { icon: Users,         label: "Sĩ số",    value: `${enrolledCount} / ${cls.max_students} học viên` },
                      { icon: GraduationCap, label: "Khối lớp", value: cls.grade ? `Lớp ${cls.grade}` : "—" },
                      { icon: MapPin,        label: "Phòng học", value: cls.classroom ?? "—" },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between py-2.5">
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                          <row.icon className="h-3.5 w-3.5" />{row.label}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{row.value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* My package */}
                {myPackage && (() => {
                  const PKG: Record<StudentPackage, { label: string; color: string; description: string; perks: string[] }> = {
                    online:   { label: "Gói Online",   color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",     description: "Học trực tuyến",           perks: ["Tham gia live online", "Xem lại bài giảng"] },
                    advanced: { label: "Gói Nâng cao", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", description: "Online + Tài liệu nâng cao", perks: ["Tham gia live online", "Xem lại bài giảng", "Tài liệu nâng cao"] },
                    offline:  { label: "Gói Offline",  color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",   description: "Học tại trung tâm",        perks: ["Học tại lớp", "Xem lại bài giảng", "Full tài liệu", "Bài tập riêng"] },
                  };
                  const info = PKG[myPackage];
                  return (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Gói đăng ký của bạn</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${info.color}`}>
                          {info.label}
                        </div>
                        <p className="text-xs text-muted-foreground">{info.description}</p>
                        <ul className="space-y-1">
                          {info.perks.map(perk => (
                            <li key={perk} className="flex items-center gap-2 text-xs text-foreground">
                              <Check className="h-3 w-3 text-emerald-500 shrink-0" />{perk}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Progress */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Tiến trình của tôi</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Bài giảng đã xem</span>
                      <span className="font-bold text-primary">{watchedCount}/{publishedLectures.length}</span>
                    </div>
                    <ProgressBar value={completionPct} showValue={false} color="bg-primary" />
                    <div className="flex justify-between text-sm pt-2 border-t border-border/50">
                      <span className="text-muted-foreground">Điểm trung bình</span>
                      {avgScore
                        ? <span className="font-bold text-emerald-600">{avgScore}/10</span>
                        : <span className="text-muted-foreground text-xs italic">Chưa có điểm</span>}
                    </div>
                  </CardContent>
                </Card>

                {/* Pinned notes */}
                {notes.some(n => n.is_pinned) && (
                  <Card className="border-amber-200 dark:border-amber-800/50">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Pin className="h-4 w-4 text-amber-500" />
                        <CardTitle className="text-sm">Ghim quan trọng</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {notes.filter(n => n.is_pinned).map(note => (
                        <div
                          key={note.id}
                          onClick={() => setActiveTab("notes")}
                          className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200/50 dark:border-amber-800/30 cursor-pointer hover:shadow-sm transition-shadow"
                        >
                          <p className="text-sm font-semibold text-foreground">{note.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{note.content}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Join online */}
                {showZoom && (
                  <Button
                    variant="gradient"
                    className="w-full shadow-lg shadow-primary/20"
                    onClick={() => window.open(onlineLink || cls.zoom_link!, "_blank", "noopener,noreferrer")}
                  >
                    <Video className="h-4 w-4 mr-2" />Tham gia phòng học Online
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── Sessions ── */}
          {activeTab === "sessions" && (
            <div className="space-y-6">

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Buổi đã học", value: pastSessions.length, color: "text-foreground" },
                  { label: "Có mặt",      value: attendedCount,       color: "text-emerald-600" },
                  { label: "Tỉ lệ",       value: sessionRateDenom > 0 ? `${Math.round(attendedCount / sessionRateDenom * 100)}%` : "—", color: "text-primary" },
                ].map(s => (
                  <Card key={s.label}>
                    <CardContent className="p-4 text-center">
                      <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Upcoming */}
              {upcomingSessions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Buổi sắp tới</h3>
                  {upcomingSessions.slice(0, 3).map(s => {
                    const upCurrSession = curriculumByDate[s.date];
                    const upNote = sessionNotes[s.date];
                    const dateObj = new Date(s.date + "T12:00:00");
                    const dayName = DAY_VI[schedule.find(sc => DAY_INDEX[sc.day] === dateObj.getDay())?.day ?? ""] ?? "";
                    return (
                      <div key={s.date} className="rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
                        <div className="flex items-center gap-4 p-4">
                          <CalendarDays className="h-5 w-5 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {dayName} — {dateObj.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                            </p>
                            <p className="text-xs text-muted-foreground">{s.start_time} – {s.end_time}</p>
                          </div>
                        </div>
                        {(upNote || upCurrSession) && (
                          <div className="px-4 pb-4 space-y-2">
                            {upNote && (
                              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
                                <StickyNote className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">{upNote}</p>
                              </div>
                            )}
                            {upCurrSession && <StudentCurriculumSessionPreview session={upCurrSession} classId={classId} studentId={CURRENT_STUDENT_ID} />}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Past sessions */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Lịch sử buổi học</h3>
                {pastSessions.length === 0 ? (
                  <Card><CardContent className="py-12 text-center text-muted-foreground">
                    <CalendarDays className="h-10 w-10 mx-auto opacity-20 mb-3" />
                    <p className="text-sm">Chưa có buổi học nào trong 3 tháng qua</p>
                  </CardContent></Card>
                ) : (
                  pastSessions.map(session => {
                    const rec = savedAttendance.find(
                      r => r.class_id === classId && r.student_id === CURRENT_STUDENT_ID && r.date === session.date
                    );
                    const attMeta = rec ? ATTENDANCE_META[rec.status] : null;
                    const AttIcon = attMeta?.icon;
                    const currSession = curriculumByDate[session.date];
                    const sessionHomework = classHomework.filter(hw => {
                      if (!hw.due_date) return false;
                      const diff = Math.abs(new Date(hw.due_date).getTime() - new Date(session.date).getTime());
                      return diff <= 7 * 86400 * 1000;
                    });
                    const sessionDateObj = new Date(session.date + "T12:00:00");
                    const dayName = DAY_VI[schedule.find(sc => DAY_INDEX[sc.day] === sessionDateObj.getDay())?.day ?? ""] ?? "";
                    return (
                      <Card key={session.date} className="overflow-hidden">
                        <CardContent className="p-0">
                          <div className="flex items-start gap-4 p-4">
                            {/* Date col */}
                            <div className="text-center shrink-0 w-14">
                              <div className="text-[10px] font-semibold text-muted-foreground uppercase">{dayName}</div>
                              <div className="text-xl font-bold text-foreground leading-none">{sessionDateObj.getDate()}</div>
                              <div className="text-xs text-muted-foreground">Th{sessionDateObj.getMonth() + 1}</div>
                            </div>

                            {/* Separator */}
                            <div className="w-px bg-border self-stretch shrink-0" />

                            {/* Main */}
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />{session.start_time} – {session.end_time}
                                </span>
                                {attMeta && AttIcon ? (
                                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${attMeta.bg} ${attMeta.color}`}>
                                    <AttIcon className="h-3 w-3" />{attMeta.label}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                    <Minus className="h-3 w-3" />Chưa điểm danh
                                  </span>
                                )}
                              </div>

                              {/* Session notes from teacher */}
                              {sessionNotes[session.date] && (
                                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
                                  <StickyNote className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                                  <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">{sessionNotes[session.date]}</p>
                                </div>
                              )}

                              {/* Curriculum session content */}
                              {currSession && (
                                <StudentCurriculumSessionPreview session={currSession} classId={classId} studentId={CURRENT_STUDENT_ID} />
                              )}

                              {/* Homework for this session */}
                              {sessionHomework.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                  {sessionHomework.map(hw => {
                                    const sub = submissions.find(s => s.homework_id === hw.id && s.student_id === CURRENT_STUDENT_ID);
                                    return (
                                      <div key={hw.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border/50">
                                        <ClipboardList className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                        <span className="flex-1 text-xs text-foreground line-clamp-1">{hw.title}</span>
                                        {sub ? (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
                                            <Check className="h-2.5 w-2.5" />Đã nộp
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
                                            <Send className="h-2.5 w-2.5" />Chưa nộp
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ── Curriculum ── */}
          {activeTab === "curriculum" && (
            <CurriculumView
              classId={classId}
              studentId={CURRENT_STUDENT_ID}
              watched={watched}
              onWatch={(id) => {
                const next = new Set(watched);
                next.add(id);
                setWatched(next);
                saveWatched(studentId, next);
              }}
              submissions={submissions.map(s => ({ homework_id: s.homework_id }))}
            />
          )}

          {/* ── Lectures ── */}
          {activeTab === "lectures" && (
            <div className="space-y-4">
              {lectureItems.length === 0 ? (
                <Card><CardContent className="py-16 text-center text-muted-foreground">
                  <Presentation className="h-12 w-12 mx-auto opacity-20 mb-3" />
                  <p className="text-sm font-medium">Chưa có bài giảng nào</p>
                </CardContent></Card>
              ) : (
                <>
                  {/* Lọc theo loại + tìm kiếm */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative flex-1 sm:max-w-xs">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        value={lecQuery}
                        onChange={e => setLecQuery(e.target.value)}
                        placeholder="Tìm bài giảng…"
                        className="w-full h-9 pl-8 pr-3 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => setLecFilter("all")} className={chipCls(lecFilter === "all")}>Tất cả ({lectureItems.length})</button>
                      <button onClick={() => setLecFilter("lecture")} className={chipCls(lecFilter === "lecture")}>Bài giảng</button>
                      {lecSolutionCount > 0 && (
                        <button onClick={() => setLecFilter("solution")} className={chipCls(lecFilter === "solution")}>Video chữa bài ({lecSolutionCount})</button>
                      )}
                    </div>
                  </div>

                  {lecView.length === 0 ? (
                    <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Không tìm thấy bài giảng phù hợp.</CardContent></Card>
                  ) : lecView.map((lec, i) => {
                  const isWatched = watched.has(lec.id);
                  return (
                    <Card
                      key={lec.id}
                      className={`overflow-hidden animate-fade-in transition-all ${!lec.is_published ? "opacity-60" : "hover:shadow-lg hover:border-primary/30"}`}
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row">
                          {/* Thumbnail area */}
                          <div className={`sm:w-44 flex items-center justify-center p-6 shrink-0 ${lec.is_published ? "bg-primary/5" : "bg-muted/50"}`}>
                            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${
                              isWatched ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                                        : lec.is_published ? "bg-primary/10 text-primary"
                                        : "bg-muted text-muted-foreground"
                            }`}>
                              {isWatched ? <Check className="h-7 w-7" />
                               : lec.is_published ? <PlayCircle className="h-7 w-7" />
                               : <Lock className="h-6 w-6" />}
                            </div>
                          </div>

                          <div className="flex-1 p-5 sm:p-6">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Badge variant={lec.kind === "solution" ? "outline" : "info"} className={`text-[10px] ${lec.kind === "solution" ? "text-violet-600 border-violet-300 dark:text-violet-400" : ""}`}>
                                    {lec.kind === "solution" ? "Video chữa bài" : "Bài giảng"}
                                  </Badge>
                                  {!lec.is_published && <Badge variant="outline" className="text-[10px]">Sắp ra mắt</Badge>}
                                  {isWatched && (
                                    <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                                      Đã xem
                                    </Badge>
                                  )}
                                </div>
                                <h3 className="font-semibold text-foreground text-base">{lec.title}</h3>
                                {lec.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{lec.description}</p>}
                                {lec.linkedHomeworkTitle && (
                                  <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">↪ Chữa cho: {lec.linkedHomeworkTitle}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                                  {lec.duration && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{lec.duration}</span>}
                                  {lec.is_published && lec.views != null && <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{lec.views} lượt xem</span>}
                                  {lec.created_at && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(lec.created_at)}</span>}
                                </div>
                              </div>
                              {lec.is_published && (
                                <div className="flex flex-col gap-2 shrink-0">
                                  <Button
                                    size="sm"
                                    variant={isWatched ? "outline" : "gradient"}
                                    onClick={() => handleWatchLecture(lec.id, lec.video_url)}
                                  >
                                    <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                                    {isWatched ? "Xem lại" : lec.kind === "solution" ? "Xem video chữa" : "Xem bài giảng"}
                                  </Button>
                                  {lec.slides_url && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => window.open(lec.slides_url!, "_blank", "noopener,noreferrer")}
                                    >
                                      <Download className="h-3.5 w-3.5 mr-1.5" />Tải slide
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                </>
              )}
            </div>
          )}

          {/* ── Materials ── */}
          {activeTab === "materials" && (
            <div className="space-y-4">
              {materials.length === 0 ? (
                <Card><CardContent className="py-16 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto opacity-20 mb-3" />
                  <p className="text-sm font-medium">Chưa có tài liệu nào</p>
                </CardContent></Card>
              ) : (
                <>
                  {/* Tìm kiếm + lọc danh mục */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative flex-1 sm:max-w-xs">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        value={matQuery}
                        onChange={e => setMatQuery(e.target.value)}
                        placeholder="Tìm tài liệu…"
                        className="w-full h-9 pl-8 pr-3 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => setMatCat("all")} className={chipCls(matCat === "all")}>Tất cả ({materials.length})</button>
                      {matCategories.map(c => (
                        <button key={c} onClick={() => setMatCat(c)} className={chipCls(matCat === c)}>{CATEGORY_MAP[c]?.label ?? c}</button>
                      ))}
                    </div>
                  </div>

                  {matView.length === 0 ? (
                    <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Không tìm thấy tài liệu phù hợp.</CardContent></Card>
                  ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {matView.map((mat, i) => {
                    const cat = CATEGORY_MAP[mat.category] ?? { label: mat.category, color: "bg-muted text-muted-foreground" };
                    return (
                      <Card
                        key={mat.id}
                        className="group hover:shadow-lg hover:border-primary/30 transition-all animate-fade-in flex flex-col"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <CardContent className="p-5 flex-1 flex flex-col">
                          <div className="flex justify-between items-start mb-3">
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${mat.file_type === "pdf" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                              <FileText className="h-5 w-5" />
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${cat.color}`}>{cat.label}</span>
                          </div>
                          <h3 className="font-semibold text-sm text-foreground line-clamp-2 mb-1.5 group-hover:text-primary transition-colors">{mat.title}</h3>
                          {"packages" in mat && mat.packages && mat.packages.length > 0 && (
                            <div className="flex gap-1 flex-wrap mb-1.5">
                              {(mat.packages as StudentPackage[]).map((pkg) => (
                                <span key={pkg} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                                  pkg === "online" ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
                                  : pkg === "advanced" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                                  : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                }`}>
                                  {pkg === "online" ? "Online" : pkg === "advanced" ? "Nâng cao" : "Offline"}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{mat.description}</p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-auto mb-3 flex-wrap">
                            {mat.file_size && <><span>{mat.file_size}</span><span>·</span></>}
                            {mat.download_count > 0 && <><span className="flex items-center gap-1"><Download className="h-3 w-3" />{mat.download_count} lượt</span><span>·</span></>}
                            <span>{formatDate(mat.created_at)}</span>
                          </div>
                          <div className="flex gap-2 pt-3 border-t border-border/50">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-xs h-8"
                              onClick={() => mat.file_url && window.open(mat.file_url, "_blank", "noopener,noreferrer")}
                            >
                              <Eye className="h-3 w-3 mr-1.5" />Xem
                            </Button>
                            <Button
                              size="sm"
                              variant="gradient"
                              className="flex-1 text-xs h-8"
                              onClick={() => {
                                if (!mat.file_url) return;
                                if (mat.id.startsWith("mat_")) void incrementMaterialDownload(mat.id);
                                const a = document.createElement("a");
                                a.href = mat.file_url;
                                a.download = mat.title;
                                a.click();
                              }}
                            >
                              <Download className="h-3 w-3 mr-1.5" />Tải về
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
          )}

          {/* ── Notes ── */}
          {activeTab === "notes" && (
            <div className="space-y-4">
              {notes.length === 0 ? (
                <Card><CardContent className="py-16 text-center text-muted-foreground">
                  <StickyNote className="h-12 w-12 mx-auto opacity-20 mb-3" />
                  <p className="text-sm font-medium">Chưa có ghi chú nào</p>
                </CardContent></Card>
              ) : (
                notes
                  .sort((a, b) =>
                    (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) ||
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  )
                  .map((note, i) => (
                    <Card
                      key={note.id}
                      className={`animate-fade-in hover:shadow-md transition-all ${note.is_pinned ? "border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-900/5" : ""}`}
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <CardContent className="p-5 md:p-6">
                        <div className="flex items-start gap-4">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${note.is_pinned ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" : "bg-primary/10 text-primary"}`}>
                            {note.is_pinned ? <Pin className="h-4 w-4" /> : <StickyNote className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {note.is_pinned && <Badge variant="warning" className="text-[10px]">Đã ghim</Badge>}
                              <span className="text-xs text-muted-foreground">{formatDate(note.created_at)}</span>
                            </div>
                            <h3 className="font-semibold text-foreground">{note.title}</h3>
                            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line leading-relaxed">{note.content}</p>
                            {note.tags?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {note.tags.map((tag: string) => (
                                  <span key={tag} className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                                    <Tag className="h-2.5 w-2.5" />{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
              )}
            </div>
          )}

          {/* ── Attendance ── */}
          {activeTab === "attendance" && (() => {
            // Merge MOCK_ATTENDANCE + localStorage teacher records for this class
            const mockRecs = MOCK_ATTENDANCE
              .filter(a => a.student_id === CURRENT_STUDENT_ID && a.class_id === classId)
              .map(a => ({ date: a.attendance_date, status: a.status as AttendanceStatus }));
            const lsRecs = savedAttendance
              .filter(r => r.class_id === classId && r.student_id === CURRENT_STUDENT_ID)
              .map(r => ({ date: r.date, status: r.status }));
            // localStorage overrides mock for same date
            const lsDates = new Set(lsRecs.map(r => r.date));
            const merged = [...lsRecs, ...mockRecs.filter(r => !lsDates.has(r.date))]
              .sort((a, b) => b.date.localeCompare(a.date));

            const total    = merged.length;
            const present  = merged.filter(r => r.status === "present").length;
            const late     = merged.filter(r => r.status === "late").length;
            const absent   = merged.filter(r => r.status === "absent").length;
            const excused  = merged.filter(r => r.status === "excused").length;
            const attended = present + late;
            // Chuẩn: tỷ lệ = (present + late) / (total - excused) — có phép không tính vắng
            const rate     = total - excused > 0 ? Math.round((attended / (total - excused)) * 100) : 100;

            const rateColor = rate >= 90 ? "from-emerald-500 to-emerald-600"
              : rate >= 75 ? "from-amber-500 to-amber-600"
              : "from-red-500 to-red-600";

            const STATUS_CFG = {
              present: { label: "Có mặt",   Icon: UserCheck, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0" },
              late:    { label: "Đi trễ",   Icon: Timer,     color: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-900/20",     badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0" },
              excused: { label: "Có phép",  Icon: Check,     color: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-50 dark:bg-blue-900/20",       badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0" },
              absent:  { label: "Vắng mặt", Icon: XCircle,   color: "text-red-600 dark:text-red-400",         bg: "bg-red-50 dark:bg-red-900/20",         badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0" },
            };

            return (
              <div className="space-y-6">
                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className={`bg-gradient-to-br ${rateColor} text-white shadow-md border-0`}>
                    <CardContent className="p-5 flex flex-col items-center justify-center text-center">
                      <CheckSquare className="h-6 w-6 opacity-80 mb-2" />
                      <h3 className="text-4xl font-black mb-1">{rate}%</h3>
                      <p className="text-xs font-medium opacity-80 uppercase tracking-wider">Tỷ lệ đi học</p>
                    </CardContent>
                  </Card>
                  {([
                    { count: present, key: "present" },
                    { count: late,    key: "late" },
                    { count: absent,  key: "absent" },
                  ] as const).map(({ count, key }) => {
                    const cfg = STATUS_CFG[key];
                    return (
                      <Card key={key}>
                        <CardContent className="p-5 flex flex-col items-center justify-center text-center">
                          <cfg.Icon className={`h-6 w-6 mb-2 ${cfg.color}`} />
                          <h3 className={`text-3xl font-bold mb-1 ${cfg.color}`}>{count}</h3>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{cfg.label}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* History list */}
                  <div className="lg:col-span-2 space-y-3">
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" /> Lịch sử điểm danh
                    </h3>
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                      {merged.length === 0 ? (
                        <div className="p-10 text-center text-muted-foreground">
                          <CalendarDays className="h-10 w-10 mx-auto opacity-20 mb-3" />
                          <p className="text-sm">Chưa có dữ liệu điểm danh cho lớp này</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border/50">
                          {merged.map((rec, i) => {
                            const cfg = STATUS_CFG[rec.status] ?? STATUS_CFG.absent;
                            const dateObj = new Date(rec.date + "T12:00:00");
                            return (
                              <div key={rec.date + i} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.color}`}>
                                    <cfg.Icon className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-foreground text-sm">
                                      {DAY_VI[schedule.find(sc => DAY_INDEX[sc.day] === dateObj.getDay())?.day ?? ""] || ""} {dateObj.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{cls.subject}</p>
                                  </div>
                                </div>
                                <Badge className={`${cfg.badge} shrink-0 text-xs font-semibold`}>{cfg.label}</Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sidebar */}
                  <div className="space-y-4">
                    <Card>
                      <CardContent className="p-4 space-y-0 divide-y divide-border/50">
                        {[
                          { label: "Tổng số buổi", value: total },
                          { label: "Có mặt",        value: present },
                          { label: "Đi trễ",        value: late },
                          { label: "Vắng mặt",      value: absent },
                          { label: "Tỷ lệ chuyên cần", value: `${rate}%` },
                        ].map(row => (
                          <div key={row.label} className="flex justify-between py-2.5 text-sm">
                            <span className="text-muted-foreground">{row.label}</span>
                            <span className="font-semibold text-foreground">{row.value}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {rate < 80 ? (
                      <Card className="border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/50">
                        <CardContent className="p-5">
                          <div className="flex gap-3">
                            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                            <div>
                              <h4 className="font-semibold text-red-800 dark:text-red-300 text-sm mb-1">Cảnh báo chuyên cần!</h4>
                              <p className="text-xs text-red-700/80 dark:text-red-400/80 leading-relaxed">
                                Tỷ lệ đi học đang dưới 80%. Vắng quá 20% tổng số buổi sẽ không được tham gia thi cuối kỳ.
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50">
                        <CardContent className="p-5">
                          <div className="flex gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <h4 className="font-semibold text-amber-800 dark:text-amber-300 text-sm mb-1">Nội quy chuyên cần</h4>
                              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                                Vắng quá 20% tổng số buổi học sẽ không được phép tham gia thi cuối kỳ.
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Homework ── */}
          {activeTab === "homework" && (
            <div className="space-y-4">
              {sortedClassHomework.length === 0 ? (
                <Card><CardContent className="py-16 text-center text-muted-foreground">
                  <NotebookPen className="h-12 w-12 mx-auto opacity-20 mb-3" />
                  <p className="text-sm font-medium">Lớp này chưa có bài tập nào</p>
                </CardContent></Card>
              ) : (
                <>
                  {/* Bộ lọc trạng thái */}
                  <div className="flex flex-wrap items-center gap-2">
                    {([["all", `Tất cả (${sortedClassHomework.length})`], ["todo", `Chưa làm (${incompleteClassHomework.length})`], ["done", `Đã xong (${hwDoneCount})`]] as const).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => setHwFilter(k)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${hwFilter === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {hwView.length === 0 ? (
                    <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Không có bài tập nào phù hợp bộ lọc.</CardContent></Card>
                  ) : hwView.map((hw, i) => {
                  // Bài làm câu hỏi trên hệ thống
                  if (hw.kind === "exam") {
                    return (
                      <Card key={hw.id} className="animate-fade-in hover:shadow-md transition-all" style={{ animationDelay: `${i * 60}ms` }}>
                        <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                            <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              <NotebookPen className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                                <h3 className="font-semibold text-foreground">{hw.title}</h3>
                                {hw.exam_done ? (
                                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                                    Đã làm{hw.exam_score != null ? ` · ${hw.exam_score}/${hw.exam_total}` : ""}
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">Chưa làm</span>
                                )}
                              </div>
                              {hw.description && <p className="text-sm text-muted-foreground leading-relaxed mb-2">{hw.description}</p>}
                              <p className="flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 mb-3">
                                <PenSquare className="h-3.5 w-3.5" /> Làm trên hệ thống
                              </p>
                              <Link href={`/student/classes/${classId}/exam/${hw.id}`}>
                                <Button size="sm" variant={hw.exam_done ? "outline" : "gradient"}>
                                  <PlayCircle className="h-3.5 w-3.5 mr-1.5" /> {hw.exam_done ? "Xem lại / Làm lại" : "Làm bài"}
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }

                  // Bài nộp file
                  const sub     = submissions.find(s => s.homework_id === hw.id && s.student_id === CURRENT_STUDENT_ID);
                  const returned = sub?.status === "returned";
                  const graded   = sub?.status === "graded";
                  const days    = Math.ceil((new Date(hw.due_date).setHours(23,59,59) - Date.now()) / 86400000);
                  const overdue = !sub && days < 0;

                  return (
                    <Card
                      key={hw.id}
                      className="animate-fade-in hover:shadow-md transition-all"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${returned || overdue ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : graded ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-primary/10 text-primary"}`}>
                            {returned || overdue ? <AlertCircle className="h-5 w-5" />
                              : graded ? <CheckCircle2 className="h-5 w-5" />
                              : <NotebookPen className="h-5 w-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                              <h3 className="font-semibold text-foreground">{hw.title}</h3>
                              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                                returned || overdue ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                : graded ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                                : sub ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                              }`}>
                                {returned ? "Cần làm lại"
                                  : graded ? "Đã chấm"
                                  : sub ? "Đã nộp"
                                  : overdue ? "Quá hạn"
                                  : days === 0 ? "Hôm nay"
                                  : `Còn ${days} ngày`}
                              </span>
                            </div>
                            {hw.description && <p className="text-sm text-muted-foreground leading-relaxed mb-3">{hw.description}</p>}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                Hạn nộp: <strong className="text-foreground ml-1">{formatDate(hw.due_date)}</strong>
                              </span>
                            </div>

                            {/* Feedback if graded */}
                            {sub?.feedback && (
                              <div className="mt-3 p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40 text-sm">
                                <p className="font-semibold text-emerald-700 dark:text-emerald-400 text-xs mb-1">Nhận xét:</p>
                                <p className="italic text-foreground/80">"{sub.feedback}"</p>
                              </div>
                            )}

                            <div className="mt-3">
                              <Link href="/student/homework">
                                <Button size="sm" variant={!sub || returned ? "gradient" : "outline"}>
                                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> {!sub || returned ? "Đến trang nộp bài" : "Xem bài nộp"}
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </PortalLayout>
  );
}
