"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  PlayCircle, FileText, Pencil, Download, CheckCircle2,
  ChevronDown, ChevronRight, BookOpen, Clock, StickyNote,
  MessageSquare, Check, ArrowLeft, Lock, Eye,
} from "lucide-react";
import { LessonIcon, TypeBadge, type OwnedCourse } from "./materialsShared";

// ─────────────────────────────────────────────────────────────────────────────
// Player view (owned courses)
// ─────────────────────────────────────────────────────────────────────────────

export default function PlayerView({ course, isPackageLocked, onBack }: { course: OwnedCourse; isPackageLocked: boolean; onBack: () => void }) {
  const allLessons = course.chapters.flatMap(ch => ch.lessons);

  // If package-locked, only preview lessons are accessible
  const effectiveLessons = allLessons.map(l =>
    isPackageLocked && l.status !== "locked" && !l.isPreview ? { ...l, status: "locked" as const } : l
  );

  const firstAccessible = effectiveLessons.find(l => l.status !== "locked") ?? effectiveLessons[0];
  const [selectedId, setSelectedId] = useState(firstAccessible.id);
  const [openChapters, setOpenChapters] = useState<string[]>([course.chapters[0].id]);
  const [activeTab, setActiveTab] = useState<"files" | "notes" | "discuss">("files");
  const [completedIds, setCompletedIds] = useState<string[]>(
    effectiveLessons.filter(l => l.status === "done").map(l => l.id)
  );

  const selected = effectiveLessons.find(l => l.id === selectedId)!;
  const selectedIdx = effectiveLessons.findIndex(l => l.id === selectedId);
  const prevLesson = effectiveLessons[selectedIdx - 1];
  const nextLesson = effectiveLessons[selectedIdx + 1];

  const toggleChapter = (id: string) =>
    setOpenChapters(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const markDone = () => {
    if (!completedIds.includes(selectedId)) setCompletedIds(prev => [...prev, selectedId]);
    if (nextLesson) setSelectedId(nextLesson.id);
  };

  const isDone = (id: string) => completedIds.includes(id);

  const doneCount = allLessons.filter(l => completedIds.includes(l.id)).length;
  const progress = allLessons.length > 0 ? Math.round((doneCount / allLessons.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" /> Tài liệu
          </button>
          <span className="text-muted-foreground/40">/</span>
          <h1 className="text-base font-semibold text-foreground">{course.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{doneCount}/{allLessons.length} bài</span>
          <div className="w-28 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-sm font-medium text-primary">{progress}%</span>
        </div>
      </div>

      {/* Layout */}
      <div className="flex border border-border rounded-xl overflow-hidden bg-card" style={{ minHeight: 600 }}>
        {/* Sidebar */}
        <div className="w-72 shrink-0 border-r border-border flex flex-col bg-muted/20 overflow-y-auto">
          {course.chapters.map((chapter, ci) => {
            const effectiveChapterLessons = effectiveLessons.filter(l => chapter.lessons.some(cl => cl.id === l.id));
            const isOpen = openChapters.includes(chapter.id);
            const chDone = effectiveChapterLessons.filter(l => isDone(l.id)).length;
            return (
              <div key={chapter.id}>
                <button onClick={() => toggleChapter(chapter.id)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/40 border-b border-border/50 transition-colors">
                  <span className="text-xs text-muted-foreground font-medium min-w-[20px]">C{ci + 1}</span>
                  <span className="flex-1 text-sm font-medium text-foreground truncate">{chapter.title}</span>
                  <span className="text-xs text-muted-foreground mr-1">{chDone}/{chapter.lessons.length}</span>
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                </button>
                {isOpen && (
                  <div className="py-1">
                    {effectiveChapterLessons.map(lesson => {
                      const done = isDone(lesson.id);
                      const isSelected = selectedId === lesson.id;
                      const accessible = lesson.status !== "locked" || done;
                      return (
                        <button key={lesson.id}
                          onClick={() => accessible ? setSelectedId(lesson.id) : undefined}
                          className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors
                            ${isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/40 text-foreground/80"}
                            ${!accessible ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                          <div className={`w-2 h-2 rounded-full shrink-0 ${done ? "bg-green-500" : isSelected ? "bg-primary" : "border border-muted-foreground"}`} />
                          <span className="flex-1 text-xs leading-snug line-clamp-2">{lesson.title}</span>
                          {lesson.isPreview && !done && (
                            <Eye className="h-3 w-3 text-violet-500 shrink-0" />
                          )}
                          {!accessible && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                          {accessible && <TypeBadge type={lesson.type} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {isPackageLocked && (
            <div className="mx-4 mt-4 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
              <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Gói đăng ký chưa có quyền truy cập</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Chỉ các bài Preview mới xem được. Nâng cấp gói để mở khoá toàn bộ nội dung.</p>
              </div>
            </div>
          )}
          {selected.type === "video" ? (
            <div className="bg-black flex items-center justify-center relative" style={{ height: 280 }}>
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full border-2 border-white/40 bg-white/10 flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors">
                  <PlayCircle className="h-7 w-7 text-white ml-0.5" />
                </div>
                <span className="text-white/60 text-sm">{selected.title}</span>
              </div>
              {selected.duration && (
                <div className="absolute bottom-3 right-4 flex items-center gap-1.5 text-white/50 text-xs">
                  <Clock className="h-3 w-3" />{selected.duration}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center bg-muted/30 border-b border-border" style={{ height: 140 }}>
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <LessonIcon type={selected.type} className="h-10 w-10" />
                <span className="text-sm">{selected.type === "pdf" ? "Tài liệu PDF" : "Bài tập thực hành"}</span>
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="px-6 pt-5 pb-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <LessonIcon type={selected.type} />
                    <h2 className="text-base font-semibold text-foreground">{selected.title}</h2>
                    {selected.isPreview && (
                      <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400 flex items-center gap-0.5">
                        <Eye className="h-3 w-3" />Xem trước
                      </span>
                    )}
                  </div>
                  {selected.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{selected.description}</p>
                  )}
                </div>
                {isDone(selectedId) && (
                  <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium shrink-0">
                    <CheckCircle2 className="h-4 w-4" /> Đã hoàn thành
                  </div>
                )}
              </div>
            </div>

            <div className="flex border-b border-border px-6 mt-2">
              {[
                { key: "files",   label: "Tài liệu kèm theo", icon: BookOpen },
                { key: "notes",   label: "Ghi chú",           icon: StickyNote },
                { key: "discuss", label: "Thảo luận",         icon: MessageSquare },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}>
                  <tab.icon className="h-3.5 w-3.5" />{tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 px-6 py-4">
              {activeTab === "files" && (
                <div className="space-y-2">
                  {selected.attachments && selected.attachments.length > 0 ? (
                    selected.attachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${att.type === "exercise" ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                          {att.type === "exercise"
                            ? <Pencil className="h-4 w-4 text-green-600 dark:text-green-400" />
                            : <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{att.name}</p>
                          <p className="text-xs text-muted-foreground">{att.size}</p>
                        </div>
                        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs shrink-0">
                          <Download className="h-3.5 w-3.5" /> Tải về
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">Không có tài liệu đính kèm</div>
                  )}
                </div>
              )}
              {activeTab === "notes" && (
                <textarea className="w-full h-32 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                  placeholder="Ghi chú của bạn về bài học này..." />
              )}
              {activeTab === "discuss" && (
                <div className="text-center py-8 text-muted-foreground text-sm">Chức năng thảo luận đang được phát triển</div>
              )}
            </div>

            <div className="flex items-center gap-2 px-6 pb-5 pt-2 border-t border-border">
              <Button variant="outline" size="sm" className="gap-1.5" disabled={!prevLesson}
                onClick={() => prevLesson && setSelectedId(prevLesson.id)}>← Bài trước</Button>
              <div className="flex-1 text-center text-xs text-muted-foreground">{selectedIdx + 1} / {allLessons.length}</div>
              {!isDone(selectedId) ? (
                <Button size="sm" className="gap-1.5" onClick={markDone}>
                  <Check className="h-3.5 w-3.5" /> Đánh dấu hoàn thành
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="gap-1.5" disabled={!nextLesson}
                  onClick={() => nextLesson && setSelectedId(nextLesson.id)}>Bài tiếp →</Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
