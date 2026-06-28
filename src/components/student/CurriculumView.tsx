"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCurriculum, type CurriculumLesson } from "@/lib/storage";
import {
  ChevronDown, ChevronRight, PlayCircle, FileText,
  ClipboardList, Video, CheckCircle2, ExternalLink,
  Download, BookOpen, Circle, CalendarDays,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type LessonType = CurriculumLesson["type"];

const LESSON_META: Record<LessonType, { label: string; icon: React.ElementType; color: string; actionLabel: string }> = {
  lecture:  { label: "Bài giảng",      icon: PlayCircle,    color: "text-blue-600 dark:text-blue-400",    actionLabel: "Xem bài giảng" },
  material: { label: "Tài liệu",       icon: FileText,      color: "text-emerald-600 dark:text-emerald-400", actionLabel: "Tải xuống" },
  homework: { label: "Bài tập",        icon: ClipboardList, color: "text-amber-600 dark:text-amber-400",  actionLabel: "Xem bài tập" },
  solution: { label: "Video chữa bài", icon: Video,         color: "text-violet-600 dark:text-violet-400", actionLabel: "Xem chữa bài" },
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  classId: string;
  watched: Set<string>;            // IDs of watched/completed lessons
  onWatch: (id: string, url?: string) => void;
  submissions: { homework_id: string }[];
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CurriculumView({ classId, watched, onWatch, submissions }: Props) {
  const [chapters,  setChapters]  = useState<ReturnType<typeof getCurriculum>>([]);
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set());

  useEffect(() => {
    const data = getCurriculum(classId);
    setChapters(data);
    // Expand first chapter + its first session by default
    const ids = new Set<string>();
    if (data[0]) {
      ids.add(data[0].id);
      if (data[0].sessions[0]) ids.add(data[0].sessions[0].id);
    }
    setExpanded(ids);
  }, [classId]);

  function toggle(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function isCompleted(lesson: CurriculumLesson): boolean {
    if (lesson.type === "homework") {
      return submissions.some(s => s.homework_id === lesson.id);
    }
    return watched.has(lesson.id);
  }

  function handleAction(lesson: CurriculumLesson) {
    if (lesson.type === "lecture" || lesson.type === "solution") {
      onWatch(lesson.id, lesson.video_url);
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

  // Compute overall progress
  const allPublished = chapters.flatMap(ch => ch.sessions.flatMap(s => s.lessons.filter(l => l.is_published)));
  const completedCount = allPublished.filter(l => isCompleted(l)).length;
  const totalCount     = allPublished.length;
  const pct            = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Progress banner */}
      {totalCount > 0 && (
        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center gap-4">
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-foreground">Tiến độ hoàn thành lộ trình</span>
              <span className="text-primary">{completedCount}/{totalCount} nội dung</span>
            </div>
            <div className="h-2 rounded-full bg-primary/10 overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="text-2xl font-bold text-primary shrink-0">{pct}%</div>
        </div>
      )}

      {/* Chapters */}
      {chapters.map((chapter, ci) => {
        const chExpanded = expanded.has(chapter.id);
        const chLessons  = chapter.sessions.flatMap(s => s.lessons.filter(l => l.is_published));
        const chDone     = chLessons.filter(l => isCompleted(l)).length;

        return (
          <div key={chapter.id} className="border border-border/60 rounded-2xl overflow-hidden bg-card">
            {/* Chapter header */}
            <div
              className="flex items-center gap-3 px-4 py-3.5 bg-muted/20 cursor-pointer select-none hover:bg-muted/40 transition-colors"
              onClick={() => toggle(chapter.id)}
            >
              {chExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">{ci + 1}</span>
              </div>
              <span className="flex-1 font-semibold text-sm text-foreground">{chapter.title}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {chDone}/{chLessons.length} hoàn thành
              </span>
              {chDone === chLessons.length && chLessons.length > 0 && (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              )}
            </div>

            {/* Sessions */}
            {chExpanded && (
              <div className="divide-y divide-border/40">
                {chapter.sessions.map((session, si) => {
                  const sExpanded  = expanded.has(session.id);
                  const pubLessons = session.lessons.filter(l => l.is_published);
                  const sDone      = pubLessons.filter(l => isCompleted(l)).length;

                  if (pubLessons.length === 0) return null;

                  return (
                    <div key={session.id}>
                      {/* Session header */}
                      <div
                        className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors select-none"
                        onClick={() => toggle(session.id)}
                      >
                        {sExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        <span className="text-xs text-muted-foreground shrink-0 w-12">Buổi {si + 1}</span>
                        <span className="flex-1 text-sm font-medium text-foreground">{session.title}</span>
                        {session.date && (
                          <span className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                            <CalendarDays className="h-3 w-3" />
                            {new Date(session.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground shrink-0">{sDone}/{pubLessons.length}</span>
                      </div>

                      {/* Lessons */}
                      {sExpanded && (
                        <div className="px-5 pb-3 space-y-2">
                          {pubLessons.map(lesson => {
                            const meta      = LESSON_META[lesson.type];
                            const done      = isCompleted(lesson);
                            const hasAction = lesson.video_url || lesson.file_url || lesson.type === "homework";

                            return (
                              <div
                                key={lesson.id}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${done ? "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-900/10" : "border-border/50 bg-background hover:border-border"}`}
                              >
                                {/* Done indicator */}
                                {done
                                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                  : <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                                }

                                {/* Type icon */}
                                <meta.icon className={`h-4 w-4 shrink-0 ${meta.color}`} />

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                    {lesson.title}
                                  </p>
                                  {lesson.description && (
                                    <p className="text-xs text-muted-foreground truncate">{lesson.description}</p>
                                  )}
                                  {lesson.due_date && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                      Hạn nộp: {new Date(lesson.due_date).toLocaleDateString("vi-VN")}
                                    </p>
                                  )}
                                </div>

                                {/* Type badge */}
                                <span className={`text-[10px] font-medium shrink-0 hidden sm:block ${meta.color}`}>
                                  {meta.label}
                                </span>

                                {/* Action */}
                                {hasAction && (
                                  <Button
                                    size="sm"
                                    variant={done ? "outline" : "default"}
                                    className="shrink-0 h-7 text-xs px-2.5"
                                    onClick={() => handleAction(lesson)}
                                  >
                                    {lesson.type === "material"
                                      ? <><Download className="h-3 w-3 mr-1" />{meta.actionLabel}</>
                                      : <><ExternalLink className="h-3 w-3 mr-1" />{meta.actionLabel}</>
                                    }
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
