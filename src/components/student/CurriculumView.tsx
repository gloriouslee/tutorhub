"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStudentCurriculum, type CurriculumLesson } from "@/lib/storage";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  FileText,
  ListTree,
  Lock,
  NotebookPen,
  PenSquare,
  PlayCircle,
  Sparkles,
  Video,
} from "lucide-react";

type LessonType = CurriculumLesson["type"];

const LESSON_META: Record<LessonType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  lecture: { label: "Bài giảng", icon: PlayCircle, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-950" },
  material: { label: "Tài liệu", icon: FileText, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950" },
  homework: { label: "Bài tập", icon: NotebookPen, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-950" },
  solution: { label: "Video chữa bài", icon: Video, color: "text-violet-600", bg: "bg-violet-100 dark:bg-violet-950" },
  exam: { label: "Bài kiểm tra", icon: PenSquare, color: "text-rose-600", bg: "bg-rose-100 dark:bg-rose-950" },
};

interface Props {
  classId: string;
  watched: Set<string>;
  submissions: { homework_id: string; status: "submitted" | "graded" | "returned" }[];
}

function examLocked(lesson: CurriculumLesson, completed: boolean) {
  if (lesson.type !== "exam" || completed) return false;
  const status = lesson.exam_status ?? "draft";
  if (status === "open") return false;
  if (status === "draft" && lesson.exam_opens_at) return new Date(lesson.exam_opens_at) > new Date();
  return true;
}

export default function CurriculumView({ classId, watched, submissions }: Props) {
  const router = useRouter();
  const [chapters, setChapters] = useState<Awaited<ReturnType<typeof getStudentCurriculum>>>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getStudentCurriculum(classId)
      .then((data) => {
        if (cancelled) return;
        setChapters(data);
        const open = new Set<string>();
        if (data[0]) {
          open.add(data[0].id);
          if (data[0].sessions[0]) open.add(data[0].sessions[0].id);
        }
        setExpanded(open);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [classId]);

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function isCompleted(lesson: CurriculumLesson) {
    if (lesson.type === "homework") {
      return submissions.some((submission) => submission.homework_id === lesson.id && submission.status !== "returned");
    }
    return watched.has(lesson.id);
  }

  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <div className="h-44 animate-pulse rounded-2xl bg-muted/75" />
        <div className="h-20 animate-pulse rounded-xl bg-muted/60" />
        <div className="h-20 animate-pulse rounded-xl bg-muted/45" />
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border/60 py-16 text-center">
        <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/25" />
        <p className="text-sm font-medium text-muted-foreground">Giáo viên chưa thiết lập lộ trình cho lớp này.</p>
      </div>
    );
  }

  const allLessons = chapters.flatMap((chapter) => chapter.sessions.flatMap((session) => session.lessons));
  const completedCount = allLessons.filter(isCompleted).length;
  const totalCount = allLessons.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const actionLabel = completedCount === 0 ? "Bắt đầu học" : completedCount >= totalCount ? "Ôn tập lại" : "Tiếp tục học";

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.12] via-card to-card p-5 shadow-sm md:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
              <Sparkles className="h-4 w-4" /> Chế độ học tập trung
            </div>
            <h2 className="mt-2 text-xl font-bold text-foreground md:text-2xl">Học theo lộ trình của lớp</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Video, tài liệu, bài tập và bài kiểm tra được sắp xếp theo đúng từng buổi học. Tiến độ và ghi chú sẽ tự động được lưu.
            </p>
          </div>
          <div className="w-full shrink-0 rounded-xl border border-border/60 bg-background/80 p-4 backdrop-blur lg:w-[360px]">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Tiến độ của bạn</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{completionPct}%</p>
              </div>
              <p className="text-xs font-semibold text-primary">{completedCount}/{totalCount} bài</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary/10">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completionPct}%` }} />
            </div>
            <Button
              className="mt-4 w-full"
              variant="gradient"
              onClick={() => router.push(`/student/classes/${classId}/learn/start`)}
            >
              <PlayCircle className="mr-1.5 h-4 w-4" /> {actionLabel}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <div className="flex items-center gap-2">
            <ListTree className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Nội dung lộ trình</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{chapters.length} chương · {totalCount} nội dung</p>
        </div>
        <Badge variant="outline" className="text-[10px]">Bấm vào bài để mở player</Badge>
      </div>

      <div className="space-y-3">
        {chapters.map((chapter, chapterIndex) => {
          const chapterLessons = chapter.sessions.flatMap((session) => session.lessons);
          const chapterDone = chapterLessons.filter(isCompleted).length;
          const chapterOpen = expanded.has(chapter.id);
          return (
            <section key={chapter.id} className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
              <button
                type="button"
                onClick={() => toggle(chapter.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-muted/30"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                  {chapterIndex + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-bold text-foreground">{chapter.title}</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">{chapter.sessions.length} buổi · {chapterLessons.length} nội dung</p>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">{chapterDone}/{chapterLessons.length}</span>
                {chapterDone === chapterLessons.length && chapterLessons.length > 0 && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                {chapterOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>

              {chapterOpen && (
                <div className="border-t border-border/60 bg-muted/10 p-2 md:p-3">
                  {chapter.sessions.map((session, sessionIndex) => {
                    const sessionOpen = expanded.has(session.id);
                    const sessionDone = session.lessons.filter(isCompleted).length;
                    if (session.lessons.length === 0) return null;
                    return (
                      <div key={session.id} className="mb-2 overflow-hidden rounded-xl border border-border/60 bg-background last:mb-0">
                        <button
                          type="button"
                          onClick={() => toggle(session.id)}
                          className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition hover:bg-muted/30"
                        >
                          {sessionOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                          <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">Buổi {sessionIndex + 1}: {session.title}</span>
                          <span className="text-[10px] text-muted-foreground">{sessionDone}/{session.lessons.length}</span>
                        </button>

                        {sessionOpen && (
                          <div className="grid gap-2 border-t border-border/50 p-2.5 md:grid-cols-2 xl:grid-cols-3">
                            {session.lessons.map((lesson) => {
                              const completed = isCompleted(lesson);
                              const locked = examLocked(lesson, completed);
                              const meta = LESSON_META[lesson.type];
                              return (
                                <button
                                  type="button"
                                  key={lesson.id}
                                  disabled={locked}
                                  onClick={() => router.push(`/student/classes/${classId}/learn/${lesson.id}`)}
                                  className={`group flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition ${
                                    locked
                                      ? "cursor-not-allowed border-border/50 bg-muted/25 opacity-60"
                                      : completed
                                        ? "border-emerald-200/80 bg-emerald-50/45 hover:border-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/20"
                                        : "border-border/60 bg-card hover:border-primary/30 hover:bg-primary/[0.04]"
                                  }`}
                                >
                                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.bg}`}>
                                    <meta.icon className={`h-4 w-4 ${meta.color}`} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground group-hover:text-primary">{lesson.title}</p>
                                    <p className="mt-1 text-[10px] text-muted-foreground">{meta.label}</p>
                                  </div>
                                  {completed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : locked ? <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
