"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getStudentCurriculum, type CurriculumLesson } from "@/lib/storage";
import {
  ChevronDown, ChevronRight, PlayCircle, FileText,
  ClipboardList, Video, CheckCircle2, ExternalLink,
  Download, BookOpen, Circle, CalendarDays, PenSquare, StickyNote, X,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

type LessonType = CurriculumLesson["type"];

const LESSON_META: Record<LessonType, { label: string; icon: React.ElementType; color: string }> = {
  lecture:  { label: "Bài giảng",      icon: PlayCircle,    color: "text-blue-600 dark:text-blue-400" },
  material: { label: "Tài liệu",       icon: FileText,      color: "text-emerald-600 dark:text-emerald-400" },
  homework: { label: "Bài tập",        icon: ClipboardList, color: "text-amber-600 dark:text-amber-400" },
  solution: { label: "Video chữa bài", icon: Video,         color: "text-violet-600 dark:text-violet-400" },
  exam:     { label: "Bài thi",        icon: PenSquare,     color: "text-rose-600 dark:text-rose-400" },
};

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /[?&]v=([^&#]+)/,
    /youtu\.be\/([^?&#/]+)/,
    /embed\/([^?&#/]+)/,
    /shorts\/([^?&#/]+)/,
    /live\/([^?&#/]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Embed URL with an explicit `origin` (YouTube requires it for many embeds — its
// absence is a common cause of "player configuration" errors like 153) and the
// privacy-enhanced nocookie host. No autoplay (avoids autoplay-policy failures).
function ytEmbedSrc(id: string): string {
  const origin = typeof window !== "undefined" ? `&origin=${encodeURIComponent(window.location.origin)}` : "";
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1${origin}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  classId: string;
  watched: Set<string>;
  onWatch: (id: string, url?: string) => void;
  submissions: { homework_id: string }[];
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CurriculumView({ classId, watched, onWatch, submissions }: Props) {
  const [chapters,     setChapters]     = useState<Awaited<ReturnType<typeof getStudentCurriculum>>>([]);
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set());
  const [activeLesson, setActiveLesson] = useState<CurriculumLesson | null>(null);

  useEffect(() => {
    (async () => {
      const data = await getStudentCurriculum(classId);
      setChapters(data);
      const ids = new Set<string>();
      if (data[0]) {
        ids.add(data[0].id);
        if (data[0].sessions[0]) ids.add(data[0].sessions[0].id);
      }
      setExpanded(ids);
    })();
  }, [classId]);

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function isCompleted(lesson: CurriculumLesson): boolean {
    if (lesson.type === "homework") return submissions.some(s => s.homework_id === lesson.id);
    return watched.has(lesson.id);
  }

  function handlePlay(lesson: CurriculumLesson) {
    onWatch(lesson.id, lesson.video_url);
    const ytId = getYouTubeId(lesson.video_url ?? "");
    if (ytId) {
      setActiveLesson(lesson);
    } else if (lesson.video_url) {
      window.open(lesson.video_url, "_blank", "noopener,noreferrer");
    }
  }

  const router = useRouter();

  function handleAction(lesson: CurriculumLesson) {
    if (lesson.type === "exam") {
      router.push(`/student/classes/${classId}/exam/${lesson.id}`);
    } else if (lesson.type === "lecture" || lesson.type === "solution") {
      handlePlay(lesson);
    } else if (lesson.type === "material" && lesson.file_url) {
      window.open(lesson.file_url, "_blank", "noopener,noreferrer");
      onWatch(lesson.id);
    } else {
      onWatch(lesson.id);
    }
  }

  if (chapters.length === 0) {
    return (
      <div className="py-16 text-center border-2 border-dashed border-border/50 rounded-2xl">
        <BookOpen className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Giáo viên chưa thiết lập lộ trình cho lớp này.</p>
      </div>
    );
  }

  const allPublished  = chapters.flatMap(ch => ch.sessions.flatMap(s => s.lessons));
  const completedCount = allPublished.filter(l => isCompleted(l)).length;
  const totalCount     = allPublished.length;
  const pct            = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const activeYtId = activeLesson ? getYouTubeId(activeLesson.video_url ?? "") : null;

  return (
    <>
    <div className="flex flex-col lg:flex-row border border-border rounded-xl overflow-hidden bg-card lg:h-[600px]">
      {/* Left: video + notes (desktop only — on mobile it opens as a full-screen overlay) */}
      <div className="hidden lg:flex flex-1 flex-col min-w-0 min-h-0 border-r border-border">
        {activeLesson && activeYtId ? (
          <div className="relative w-full aspect-video bg-black">
            <iframe
              src={ytEmbedSrc(activeYtId)}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              title={activeLesson.title}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center bg-muted/20 border-b border-border" style={{ height: 280 }}>
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <PlayCircle className="h-10 w-10 opacity-30" />
              <span className="text-sm">{activeLesson ? "Video đã mở trong tab mới" : "Chọn một bài giảng trong lộ trình để xem"}</span>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-y-auto px-6 py-5">
          {activeLesson && (
            <div className="mb-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-base font-semibold text-foreground">{activeLesson.title}</h2>
                {activeYtId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => window.open(activeLesson.video_url, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="h-3 w-3" /> Mở tab mới
                  </Button>
                )}
              </div>
              {activeLesson.description && (
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{activeLesson.description}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-2">
            <StickyNote className="h-3.5 w-3.5" />Ghi chú
          </div>
          <textarea
            className="w-full h-32 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            placeholder="Ghi chú của bạn về bài học này..."
          />
        </div>
      </div>

      {/* Right: Lộ trình học — full width on mobile, fixed rail on desktop */}
      <div className="w-full lg:w-80 shrink-0 flex flex-col bg-muted/20 min-h-0">
        <div className="px-4 py-3 border-b border-border/50 bg-card/50 flex items-center gap-2 shrink-0">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Lộ trình học</span>
        </div>

        {totalCount > 0 && (
          <div className="px-4 py-3 border-b border-border/50 shrink-0">
            <div className="flex items-center justify-between text-xs font-medium mb-1.5">
              <span className="text-foreground">Tiến độ</span>
              <span className="text-primary">{completedCount}/{totalCount}</span>
            </div>
            <div className="h-1.5 rounded-full bg-primary/10 overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <div className="lg:flex-1 lg:overflow-y-auto divide-y divide-border/40">
          {chapters.map((chapter, ci) => {
            const chExpanded = expanded.has(chapter.id);
            const chLessons  = chapter.sessions.flatMap(s => s.lessons);
            const chDone     = chLessons.filter(l => isCompleted(l)).length;

            return (
              <div key={chapter.id}>
                {/* Chapter header */}
                <div
                  className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none hover:bg-muted/40 transition-colors"
                  onClick={() => toggle(chapter.id)}
                >
                  {chExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <span className="text-xs text-muted-foreground font-medium shrink-0">C{ci + 1}</span>
                  <span className="flex-1 font-medium text-sm text-foreground truncate">{chapter.title}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{chDone}/{chLessons.length}</span>
                  {chDone === chLessons.length && chLessons.length > 0 && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  )}
                </div>

                {/* Sessions */}
                {chExpanded && chapter.sessions.map((session, si) => {
                  const sExpanded  = expanded.has(session.id);
              const pubLessons = session.lessons;
                  const sDone      = pubLessons.filter(l => isCompleted(l)).length;
                  if (pubLessons.length === 0) return null;

                  return (
                    <div key={session.id}>
                      {/* Session header */}
                      <div
                        className="flex items-center gap-2 pl-8 pr-4 py-2 cursor-pointer hover:bg-muted/30 transition-colors select-none"
                        onClick={() => toggle(session.id)}
                      >
                        {sExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                        <CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="flex-1 text-xs font-medium text-foreground truncate">Buổi {si + 1} — {session.title}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{sDone}/{pubLessons.length}</span>
                      </div>

                      {/* Lessons */}
                      {sExpanded && (
                        <div className="pl-8 pr-3 pb-2 space-y-1.5">
                          {pubLessons.map(lesson => {
                            const meta      = LESSON_META[lesson.type];
                            const done      = isCompleted(lesson);
                            const isVideo   = lesson.type === "lecture" || lesson.type === "solution";
                            const hasYt     = isVideo && !!getYouTubeId(lesson.video_url ?? "");
                            const isPlaying = activeLesson?.id === lesson.id;
                            const examStatus = lesson.type === "exam" ? (lesson.exam_status ?? "draft") : null;
                            const examOpensAt = lesson.exam_opens_at;
                            const examOpen = examStatus === "open" || (examStatus === "draft" && !!examOpensAt && new Date(examOpensAt) <= new Date());
                            const examLocked = lesson.type === "exam" && !examOpen && !done;

                            return (
                              <button
                                key={lesson.id}
                                disabled={examLocked}
                                onClick={() => !examLocked && handleAction(lesson)}
                                className={`w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${
                                  examLocked
                                    ? "border-border/50 bg-muted/30 opacity-60 cursor-not-allowed"
                                    : isPlaying
                                    ? "border-primary/40 bg-primary/5"
                                    : done
                                    ? "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-900/10"
                                    : "border-border/50 bg-background hover:border-border"
                                }`}
                              >
                                {done
                                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                  : <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                                }
                                <meta.icon className={`h-3.5 w-3.5 shrink-0 ${meta.color}`} />
                                <span className={`flex-1 text-xs leading-snug line-clamp-2 ${done && !isPlaying ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                  {lesson.title}
                                </span>
                                {examLocked ? (
                                  <span className="text-[10px] shrink-0">🔒</span>
                                ) : lesson.type === "exam" ? (
                                  <PenSquare className="h-3 w-3 text-rose-500 shrink-0" />
                                ) : lesson.type === "material" ? (
                                  <Download className="h-3 w-3 text-muted-foreground shrink-0" />
                                ) : hasYt ? (
                                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" onClick={e => { e.stopPropagation(); window.open(lesson.video_url, "_blank", "noopener,noreferrer"); }} />
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>

    {/* Mobile: full-screen video overlay (opens only when a video lesson is tapped) */}
    {activeLesson && activeYtId && (
      <div className="lg:hidden fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setActiveLesson(null)}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-card" onClick={e => e.stopPropagation()}>
          <span className="text-sm font-semibold text-foreground truncate">{activeLesson.title}</span>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs gap-1 text-muted-foreground"
              onClick={() => window.open(activeLesson.video_url, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-3.5 w-3.5" /> Tab mới
            </Button>
            <button
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              onClick={() => setActiveLesson(null)}
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="relative w-full aspect-video bg-black" onClick={e => e.stopPropagation()}>
          <iframe
            src={`https://www.youtube.com/embed/${activeYtId}?autoplay=1&rel=0`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            title={activeLesson.title}
          />
        </div>
        {activeLesson.description && (
          <div className="px-4 py-3 bg-card overflow-y-auto" onClick={e => e.stopPropagation()}>
            <p className="text-sm text-muted-foreground leading-relaxed">{activeLesson.description}</p>
          </div>
        )}
      </div>
    )}
    </>
  );
}
