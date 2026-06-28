"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PortalLayout from "@/components/layout/PortalLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getGrantedPackages } from "@/lib/storage";
import {
  PlayCircle, FileText, Pencil, Download, CheckCircle2,
  ChevronDown, ChevronRight, BookOpen, Clock, StickyNote,
  MessageSquare, Check, ArrowLeft, Search, ShoppingCart,
  Lock, Star, Layers, Zap, Crown, X, Eye, Tag,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type LessonType = "video" | "pdf" | "exercise";
type LessonStatus = "done" | "active" | "locked";

interface Attachment { name: string; size: string; type: "pdf" | "exercise" }

interface Lesson {
  id: string; title: string; type: LessonType;
  duration?: string; status: LessonStatus;
  description?: string; attachments?: Attachment[];
  isPreview?: boolean;
}

interface Chapter { id: string; title: string; lessons: Lesson[] }

interface OwnedCourse {
  id: string; classId: string; title: string; subject: string;
  color: string; chapters: Chapter[];
}

interface PaidLesson {
  id: string; title: string; type: LessonType;
  duration?: string; isPreview: boolean;
}

interface PaidChapter {
  id: string; title: string; lessons: PaidLesson[];
}

interface PaidPackage {
  id: string; title: string; subject: string; grade: number;
  price: number; originalPrice?: number; tier: "basic" | "pro" | "elite";
  description: string; includes: string[];
  rating: number; reviewCount: number;
  chapters: PaidChapter[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────────────────────

const OWNED_COURSES: OwnedCourse[] = [
  {
    id: "oc1", classId: "c1",
    title: "Toán 12 — Giải tích & Hình học", subject: "Toán học", color: "#6366f1",
    chapters: [
      {
        id: "ch1", title: "Hàm số & đồ thị",
        lessons: [
          { id: "l1", title: "Lý thuyết hàm số bậc 3", type: "video", duration: "18:40", status: "done", isPreview: true,
            description: "Giới thiệu tổng quan hàm số bậc 3, hướng dẫn vẽ đồ thị và nhận dạng dạng bài.",
            attachments: [{ name: "Lý thuyết hàm số bậc 3.pdf", size: "2.4 MB", type: "pdf" }] },
          { id: "l2", title: "Công thức tổng hợp hàm số", type: "pdf", status: "done", isPreview: true,
            description: "Bảng tổng hợp toàn bộ công thức hàm số cho kỳ thi THPT.",
            attachments: [{ name: "Công thức tổng hợp.pdf", size: "1.2 MB", type: "pdf" }] },
          { id: "l3", title: "Bài tập hàm số có hướng dẫn", type: "video", duration: "24:15", status: "active",
            description: "Giải chi tiết 15 dạng bài từ cơ bản đến nâng cao.",
            attachments: [
              { name: "Bài tập tự luyện — 20 câu.pdf", size: "1.1 MB", type: "exercise" },
              { name: "Đáp án chi tiết.pdf", size: "0.8 MB", type: "pdf" },
            ] },
          { id: "l4", title: "Kiểm tra chương 1", type: "exercise", status: "locked",
            attachments: [{ name: "Đề kiểm tra chương 1.pdf", size: "0.6 MB", type: "exercise" }] },
        ],
      },
      {
        id: "ch2", title: "Đạo hàm & ứng dụng",
        lessons: [
          { id: "l5", title: "Định nghĩa và quy tắc tính đạo hàm", type: "video", duration: "22:30", status: "locked" },
          { id: "l6", title: "Ứng dụng đạo hàm — cực trị", type: "video", duration: "31:10", status: "locked" },
          { id: "l7", title: "Tài liệu lý thuyết đạo hàm", type: "pdf", status: "locked" },
          { id: "l8", title: "Bài tập ứng dụng đạo hàm", type: "exercise", status: "locked" },
        ],
      },
      {
        id: "ch3", title: "Tích phân",
        lessons: [
          { id: "l9",  title: "Nguyên hàm và tích phân bất định", type: "video", duration: "28:00", status: "locked" },
          { id: "l10", title: "Tích phân xác định", type: "video", duration: "25:45", status: "locked" },
          { id: "l11", title: "Ứng dụng tính diện tích", type: "video", duration: "19:20", status: "locked" },
          { id: "l12", title: "Bộ đề tự luyện tích phân", type: "exercise", status: "locked" },
        ],
      },
    ],
  },
  {
    id: "oc2", classId: "c2",
    title: "Vật Lý 11 — Điện học", subject: "Vật lý", color: "#f59e0b",
    chapters: [
      {
        id: "ch1", title: "Điện tích & Điện trường",
        lessons: [
          { id: "p1", title: "Điện tích và định luật Coulomb", type: "video", duration: "20:10", status: "done" },
          { id: "p2", title: "Điện trường — lý thuyết", type: "pdf", status: "done" },
          { id: "p3", title: "Bài tập điện trường", type: "exercise", status: "active" },
        ],
      },
      {
        id: "ch2", title: "Tụ điện & Năng lượng điện",
        lessons: [
          { id: "p4", title: "Tụ điện — nguyên lý và ứng dụng", type: "video", duration: "17:30", status: "locked" },
          { id: "p5", title: "Năng lượng điện trường", type: "pdf", status: "locked" },
        ],
      },
    ],
  },
];

const PAID_PACKAGES: PaidPackage[] = [
  {
    id: "pp1", title: "Toán 12 — Siêu Ôn Luyện THPT Quốc Gia",
    subject: "Toán học", grade: 12, price: 299000, originalPrice: 499000,
    tier: "pro",
    description: "Bộ tài liệu toàn diện nhất cho kỳ thi THPT, bao gồm video bài giảng, bộ đề và đáp án chi tiết.",
    includes: ["32 video bài giảng HD", "500 bài tập có đáp án", "10 đề thi thử THPT", "Tóm tắt lý thuyết mỗi chương"],
    rating: 4.9, reviewCount: 218,
    chapters: [
      {
        id: "c1", title: "Hàm số & đồ thị",
        lessons: [
          { id: "a1", title: "Lý thuyết hàm số — tổng quan", type: "video", duration: "15:00", isPreview: true },
          { id: "a2", title: "Công thức nhanh hàm số", type: "pdf", isPreview: true },
          { id: "a3", title: "Bài tập hàm số nâng cao", type: "video", duration: "28:00", isPreview: false },
          { id: "a4", title: "50 câu trắc nghiệm hàm số", type: "exercise", isPreview: false },
        ],
      },
      {
        id: "c2", title: "Đạo hàm nâng cao",
        lessons: [
          { id: "a5", title: "Đạo hàm — kỹ thuật nâng cao", type: "video", duration: "28:00", isPreview: true },
          { id: "a6", title: "500 bài tập đạo hàm", type: "exercise", isPreview: false },
          { id: "a7", title: "Đề thi thử đạo hàm", type: "exercise", isPreview: false },
        ],
      },
      {
        id: "c3", title: "Tích phân & ứng dụng",
        lessons: [
          { id: "a8", title: "Nguyên hàm — phương pháp", type: "video", duration: "22:10", isPreview: false },
          { id: "a9", title: "Tích phân xác định toàn tập", type: "pdf", isPreview: false },
          { id: "a10", title: "Bài tập tích phân tổng hợp", type: "exercise", isPreview: false },
        ],
      },
    ],
  },
  {
    id: "pp2", title: "Vật Lý 12 — Điện xoay chiều & Sóng",
    subject: "Vật lý", grade: 12, price: 199000,
    tier: "basic",
    description: "Toàn bộ phần Điện xoay chiều và Sóng cơ — hai chủ đề trọng tâm đề thi THPT Vật Lý.",
    includes: ["18 video bài giảng", "200 bài tập trắc nghiệm", "6 đề thi thử", "File tóm tắt công thức"],
    rating: 4.7, reviewCount: 143,
    chapters: [
      {
        id: "c1", title: "Dao động điều hòa",
        lessons: [
          { id: "b1", title: "Dao động điều hòa — lý thuyết", type: "video", duration: "18:30", isPreview: true },
          { id: "b2", title: "Công thức dao động tổng hợp", type: "pdf", isPreview: true },
          { id: "b3", title: "Bài tập dao động", type: "exercise", isPreview: false },
        ],
      },
      {
        id: "c2", title: "Điện xoay chiều",
        lessons: [
          { id: "b4", title: "Mạch RLC và cộng hưởng", type: "video", duration: "25:00", isPreview: false },
          { id: "b5", title: "Bài tập điện xoay chiều", type: "exercise", isPreview: false },
        ],
      },
    ],
  },
  {
    id: "pp3", title: "Hóa Học 12 — Lý thuyết & Bài tập nâng cao",
    subject: "Hóa học", grade: 12, price: 349000, originalPrice: 550000,
    tier: "elite",
    description: "Gói tài liệu nâng cao cho học sinh muốn đạt 9+ môn Hóa, bao gồm Hóa hữu cơ và vô cơ.",
    includes: ["45 video bài giảng", "700+ bài tập phân loại", "15 đề ôn chuyên đề", "Bảng phản ứng hóa học tổng hợp", "Hỗ trợ Q&A qua Zalo nhóm"],
    rating: 4.8, reviewCount: 87,
    chapters: [
      {
        id: "c1", title: "Este & Lipit",
        lessons: [
          { id: "d1", title: "Este — cấu tạo và tính chất", type: "video", duration: "20:00", isPreview: true },
          { id: "d2", title: "Phản ứng este hóa tổng hợp", type: "pdf", isPreview: false },
          { id: "d3", title: "Bài tập este nâng cao", type: "exercise", isPreview: false },
        ],
      },
      {
        id: "c2", title: "Amin & Amino axit",
        lessons: [
          { id: "d4", title: "Amin — phân loại và danh pháp", type: "video", duration: "16:30", isPreview: true },
          { id: "d5", title: "Amino axit và Protein", type: "video", duration: "22:00", isPreview: false },
          { id: "d6", title: "Bài tập amin & amino axit", type: "exercise", isPreview: false },
        ],
      },
    ],
  },
  {
    id: "pp4", title: "Tiếng Anh 12 — Ngữ pháp & Từ vựng",
    subject: "Tiếng Anh", grade: 12, price: 149000,
    tier: "basic",
    description: "Hệ thống toàn bộ ngữ pháp và từ vựng Tiếng Anh 12 theo cấu trúc đề thi THPT.",
    includes: ["24 video bài giảng", "300 câu trắc nghiệm ngữ pháp", "Flash cards từ vựng", "5 đề thi thử"],
    rating: 4.6, reviewCount: 195,
    chapters: [
      {
        id: "c1", title: "Ngữ pháp cốt lõi",
        lessons: [
          { id: "e1", title: "Thì và thể — ôn tập toàn diện", type: "video", duration: "22:00", isPreview: true },
          { id: "e2", title: "Câu điều kiện 1, 2, 3", type: "video", duration: "18:00", isPreview: false },
          { id: "e3", title: "Bài tập ngữ pháp tổng hợp", type: "exercise", isPreview: false },
        ],
      },
      {
        id: "c2", title: "Từ vựng theo chủ đề",
        lessons: [
          { id: "e4", title: "Từ vựng chủ đề môi trường", type: "pdf", isPreview: true },
          { id: "e5", title: "Từ vựng chủ đề công nghệ", type: "pdf", isPreview: false },
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString("vi-VN") + "đ"; }

function LessonIcon({ type, className }: { type: LessonType; className?: string }) {
  if (type === "video") return <PlayCircle className={className ?? "h-4 w-4"} />;
  if (type === "pdf") return <FileText className={className ?? "h-4 w-4"} />;
  return <Pencil className={className ?? "h-4 w-4"} />;
}

function TypeBadge({ type }: { type: LessonType }) {
  if (type === "video") return <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">Video</Badge>;
  if (type === "pdf") return <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">PDF</Badge>;
  return <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">Bài tập</Badge>;
}

const TIER_CONFIG = {
  basic: { label: "Basic", icon: Tag,   color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", ring: "ring-slate-200 dark:ring-slate-700" },
  pro:   { label: "Pro",   icon: Zap,   color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400", ring: "ring-violet-200 dark:ring-violet-800" },
  elite: { label: "Elite", icon: Crown, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", ring: "ring-amber-200 dark:ring-amber-800" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Preview player modal (for paid package preview lessons)
// ─────────────────────────────────────────────────────────────────────────────

function PreviewPlayerModal({
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

// ─────────────────────────────────────────────────────────────────────────────
// Purchase / detail modal
// ─────────────────────────────────────────────────────────────────────────────

function PackageModal({
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

// ─────────────────────────────────────────────────────────────────────────────
// Browse view
// ─────────────────────────────────────────────────────────────────────────────

function BrowseView({ onSelectCourse }: { onSelectCourse: (c: OwnedCourse) => void }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedPkg, setSelectedPkg] = useState<PaidPackage | null>(null);
  const [previewLesson, setPreviewLesson] = useState<{ lesson: PaidLesson; pkg: PaidPackage } | null>(null);
  const [grantedPkgIds, setGrantedPkgIds] = useState<string[]>([]);

  useEffect(() => { setGrantedPkgIds(getGrantedPackages()); }, []);

  const filteredPkg = search.trim()
    ? PAID_PACKAGES.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.subject.toLowerCase().includes(search.toLowerCase())
      )
    : PAID_PACKAGES;

  return (
    <div className="space-y-10">

      {/* ── Tài liệu của tôi ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Tài liệu của tôi</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Tài liệu từ các lớp học bạn đang theo học</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {OWNED_COURSES.map(course => {
            const allLessons = course.chapters.flatMap(ch => ch.lessons);
            const done = allLessons.filter(l => l.status === "done").length;
            const pct = Math.round((done / allLessons.length) * 100);
            const videoCount = allLessons.filter(l => l.type === "video").length;
            const pdfCount = allLessons.filter(l => l.type === "pdf").length;

            return (
              <Card
                key={course.id}
                className="group cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all overflow-hidden"
                onClick={() => onSelectCourse(course)}
              >
                <div className="h-1.5 w-full" style={{ background: course.color }} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: course.color + "22" }}>
                      <BookOpen className="h-5 w-5" style={{ color: course.color }} />
                    </div>
                    <Badge className="text-[10px] shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                      Đã sở hữu
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-sm text-foreground leading-snug mb-1 group-hover:text-primary transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">{course.subject}</p>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Tiến độ</span>
                      <span className="font-medium text-primary">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{done}/{allLessons.length} bài hoàn thành</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border pt-3">
                    <span className="flex items-center gap-1"><PlayCircle className="h-3 w-3" />{videoCount} video</span>
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{pdfCount} PDF</span>
                    <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{course.chapters.length} chương</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Gói tài liệu trả phí ── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Mua thêm tài liệu</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Các gói tài liệu nâng cao, bộ đề luyện thi THPT · Có bài xem thử miễn phí</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Tìm môn học, gói tài liệu..." className="pl-9 h-9"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {filteredPkg.map(pkg => {
            const tier = TIER_CONFIG[pkg.tier];
            const TierIcon = tier.icon;
            const discount = pkg.originalPrice
              ? Math.round((1 - pkg.price / pkg.originalPrice) * 100) : null;
            const totalLessons = pkg.chapters.flatMap(c => c.lessons).length;
            const previewCount = pkg.chapters.flatMap(c => c.lessons).filter(l => l.isPreview).length;

            return (
              <Card
                key={pkg.id}
                className={`group flex flex-col ring-1 ${tier.ring} hover:ring-primary/40 hover:shadow-lg transition-all`}
              >
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${tier.color}`}>
                      <TierIcon className="h-3 w-3" />{tier.label}
                    </span>
                    {discount && (
                      <span className="text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">
                        -{discount}%
                      </span>
                    )}
                  </div>

                  <Badge variant="outline" className="w-fit text-xs mb-2">{pkg.subject} · Khối {pkg.grade}</Badge>

                  <h3
                    className="font-semibold text-sm text-foreground leading-snug mb-2 group-hover:text-primary transition-colors cursor-pointer flex-1"
                    onClick={() => setSelectedPkg(pkg)}
                  >
                    {pkg.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{pkg.description}</p>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><PlayCircle className="h-3 w-3" />{totalLessons} bài</span>
                    {previewCount > 0 && (
                      <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
                        <Eye className="h-3 w-3" />{previewCount} xem thử
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mb-4">
                    <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-xs font-semibold">{pkg.rating}</span>
                    <span className="text-xs text-muted-foreground">({pkg.reviewCount})</span>
                  </div>

                  <div className="border-t border-border pt-3 mt-auto space-y-2">
                    {grantedPkgIds.includes(pkg.id) ? (
                      <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4" /> Đã sở hữu
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-base font-bold text-foreground">{fmt(pkg.price)}</p>
                            {pkg.originalPrice && (
                              <p className="text-xs text-muted-foreground line-through">{fmt(pkg.originalPrice)}</p>
                            )}
                          </div>
                          <Button size="sm" className="h-8 gap-1.5 text-xs"
                            onClick={() => router.push(`/student/checkout?pkg=${pkg.id}`)}>
                            <ShoppingCart className="h-3.5 w-3.5" /> Mua
                          </Button>
                        </div>
                        {previewCount > 0 && (
                          <button
                            onClick={() => setSelectedPkg(pkg)}
                            className="w-full text-xs text-violet-600 dark:text-violet-400 hover:underline flex items-center justify-center gap-1"
                          >
                            <Eye className="h-3 w-3" /> Xem thử {previewCount} bài miễn phí
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredPkg.length === 0 && (
            <div className="col-span-full py-10 text-center text-sm text-muted-foreground border-2 border-dashed border-border rounded-xl">
              Không tìm thấy gói tài liệu phù hợp
            </div>
          )}
        </div>
      </section>

      {/* Modals */}
      {selectedPkg && !previewLesson && (
        <PackageModal
          pkg={selectedPkg}
          onClose={() => setSelectedPkg(null)}
          onPreview={lesson => setPreviewLesson({ lesson, pkg: selectedPkg })}
          onBuy={() => { setSelectedPkg(null); router.push(`/student/checkout?pkg=${selectedPkg.id}`); }}
        />
      )}
      {previewLesson && (
        <PreviewPlayerModal
          lesson={previewLesson.lesson}
          packageTitle={previewLesson.pkg.title}
          onClose={() => setPreviewLesson(null)}
          onBuy={() => { setPreviewLesson(null); setSelectedPkg(previewLesson.pkg); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Player view (owned courses)
// ─────────────────────────────────────────────────────────────────────────────

function PlayerView({ course, onBack }: { course: OwnedCourse; onBack: () => void }) {
  const allLessons = course.chapters.flatMap(ch => ch.lessons);
  const doneCount = allLessons.filter(l => l.status === "done").length;
  const progress = Math.round((doneCount / allLessons.length) * 100);

  const firstAccessible = allLessons.find(l => l.status !== "locked") ?? allLessons[0];
  const [selectedId, setSelectedId] = useState(firstAccessible.id);
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
            const isOpen = openChapters.includes(chapter.id);
            const chDone = chapter.lessons.filter(l => isDone(l.id)).length;
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
                    {chapter.lessons.map(lesson => {
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
                            <Eye className="h-3 w-3 text-violet-500 shrink-0" title="Xem trước miễn phí" />
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

// ─────────────────────────────────────────────────────────────────────────────
// Page root
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentMaterialsPage() {
  const [selectedCourse, setSelectedCourse] = useState<OwnedCourse | null>(null);
  return (
    <PortalLayout role="student" userName="" pageTitle="Tài liệu">
      <div className="max-w-7xl mx-auto">
        {selectedCourse
          ? <PlayerView course={selectedCourse} onBack={() => setSelectedCourse(null)} />
          : <BrowseView onSelectCourse={setSelectedCourse} />}
      </div>
    </PortalLayout>
  );
}
