"use client";

import { useState } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MOCK_CLASSES } from "@/lib/mock-data";
import {
  PlayCircle, FileText, Pencil, Download, CheckCircle2,
  ChevronDown, ChevronRight, BookOpen, Clock, BarChart3,
  MessageSquare, StickyNote, Check,
} from "lucide-react";

// ── Course data ──────────────────────────────────────────────────────────────

type LessonType = "video" | "pdf" | "exercise";
type LessonStatus = "done" | "active" | "locked";

interface Attachment {
  name: string;
  size: string;
  type: "pdf" | "exercise";
}

interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  duration?: string;
  status: LessonStatus;
  description?: string;
  attachments?: Attachment[];
  videoUrl?: string;
}

interface Chapter {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface Course {
  classId: string;
  chapters: Chapter[];
}

const COURSES: Course[] = [
  {
    classId: "c1",
    chapters: [
      {
        id: "ch1",
        title: "Hàm số & đồ thị",
        lessons: [
          {
            id: "l1", title: "Lý thuyết hàm số bậc 3", type: "video",
            duration: "18:40", status: "done",
            description: "Giới thiệu tổng quan về hàm số bậc 3, hướng dẫn vẽ đồ thị và nhận dạng dạng bài.",
            attachments: [
              { name: "Lý thuyết hàm số bậc 3.pdf", size: "2.4 MB", type: "pdf" },
            ],
          },
          {
            id: "l2", title: "Công thức tổng hợp hàm số", type: "pdf",
            status: "done",
            description: "Bảng tổng hợp toàn bộ công thức hàm số cần nhớ cho kỳ thi THPT.",
            attachments: [
              { name: "Công thức tổng hợp.pdf", size: "1.2 MB", type: "pdf" },
            ],
          },
          {
            id: "l3", title: "Bài tập hàm số có hướng dẫn", type: "video",
            duration: "24:15", status: "active",
            description: "Giải chi tiết 15 dạng bài từ cơ bản đến nâng cao về hàm số bậc 3.",
            attachments: [
              { name: "Bài tập tự luyện — 20 câu.pdf", size: "1.1 MB", type: "exercise" },
              { name: "Đáp án chi tiết.pdf", size: "0.8 MB", type: "pdf" },
            ],
          },
          {
            id: "l4", title: "Kiểm tra chương 1", type: "exercise",
            status: "locked",
            description: "Bài kiểm tra 30 phút — 15 câu trắc nghiệm và 2 câu tự luận.",
            attachments: [
              { name: "Đề kiểm tra chương 1.pdf", size: "0.6 MB", type: "exercise" },
            ],
          },
        ],
      },
      {
        id: "ch2",
        title: "Đạo hàm & ứng dụng",
        lessons: [
          { id: "l5", title: "Định nghĩa và quy tắc tính đạo hàm", type: "video", duration: "22:30", status: "locked" },
          { id: "l6", title: "Ứng dụng đạo hàm — cực trị", type: "video", duration: "31:10", status: "locked" },
          { id: "l7", title: "Tài liệu lý thuyết đạo hàm", type: "pdf", status: "locked" },
          { id: "l8", title: "Bài tập ứng dụng đạo hàm", type: "exercise", status: "locked" },
        ],
      },
      {
        id: "ch3",
        title: "Tích phân",
        lessons: [
          { id: "l9", title: "Nguyên hàm và tích phân bất định", type: "video", duration: "28:00", status: "locked" },
          { id: "l10", title: "Tích phân xác định", type: "video", duration: "25:45", status: "locked" },
          { id: "l11", title: "Ứng dụng tính diện tích", type: "video", duration: "19:20", status: "locked" },
          { id: "l12", title: "Bộ đề tự luyện tích phân", type: "exercise", status: "locked" },
        ],
      },
      {
        id: "ch4",
        title: "Hình học không gian",
        lessons: [
          { id: "l13", title: "Mặt phẳng và đường thẳng trong không gian", type: "video", duration: "33:15", status: "locked" },
          { id: "l14", title: "Hình học tọa độ Oxyz", type: "video", duration: "40:00", status: "locked" },
          { id: "l15", title: "Tài liệu hình học không gian", type: "pdf", status: "locked" },
        ],
      },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function LessonIcon({ type, size = 16 }: { type: LessonType; size?: number }) {
  const cls = `h-${size === 16 ? 4 : 5} w-${size === 16 ? 4 : 5}`;
  if (type === "video") return <PlayCircle className={cls} />;
  if (type === "pdf") return <FileText className={cls} />;
  return <Pencil className={cls} />;
}

function TypeBadge({ type }: { type: LessonType }) {
  if (type === "video") return <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">Video</Badge>;
  if (type === "pdf") return <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">PDF</Badge>;
  return <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">Bài tập</Badge>;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function StudentMaterialsPage() {
  const myClass = MOCK_CLASSES[0];
  const course = COURSES[0];

  const allLessons = course.chapters.flatMap(ch => ch.lessons);
  const doneCount = allLessons.filter(l => l.status === "done").length;
  const progress = Math.round((doneCount / allLessons.length) * 100);

  const activeLesson = allLessons.find(l => l.status === "active") ?? allLessons[0];
  const [selectedId, setSelectedId] = useState(activeLesson.id);
  const [openChapters, setOpenChapters] = useState<string[]>([course.chapters[0].id]);
  const [activeTab, setActiveTab] = useState<"files" | "notes" | "discuss">("files");
  const [completedIds, setCompletedIds] = useState<string[]>(
    allLessons.filter(l => l.status === "done").map(l => l.id)
  );

  const selected = allLessons.find(l => l.id === selectedId)!;
  const selectedIdx = allLessons.findIndex(l => l.id === selectedId);
  const prevLesson = allLessons[selectedIdx - 1];
  const nextLesson = allLessons[selectedIdx + 1];

  const toggleChapter = (id: string) =>
    setOpenChapters(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const markDone = () => {
    if (!completedIds.includes(selectedId)) setCompletedIds(prev => [...prev, selectedId]);
    if (nextLesson) setSelectedId(nextLesson.id);
  };

  const isDone = (id: string) => completedIds.includes(id);

  return (
    <PortalLayout role="student" userName="" pageTitle="Tài liệu">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{myClass.class_name}</h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><PlayCircle className="h-3.5 w-3.5" />{allLessons.filter(l => l.type === "video").length} video</span>
              <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />{allLessons.filter(l => l.type === "pdf").length} PDF</span>
              <span className="flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" />{allLessons.filter(l => l.type === "exercise").length} bài tập</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">{doneCount}/{allLessons.length} bài</div>
            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-sm font-medium text-primary">{progress}%</span>
          </div>
        </div>

        {/* Main layout */}
        <div className="flex gap-0 border border-border rounded-xl overflow-hidden bg-card" style={{ minHeight: "600px" }}>

          {/* Sidebar */}
          <div className="w-72 shrink-0 border-r border-border flex flex-col bg-muted/20 overflow-y-auto">
            {course.chapters.map((chapter, ci) => {
              const isOpen = openChapters.includes(chapter.id);
              const chDone = chapter.lessons.filter(l => isDone(l.id)).length;
              return (
                <div key={chapter.id}>
                  <button
                    onClick={() => toggleChapter(chapter.id)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/40 border-b border-border/50 transition-colors"
                  >
                    <span className="text-xs text-muted-foreground font-medium min-w-[20px]">C{ci + 1}</span>
                    <span className="flex-1 text-sm font-medium text-foreground truncate">{chapter.title}</span>
                    <span className="text-xs text-muted-foreground mr-1">{chDone}/{chapter.lessons.length}</span>
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="py-1">
                      {chapter.lessons.map(lesson => {
                        const done = isDone(lesson.id);
                        const isSelected = selectedId === lesson.id;
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => lesson.status !== "locked" || done ? setSelectedId(lesson.id) : null}
                            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors
                              ${isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/40 text-foreground/80"}
                              ${lesson.status === "locked" && !done ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                            `}
                          >
                            <div className={`w-2 h-2 rounded-full shrink-0 ${done ? "bg-green-500" : isSelected ? "bg-primary" : "border border-muted-foreground"}`} />
                            <span className="flex-1 text-xs leading-snug line-clamp-2">{lesson.title}</span>
                            <div className="shrink-0"><TypeBadge type={lesson.type} /></div>
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

            {/* Video area */}
            {selected.type === "video" ? (
              <div className="bg-black flex items-center justify-center relative" style={{ height: "280px" }}>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-full border-2 border-white/40 bg-white/10 flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors">
                    <PlayCircle className="h-7 w-7 text-white ml-0.5" />
                  </div>
                  <span className="text-white/60 text-sm">{selected.title}</span>
                </div>
                {selected.duration && (
                  <div className="absolute bottom-3 right-4 flex items-center gap-1.5 text-white/50 text-xs">
                    <Clock className="h-3 w-3" />
                    {selected.duration}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center bg-muted/30 border-b border-border" style={{ height: "140px" }}>
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <LessonIcon type={selected.type} size={20} />
                  <span className="text-sm">{selected.type === "pdf" ? "Tài liệu PDF" : "Bài tập thực hành"}</span>
                </div>
              </div>
            )}

            {/* Info */}
            <div className="flex-1 flex flex-col overflow-y-auto">
              <div className="px-6 pt-5 pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <LessonIcon type={selected.type} size={16} />
                      <h2 className="text-base font-semibold text-foreground">{selected.title}</h2>
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

              {/* Tabs */}
              <div className="flex border-b border-border px-6 mt-2">
                {[
                  { key: "files", label: "Tài liệu kèm theo", icon: BookOpen },
                  { key: "notes", label: "Ghi chú", icon: StickyNote },
                  { key: "discuss", label: "Thảo luận", icon: MessageSquare },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as typeof activeTab)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      activeTab === tab.key
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
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
                              : <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
                            }
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
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Không có tài liệu đính kèm
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "notes" && (
                  <textarea
                    className="w-full h-32 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                    placeholder="Ghi chú của bạn về bài học này..."
                  />
                )}

                {activeTab === "discuss" && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Chức năng thảo luận đang được phát triển
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-2 px-6 pb-5 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={!prevLesson}
                  onClick={() => prevLesson && setSelectedId(prevLesson.id)}
                >
                  ← Bài trước
                </Button>

                <div className="flex-1 text-center text-xs text-muted-foreground">
                  {selectedIdx + 1} / {allLessons.length}
                </div>

                {!isDone(selectedId) ? (
                  <Button size="sm" className="gap-1.5" onClick={markDone}>
                    <Check className="h-3.5 w-3.5" /> Đánh dấu hoàn thành
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={!nextLesson}
                    onClick={() => nextLesson && setSelectedId(nextLesson.id)}
                  >
                    Bài tiếp →
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
