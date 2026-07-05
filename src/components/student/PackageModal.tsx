"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, ChevronDown, ChevronRight, Clock,
  ShoppingCart, Lock, Star, X, Eye,
} from "lucide-react";
import {
  LessonIcon, TIER_CONFIG, fmt,
  type PaidLesson, type PaidPackage,
} from "./materialsShared";

// ─────────────────────────────────────────────────────────────────────────────
// Purchase / detail modal
// ─────────────────────────────────────────────────────────────────────────────

export default function PackageModal({
  pkg,
  onClose,
  onPreview,
  onBuy,
}: {
  pkg: PaidPackage;
  onClose: () => void;
  onPreview: (lesson: PaidLesson) => void;
  onBuy: () => void;
}) {
  const [openChapters, setOpenChapters] = useState<string[]>([pkg.chapters[0]?.id]);
  const tier = TIER_CONFIG[pkg.tier];
  const TierIcon = tier.icon;
  const discount = pkg.originalPrice
    ? Math.round((1 - pkg.price / pkg.originalPrice) * 100) : null;
  const totalLessons = pkg.chapters.flatMap(c => c.lessons).length;
  const previewLessons = pkg.chapters.flatMap(c => c.lessons).filter(l => l.isPreview);

  const toggleChapter = (id: string) =>
    setOpenChapters(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${tier.color}`}>
              <TierIcon className="h-3 w-3" />{tier.label}
            </span>
            {discount && (
              <span className="text-xs font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">
                -{discount}%
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div>
            <Badge variant="outline" className="text-xs mb-2">{pkg.subject} · Khối {pkg.grade}</Badge>
            <h2 className="text-base font-bold text-foreground">{pkg.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{pkg.description}</p>
          </div>

          {/* Price */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border">
            <div>
              <p className="text-xl font-bold text-foreground">{fmt(pkg.price)}</p>
              {pkg.originalPrice && (
                <p className="text-xs text-muted-foreground line-through">{fmt(pkg.originalPrice)}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
              <span className="text-sm font-semibold">{pkg.rating}</span>
              <span className="text-xs text-muted-foreground">({pkg.reviewCount})</span>
            </div>
          </div>

          {/* Includes */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bao gồm</p>
            {pkg.includes.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />{item}
              </div>
            ))}
          </div>

          {/* Preview indicator */}
          {previewLessons.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/30 rounded-lg px-3 py-2">
              <Eye className="h-3.5 w-3.5 shrink-0" />
              {previewLessons.length} bài học xem thử miễn phí — nhấn vào bài để xem ngay
            </div>
          )}

          {/* Chapter/lesson list */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Nội dung · {pkg.chapters.length} chương · {totalLessons} bài
            </p>
            {pkg.chapters.map((ch, ci) => {
              const isOpen = openChapters.includes(ch.id);
              const chPreview = ch.lessons.filter(l => l.isPreview).length;
              return (
                <div key={ch.id} className="border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleChapter(ch.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                  >
                    {isOpen
                      ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    <span className="text-xs font-semibold text-foreground flex-1">
                      Chương {ci + 1}: {ch.title}
                    </span>
                    <span className="text-xs text-muted-foreground">{ch.lessons.length} bài</span>
                    {chPreview > 0 && (
                      <span className="text-[10px] text-violet-600 dark:text-violet-400 ml-1 flex items-center gap-0.5">
                        <Eye className="h-2.5 w-2.5" />{chPreview}
                      </span>
                    )}
                  </button>
                  {isOpen && (
                    <div className="divide-y divide-border/60">
                      {ch.lessons.map(lesson => (
                        <div
                          key={lesson.id}
                          className={`flex items-center gap-2.5 px-3 py-2 transition-colors ${
                            lesson.isPreview ? "hover:bg-violet-50 dark:hover:bg-violet-900/10 cursor-pointer" : "opacity-60"
                          }`}
                          onClick={() => lesson.isPreview && onPreview(lesson)}
                        >
                          <div className={`h-6 w-6 rounded flex items-center justify-center shrink-0 ${
                            lesson.type === "video" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                            : lesson.type === "pdf" ? "bg-red-100 text-red-600 dark:bg-red-900/30"
                            : "bg-green-100 text-green-600 dark:bg-green-900/30"
                          }`}>
                            <LessonIcon type={lesson.type} className="h-3 w-3" />
                          </div>
                          <span className="flex-1 text-xs text-foreground line-clamp-1">{lesson.title}</span>
                          {lesson.duration && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />{lesson.duration}
                            </span>
                          )}
                          {lesson.isPreview ? (
                            <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400 flex items-center gap-0.5 shrink-0">
                              <Eye className="h-2.5 w-2.5" />Xem thử
                            </span>
                          ) : (
                            <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="p-4 border-t border-border bg-muted/20 flex gap-3 shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>Để sau</Button>
          <Button className="flex-1 gap-2" onClick={() => { onClose(); onBuy(); }}>
            <ShoppingCart className="h-4 w-4" /> Mua ngay · {fmt(pkg.price)}
          </Button>
        </div>
      </div>
    </div>
  );
}
