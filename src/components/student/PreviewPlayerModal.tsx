"use client";

import { Button } from "@/components/ui/button";
import { PlayCircle, Download, X, Eye, ShoppingCart } from "lucide-react";
import { LessonIcon, type PaidLesson } from "./materialsShared";

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
      : (host === "youtube.com" || host === "m.youtube.com")
        ? url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]
        : null;
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  } catch {
    return null;
  }
}

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
            {youtubeEmbedUrl(lesson.videoUrl) ? (
              <iframe
                className="h-full w-full"
                src={youtubeEmbedUrl(lesson.videoUrl)!}
                title={lesson.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : safeMediaUrl(lesson.videoUrl) ? (
              <video className="h-full w-full" controls preload="metadata" src={safeMediaUrl(lesson.videoUrl)!} />
            ) : (
              <div className="flex flex-col items-center gap-3 text-white/60">
                <PlayCircle className="h-10 w-10" />
                <span className="text-sm">Chưa có video xem thử</span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-muted/20 flex items-center justify-center" style={{ height: 200 }}>
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <LessonIcon type={lesson.type} className="h-10 w-10" />
              <span className="text-sm">{lesson.type === "pdf" ? "Xem trước PDF" : "Bài tập thực hành"}</span>
              {safeMediaUrl(lesson.fileUrl) ? (
                <Button size="sm" variant="outline" className="mt-2 gap-1.5 text-xs" asChild>
                  <a href={safeMediaUrl(lesson.fileUrl)!} target="_blank" rel="noopener noreferrer">
                    <Download className="h-3.5 w-3.5" /> Tải xuống bản xem thử
                  </a>
                </Button>
              ) : (
                <span className="text-xs">Chưa có file xem thử</span>
              )}
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
