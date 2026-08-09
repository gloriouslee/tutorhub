"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getStudentCurriculum,
  getStudentLessonProgress,
  saveStudentLessonProgress,
  type CurriculumChapter,
  type CurriculumLesson,
  type StudentLessonProgress,
} from "@/lib/storage";
import { getSubmissionsByStudent, type SubmissionRecord } from "@/lib/supabase/submissions";
import { useStudentContext } from "@/hooks/useStudentContext";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  ListTree,
  Loader2,
  Lock,
  Menu,
  NotebookPen,
  PanelRightClose,
  PanelRightOpen,
  PenSquare,
  PlayCircle,
  Save,
  StickyNote,
  Video,
  X,
} from "lucide-react";

type FlatLesson = CurriculumLesson & {
  chapterId: string;
  chapterTitle: string;
  sessionId: string;
  sessionTitle: string;
  sessionDate?: string;
};

type Props = {
  classId: string;
  requestedLessonId: string;
};

const LESSON_META: Record<CurriculumLesson["type"], { label: string; icon: React.ElementType; color: string; bg: string }> = {
  lecture: { label: "Bài giảng", icon: PlayCircle, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-950" },
  solution: { label: "Video chữa bài", icon: Video, color: "text-violet-600", bg: "bg-violet-100 dark:bg-violet-950" },
  material: { label: "Tài liệu", icon: FileText, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950" },
  homework: { label: "Bài tập", icon: NotebookPen, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-950" },
  exam: { label: "Bài kiểm tra", icon: GraduationCap, color: "text-rose-600", bg: "bg-rose-100 dark:bg-rose-950" },
};

function safeMediaUrl(value?: string) {
  if (!value) return null;
  if (value.startsWith("/api/files?")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function youtubeEmbedUrl(value?: string) {
  const safe = safeMediaUrl(value);
  if (!safe || safe.startsWith("/")) return null;
  try {
    const url = new URL(safe);
    const host = url.hostname.replace(/^www\./, "");
    const id = host === "youtu.be"
      ? url.pathname.split("/").filter(Boolean)[0]
      : host === "youtube.com" || host === "m.youtube.com"
        ? url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1]
        : null;
    if (!id) return null;
    const origin = typeof window === "undefined" ? "" : `&origin=${encodeURIComponent(window.location.origin)}`;
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1&playsinline=1${origin}`;
  } catch {
    return null;
  }
}

function flattenLessons(chapters: CurriculumChapter[]): FlatLesson[] {
  return chapters.flatMap((chapter) =>
    chapter.sessions.flatMap((session) =>
      session.lessons.map((lesson) => ({
        ...lesson,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        sessionId: session.id,
        sessionTitle: session.title,
        sessionDate: session.date,
      })),
    ),
  );
}

function isExamLocked(lesson: FlatLesson, completed: boolean) {
  if (lesson.type !== "exam" || completed) return false;
  const status = lesson.exam_status ?? "draft";
  if (status === "open") return false;
  if (status === "draft" && lesson.exam_opens_at) {
    return new Date(lesson.exam_opens_at) > new Date();
  }
  return true;
}

function CourseOutline({
  chapters,
  activeLessonId,
  completedIds,
  expanded,
  onToggle,
  onSelect,
}: {
  chapters: CurriculumChapter[];
  activeLessonId: string;
  completedIds: Set<string>;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (lessonId: string) => void;
}) {
  return (
    <div className="divide-y divide-border/60">
      {chapters.map((chapter, chapterIndex) => {
        const chapterLessons = chapter.sessions.flatMap((session) => session.lessons);
        const chapterDone = chapterLessons.filter((lesson) => completedIds.has(lesson.id)).length;
        const chapterOpen = expanded.has(chapter.id);

        return (
          <section key={chapter.id}>
            <button
              type="button"
              onClick={() => onToggle(chapter.id)}
              className="flex w-full items-start gap-2.5 bg-card px-4 py-3.5 text-left transition hover:bg-muted/35"
            >
              {chapterOpen
                ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Chương {chapterIndex + 1}</p>
                <p className="mt-0.5 text-sm font-bold leading-snug text-foreground">{chapter.title}</p>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {chapterDone}/{chapterLessons.length}
              </span>
            </button>

            {chapterOpen && chapter.sessions.map((session, sessionIndex) => {
              const sessionOpen = expanded.has(session.id);
              const sessionDone = session.lessons.filter((lesson) => completedIds.has(lesson.id)).length;
              return (
                <div key={session.id} className="border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => onToggle(session.id)}
                    className="flex w-full items-center gap-2 bg-muted/20 px-4 py-2.5 text-left transition hover:bg-muted/40"
                  >
                    {sessionOpen
                      ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                      Buổi {sessionIndex + 1}: {session.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{sessionDone}/{session.lessons.length}</span>
                  </button>

                  {sessionOpen && (
                    <div className="py-1.5">
                      {session.lessons.map((lesson) => {
                        const done = completedIds.has(lesson.id);
                        const active = activeLessonId === lesson.id;
                        const meta = LESSON_META[lesson.type];
                        const locked = isExamLocked({
                          ...lesson,
                          chapterId: chapter.id,
                          chapterTitle: chapter.title,
                          sessionId: session.id,
                          sessionTitle: session.title,
                          sessionDate: session.date,
                        }, done);
                        return (
                          <button
                            type="button"
                            key={lesson.id}
                            onClick={() => onSelect(lesson.id)}
                            aria-current={active ? "page" : undefined}
                            className={`flex w-full items-center gap-2.5 border-l-2 px-4 py-2.5 text-left transition ${
                              active
                                ? "border-primary bg-primary/[0.08]"
                                : "border-transparent hover:bg-muted/35"
                            }`}
                          >
                            {done
                              ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                              : locked
                                ? <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                : <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                              <meta.icon className={`h-3.5 w-3.5 ${meta.color}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`line-clamp-2 text-xs font-medium leading-snug ${active ? "text-primary" : done ? "text-muted-foreground" : "text-foreground"}`}>
                                {lesson.title}
                              </p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">{meta.label}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

export default function ClassLearningPlayer({ classId, requestedLessonId }: Props) {
  const router = useRouter();
  const { studentId, myClasses, assignedClassId, ready } = useStudentContext();
  const [chapters, setChapters] = useState<CurriculumChapter[]>([]);
  const [progress, setProgress] = useState<StudentLessonProgress[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [desktopOutlineOpen, setDesktopOutlineOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [completing, setCompleting] = useState(false);
  const visitedLessonRef = useRef("");
  const noteLessonRef = useRef("");

  const cls = ready ? myClasses.find((item) => item.id === classId) ?? null : undefined;
  const hasAccess = cls
    ? (cls.student_ids ?? []).includes(studentId) || assignedClassId === classId
    : false;

  useEffect(() => {
    if (!ready || !studentId || !cls || !hasAccess) return;
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    Promise.all([
      getStudentCurriculum(classId),
      getStudentLessonProgress(classId),
      getSubmissionsByStudent(studentId),
    ])
      .then(([curriculum, lessonProgress, studentSubmissions]) => {
        if (cancelled) return;
        setChapters(curriculum);
        setProgress(lessonProgress);
        setSubmissions(studentSubmissions);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Không thể tải phiên học. Vui lòng thử lại.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [assignedClassId, classId, cls, hasAccess, ready, studentId]);

  const lessons = useMemo(() => flattenLessons(chapters), [chapters]);
  const progressById = useMemo(
    () => new Map(progress.map((item) => [item.lesson_id, item])),
    [progress],
  );
  const completedIds = useMemo(() => {
    const lessonTypeById = new Map(lessons.map((lesson) => [lesson.id, lesson.type]));
    const ids = new Set(
      progress
        .filter((item) => item.completed && lessonTypeById.get(item.lesson_id) !== "homework")
        .map((item) => item.lesson_id),
    );
    for (const submission of submissions) {
      if (submission.status !== "returned") ids.add(submission.homework_id);
    }
    return ids;
  }, [lessons, progress, submissions]);

  const fallbackLesson = useMemo(() => {
    const visibleIds = new Set(lessons.map((lesson) => lesson.id));
    const mostRecentIncomplete = [...progress]
      .filter((item) => visibleIds.has(item.lesson_id) && !completedIds.has(item.lesson_id))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    return lessons.find((lesson) => lesson.id === mostRecentIncomplete?.lesson_id)
      ?? lessons.find((lesson) => !completedIds.has(lesson.id))
      ?? lessons[0]
      ?? null;
  }, [completedIds, lessons, progress]);
  const activeLesson = lessons.find((lesson) => lesson.id === requestedLessonId) ?? fallbackLesson;
  const activeIndex = activeLesson ? lessons.findIndex((lesson) => lesson.id === activeLesson.id) : -1;
  const previousLesson = activeIndex > 0 ? lessons[activeIndex - 1] : null;
  const nextLesson = activeIndex >= 0 ? lessons[activeIndex + 1] ?? null : null;
  const completedCount = lessons.filter((lesson) => completedIds.has(lesson.id)).length;
  const completionPct = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;
  const activeCompleted = activeLesson ? completedIds.has(activeLesson.id) : false;
  const activeLocked = activeLesson ? isExamLocked(activeLesson, activeCompleted) : false;
  const activeMeta = activeLesson ? LESSON_META[activeLesson.type] : null;

  useEffect(() => {
    if (!activeLesson || noteLessonRef.current === activeLesson.id) return;
    noteLessonRef.current = activeLesson.id;
    const next = new Set<string>([activeLesson.chapterId, activeLesson.sessionId]);
    setExpanded((current) => new Set([...current, ...next]));
    setNoteDraft(progressById.get(activeLesson.id)?.notes ?? "");
    setNoteState("idle");
  }, [activeLesson, progressById]);

  useEffect(() => {
    if (!activeLesson || loading) return;
    if (requestedLessonId !== activeLesson.id) {
      router.replace(`/student/classes/${classId}/learn/${activeLesson.id}`, { scroll: false });
    }
  }, [activeLesson, classId, loading, requestedLessonId, router]);

  useEffect(() => {
    if (!activeLesson || loading || visitedLessonRef.current === activeLesson.id) return;
    visitedLessonRef.current = activeLesson.id;
    const existing = progressById.get(activeLesson.id);
    void saveStudentLessonProgress(classId, activeLesson.id, {
      completed: completedIds.has(activeLesson.id),
      notes: existing?.notes ?? "",
    }).then((saved) => {
      setProgress((current) => [saved, ...current.filter((item) => item.lesson_id !== saved.lesson_id)]);
    }).catch(() => undefined);
  }, [activeLesson, classId, completedIds, loading, progressById]);

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveCurrentNote() {
    if (!activeLesson) return;
    const currentNote = progressById.get(activeLesson.id)?.notes ?? "";
    if (noteDraft.trim() === currentNote) return;
    setNoteState("saving");
    try {
      const saved = await saveStudentLessonProgress(classId, activeLesson.id, {
        completed: completedIds.has(activeLesson.id),
        notes: noteDraft,
      });
      setProgress((current) => [saved, ...current.filter((item) => item.lesson_id !== saved.lesson_id)]);
      setNoteDraft(saved.notes);
      setNoteState("saved");
    } catch {
      setNoteState("error");
    }
  }

  async function selectLesson(lessonId: string) {
    await saveCurrentNote();
    setOutlineOpen(false);
    router.replace(`/student/classes/${classId}/learn/${lessonId}`, { scroll: false });
  }

  async function markCompleteAndContinue() {
    if (!activeLesson || activeLesson.type === "homework" || activeLesson.type === "exam") return;
    setCompleting(true);
    try {
      const saved = await saveStudentLessonProgress(classId, activeLesson.id, {
        completed: true,
        notes: noteDraft,
      });
      setProgress((current) => [saved, ...current.filter((item) => item.lesson_id !== saved.lesson_id)]);
      if (nextLesson) router.replace(`/student/classes/${classId}/learn/${nextLesson.id}`, { scroll: false });
    } finally {
      setCompleting(false);
    }
  }

  function openLessonAction() {
    if (!activeLesson) return;
    if (activeLesson.type === "exam") {
      router.push(`/student/classes/${classId}/exam/${activeLesson.id}`);
      return;
    }
    if (activeLesson.type === "homework") {
      router.push(`/student/classes/${classId}?tab=homework`);
    }
  }

  if (!ready || cls === undefined) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background" aria-busy="true">
        <div className="text-center">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-primary" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">Đang chuẩn bị phiên học…</p>
        </div>
      </main>
    );
  }

  if (!cls || !hasAccess) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-center">
        <div>
          <Lock className="mx-auto h-12 w-12 text-muted-foreground/35" />
          <h1 className="mt-4 text-lg font-bold text-foreground">Bạn không có quyền truy cập lớp này</h1>
          <Button className="mt-4" variant="outline" onClick={() => router.push("/student/classes")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Quay lại danh sách lớp
          </Button>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background" aria-busy="true">
        <div className="text-center">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-primary" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">Đang chuẩn bị phiên học…</p>
        </div>
      </main>
    );
  }

  if (loadError || !activeLesson || lessons.length === 0) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-center">
        <div>
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/35" />
          <h1 className="mt-4 text-lg font-bold text-foreground">{loadError || "Lớp chưa có nội dung để bắt đầu học"}</h1>
          <Button className="mt-4" variant="outline" onClick={() => router.push(`/student/classes/${classId}?tab=curriculum`)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Quay lại lộ trình
          </Button>
        </div>
      </main>
    );
  }

  const videoUrl = safeMediaUrl(activeLesson.video_url);
  const youtubeUrl = youtubeEmbedUrl(activeLesson.video_url);
  const fileUrl = safeMediaUrl(activeLesson.file_url);
  const isPdf = Boolean(fileUrl && (/\.pdf(?:$|\?)/i.test(fileUrl) || activeLesson.file_url?.includes("type=application%2Fpdf")));
  const directVideo = Boolean(videoUrl && !youtubeUrl && /\.(mp4|webm|ogg)(?:$|\?)/i.test(videoUrl));
  const ActiveIcon = activeMeta?.icon ?? BookOpen;

  const outline = (
    <CourseOutline
      chapters={chapters}
      activeLessonId={activeLesson.id}
      completedIds={completedIds}
      expanded={expanded}
      onToggle={toggleExpanded}
      onSelect={(lessonId) => void selectLesson(lessonId)}
    />
  );

  return (
    <main className="flex h-dvh min-h-[560px] flex-col overflow-hidden bg-background text-foreground">
      <header className="z-20 flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-slate-950 px-3 text-white shadow-sm md:px-5">
        <button
          type="button"
          onClick={() => router.push(`/student/classes/${classId}?tab=curriculum`)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
          aria-label="Thoát phiên học"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="h-7 w-px bg-white/10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold md:text-base">{cls.class_name}</p>
          <p className="hidden truncate text-[11px] text-white/55 sm:block">{activeLesson.title}</p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-xs font-semibold text-white/70">{completedCount}/{lessons.length} bài</span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completionPct}%` }} />
          </div>
          <span className="min-w-9 text-xs font-bold text-primary">{completionPct}%</span>
        </div>
        <button
          type="button"
          onClick={() => setNotesOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <StickyNote className="h-4 w-4" /><span className="hidden sm:inline">Ghi chú</span>
        </button>
        <button
          type="button"
          onClick={() => setDesktopOutlineOpen((open) => !open)}
          className="hidden h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white lg:flex"
        >
          {desktopOutlineOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          Nội dung
        </button>
        <button
          type="button"
          onClick={() => setOutlineOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Mở nội dung khóa học"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="min-w-0 flex-1 overflow-y-auto bg-background">
          <div className="bg-black">
            {youtubeUrl ? (
              <div className="relative mx-auto aspect-video w-full max-w-[1280px]">
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={youtubeUrl}
                  title={activeLesson.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : directVideo && videoUrl ? (
              <video
                className="mx-auto aspect-video max-h-[calc(100dvh-190px)] w-full max-w-[1280px] bg-black"
                controls
                preload="metadata"
                src={videoUrl}
              />
            ) : activeLesson.type === "material" && isPdf && fileUrl ? (
              <iframe
                className="h-[calc(100dvh-230px)] min-h-[420px] w-full bg-white"
                src={fileUrl}
                title={activeLesson.title}
              />
            ) : (
              <div className="flex min-h-[clamp(280px,55vh,620px)] items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 text-center">
                <div className="max-w-lg">
                  <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${activeMeta?.bg ?? "bg-white/10"}`}>
                    {activeLocked ? <Lock className="h-8 w-8 text-muted-foreground" /> : <ActiveIcon className={`h-8 w-8 ${activeMeta?.color ?? "text-primary"}`} />}
                  </div>
                  <h2 className="mt-4 text-xl font-bold text-white">{activeLesson.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">
                    {activeLocked
                      ? "Nội dung này chưa đến thời gian mở hoặc đã được giáo viên đóng."
                      : activeLesson.type === "homework"
                        ? "Đọc yêu cầu bên dưới và mở trang bài tập để nộp bài."
                        : activeLesson.type === "exam"
                          ? "Bạn sẽ chuyển sang phòng làm bài an toàn khi bắt đầu."
                          : activeLesson.type === "material"
                            ? "Tài liệu này chưa có bản xem trước trực tiếp."
                            : "Giáo viên chưa đính kèm video cho nội dung này."}
                  </p>
                  {activeLesson.type === "material" && fileUrl && (
                    <Button className="mt-5" variant="outline" asChild>
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1.5 h-4 w-4" /> Mở tài liệu
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mx-auto max-w-5xl px-4 py-5 md:px-7 md:py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`border-0 text-[10px] ${activeMeta?.bg} ${activeMeta?.color}`}>
                    <ActiveIcon className="mr-1 h-3 w-3" />{activeMeta?.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{activeLesson.chapterTitle}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                  <span className="text-xs text-muted-foreground">{activeLesson.sessionTitle}</span>
                </div>
                <h1 className="mt-2 text-xl font-bold leading-snug text-foreground md:text-2xl">{activeLesson.title}</h1>
                {activeLesson.description && (
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{activeLesson.description}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {videoUrl && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={videoUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1.5 h-4 w-4" /> Tab mới
                    </a>
                  </Button>
                )}
                {fileUrl && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" download>
                      <Download className="mr-1.5 h-4 w-4" /> Tải tài liệu
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {(activeLesson.type === "homework" || activeLesson.type === "exam") && (
              <div className={`mt-5 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${activeCompleted ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-border bg-muted/25"}`}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${activeCompleted ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900" : activeMeta?.bg}`}>
                    {activeCompleted ? <CheckCircle2 className="h-5 w-5" /> : activeLesson.type === "exam" ? <PenSquare className="h-5 w-5 text-rose-600" /> : <NotebookPen className="h-5 w-5 text-amber-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{activeCompleted ? "Đã hoàn thành" : activeLocked ? "Chưa thể bắt đầu" : "Sẵn sàng thực hiện"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {activeCompleted
                        ? "Kết quả đã được ghi nhận vào tiến độ của bạn."
                        : activeLesson.type === "exam"
                          ? "Tiến độ chỉ được cập nhật sau khi bạn nộp bài."
                          : "Tiến độ chỉ được cập nhật sau khi bạn nộp bài tập."}
                    </p>
                  </div>
                </div>
                {!activeCompleted && (
                  <Button size="sm" disabled={activeLocked} onClick={openLessonAction}>
                    {activeLesson.type === "exam" ? <PenSquare className="mr-1.5 h-4 w-4" /> : <NotebookPen className="mr-1.5 h-4 w-4" />}
                    {activeLesson.type === "exam" ? "Bắt đầu làm bài" : "Mở trang bài tập"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>

        {desktopOutlineOpen && (
          <aside className="hidden w-[360px] shrink-0 flex-col border-l border-border bg-muted/15 lg:flex">
            <div className="shrink-0 border-b border-border bg-card px-4 py-3.5">
              <div className="flex items-center gap-2">
                <ListTree className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Nội dung khóa học</h2>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completionPct}%` }} />
                </div>
                <span className="text-[11px] font-semibold text-primary">{completedCount}/{lessons.length}</span>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{outline}</div>
          </aside>
        )}
      </div>

      <footer className="z-20 flex h-16 shrink-0 items-center gap-2 border-t border-border bg-card/95 px-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur md:px-5">
        <Button
          size="sm"
          variant="outline"
          disabled={!previousLesson}
          onClick={() => previousLesson && void selectLesson(previousLesson.id)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Bài trước</span>
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-xs font-semibold text-foreground">{activeIndex + 1}. {activeLesson.title}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Bài {activeIndex + 1} / {lessons.length}</p>
        </div>
        {activeLesson.type === "homework" || activeLesson.type === "exam" ? (
          activeCompleted ? (
            <Button size="sm" disabled={!nextLesson} onClick={() => nextLesson && void selectLesson(nextLesson.id)}>
              Bài tiếp <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" disabled={activeLocked} onClick={openLessonAction}>
              {activeLesson.type === "exam" ? "Làm bài" : "Nộp bài"}<ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )
        ) : activeCompleted ? (
          <Button size="sm" disabled={!nextLesson} onClick={() => nextLesson && void selectLesson(nextLesson.id)}>
            Bài tiếp <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm" disabled={completing} onClick={() => void markCompleteAndContinue()}>
            {completing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
            <span className="hidden sm:inline">Hoàn thành & tiếp tục</span><span className="sm:hidden">Hoàn thành</span>
          </Button>
        )}
      </footer>

      {outlineOpen && (
        <div className="fixed inset-0 z-40 bg-black/45 lg:hidden" onClick={() => setOutlineOpen(false)}>
          <aside className="ml-auto flex h-full w-[min(92vw,380px)] flex-col bg-background shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
              <div>
                <p className="text-sm font-bold text-foreground">Nội dung khóa học</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{completedCount}/{lessons.length} bài · {completionPct}%</p>
              </div>
              <button type="button" onClick={() => setOutlineOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Đóng nội dung">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{outline}</div>
          </aside>
        </div>
      )}

      {notesOpen && (
        <div className="fixed inset-0 z-50 bg-black/45" onClick={() => setNotesOpen(false)}>
          <aside className="ml-auto flex h-full w-[min(94vw,440px)] flex-col bg-background shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-amber-500" />
                <div>
                  <p className="text-sm font-bold text-foreground">Ghi chú bài học</p>
                  <p className="max-w-[280px] truncate text-[11px] text-muted-foreground">{activeLesson.title}</p>
                </div>
              </div>
              <button type="button" onClick={() => setNotesOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Đóng ghi chú">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <textarea
                className="min-h-[260px] flex-1 resize-none rounded-xl border border-border bg-muted/20 p-4 text-sm leading-relaxed text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                value={noteDraft}
                onChange={(event) => { setNoteDraft(event.target.value); setNoteState("idle"); }}
                onBlur={() => void saveCurrentNote()}
                placeholder="Ghi lại công thức, ý chính hoặc câu hỏi của bạn…"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className={`text-xs ${noteState === "error" ? "text-rose-600" : "text-muted-foreground"}`}>
                  {noteState === "saving" ? "Đang lưu…" : noteState === "saved" ? "Đã lưu ghi chú" : noteState === "error" ? "Không thể lưu ghi chú" : "Ghi chú được lưu riêng cho bài này"}
                </p>
                <Button size="sm" onClick={() => void saveCurrentNote()} disabled={noteState === "saving"}>
                  {noteState === "saving" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                  Lưu ghi chú
                </Button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
