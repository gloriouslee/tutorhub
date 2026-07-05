"use client";

import { Button } from "@/components/ui/button";
import { PlayCircle, Clock, Download, X, Eye, ShoppingCart } from "lucide-react";
import { LessonIcon, type PaidLesson } from "./materialsShared";

// ─────────────────────────────────────────────────────────────────────────────
// Preview player modal (for paid package preview lessons)
// ─────────────────────────────────────────────────────────────────────────────

export default function PreviewPlayerModal({
  lesson,
  packageTitle,
  onClose,
  onBuy,
}: {
  lesson: PaidLesson;
  packageTitle: string;
  onClose: () => void;
  onBuy: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <p className="text-xs text-muted-foreground">{packageTitle} · Xem thử miễn phí</p>
            <h3 className="font-semibold text-foreground text-sm">{lesson.title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Player area */}
        {lesson.type === "video" ? (
          <div className="bg-black flex items-center justify-center" style={{ height: 300 }}>
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full border-2 border-white/40 bg-white/10 flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors">
                <PlayCircle className="h-8 w-8 text-white ml-0.5" />
              </div>
              <span className="text-white/60 text-sm">{lesson.title}</span>
              {lesson.duration && (
                <span className="text-white/40 text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />{lesson.duration}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-muted/20 flex items-center justify-center" style={{ height: 200 }}>
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <LessonIcon type={lesson.type} className="h-10 w-10" />
              <span className="text-sm">{lesson.type === "pdf" ? "Xem trước PDF" : "Bài tập thực hành"}</span>
              <Button size="sm" variant="outline" className="mt-2 gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" /> Tải xuống bản xem thử
              </Button>
            </div>
          </div>
        )}

        {/* Preview watermark banner */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 dark:bg-violet-900/20 border-t border-violet-100 dark:border-violet-900/40">
          <Eye className="h-4 w-4 text-violet-500 shrink-0" />
          <p className="text-xs text-violet-700 dark:text-violet-400 flex-1">
            Đây là bài học xem thử. Mua gói để truy cập toàn bộ nội dung.
          </p>
          <Button size="sm" className="h-7 gap-1.5 text-xs shrink-0" onClick={onBuy}>
            <ShoppingCart className="h-3 w-3" /> Mua gói
          </Button>
        </div>
      </div>
    </div>
  );
}
