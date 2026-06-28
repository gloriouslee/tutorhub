"use client";

import { useState } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MOCK_CLASSES } from "@/lib/mock-data";
import {
  PlayCircle, FileText, Pencil, Download, CheckCircle2,
  ChevronDown, ChevronRight, BookOpen, Clock, StickyNote,
  MessageSquare, Check, ArrowLeft, Search, ShoppingCart,
  Lock, Star, Tag, Layers, Zap, Crown, X,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type LessonType = "video" | "pdf" | "exercise";
type LessonStatus = "done" | "active" | "locked";

interface Attachment { name: string; size: string; type: "pdf" | "exercise" }
interface Lesson {
  id: string; title: string; type: LessonType; duration?: string;
  status: LessonStatus; description?: string; attachments?: Attachment[];
}
interface Chapter { id: string; title: string; lessons: Lesson[] }
interface OwnedCourse {
  id: string; classId: string; title: string; subject: string;
  color: string; chapters: Chapter[]; lastAccessed?: string;
}

interface PaidPackage {
  id: string; title: string; subject: string; grade: number;
  price: number; originalPrice?: number; tier: "basic" | "pro" | "elite";
  description: string; includes: string[]; lessonCount: number;
  videoCount: number; rating: number; reviewCount: number;
  previewChapters: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock data — owned courses
// ─────────────────────────────────────────────────────────────────────────────

const OWNED_COURSES: OwnedCourse[] = [
  {
    id: "oc1", classId: "c1",
    title: "Toán 12 — Giải tích & Hình học", subject: "Toán học", color: "#6366f1",
    lastAccessed: "2026-06-27",
    chapters: [
      {
        id: "ch1", title: "Hàm số & đồ thị",
        lessons: [
          { id: "l1", title: "Lý thuyết hàm số bậc 3", type: "video", duration: "18:40", status: "done",
            description: "Giới thiệu tổng quan hàm số bậc 3, hướng dẫn vẽ đồ thị và nhận dạng dạng bài.",
            attachments: [{ name: "Lý thuyết hàm số bậc 3.pdf", size: "2.4 MB", type: "pdf" }] },
          { id: "l2", title: "Công thức tổng hợp hàm số", type: "pdf", status: "done",
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
    lastAccessed: "2026-06-25",
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

// ─────────────────────────────────────────────────────────────────────────────
// Mock data — paid packages
// ─────────────────────────────────────────────────────────────────────────────

const PAID_PACKAGES: PaidPackage[] = [
  {
    id: "pp1", title: "Toán 12 — Siêu Ôn Luyện THPT Quốc Gia",
    subject: "Toán học", grade: 12, price: 299000, originalPrice: 499000,
    tier: "pro",
    description: "Bộ tài liệu toàn diện nhất cho kỳ thi THPT, bao gồm video bài giảng, bộ đề và đáp án chi tiết.",
    includes: ["32 video bài giảng HD", "500 bài tập có đáp án", "10 đề thi thử THPT", "Tóm tắt lý thuyết mỗi chương"],
    lessonCount: 48, videoCount: 32, rating: 4.9, reviewCount: 218,
    previewChapters: ["Hàm số & đồ thị", "Đạo hàm", "Tích phân", "Số phức", "Hình học Oxyz"],
  },
  {
    id: "pp2", title: "Vật Lý 12 — Điện xoay chiều & Sóng",
    subject: "Vật lý", grade: 12, price: 199000,
    tier: "basic",
    description: "Toàn bộ phần Điện xoay chiều và Sóng cơ — hai chủ đề quan trọng nhất trong đề thi THPT Vật Lý.",
    includes: ["18 video bài giảng", "200 bài tập trắc nghiệm", "6 đề thi thử", "File tóm tắt công thức"],
    lessonCount: 24, videoCount: 18, rating: 4.7, reviewCount: 143,
    previewChapters: ["Dao động điều hòa", "Điện xoay chiều", "Sóng cơ học", "Sóng ánh sáng"],
  },
  {
    id: "pp3", title: "Hóa Học 12 — Lý thuyết & Bài tập nâng cao",
    subject: "Hóa học", grade: 12, price: 349000, originalPrice: 550000,
    tier: "elite",
    description: "Gói tài liệu nâng cao cho học sinh muốn đạt 9+ môn Hóa, bao gồm cả phần Hóa hữu cơ và vô cơ.",
    includes: ["45 video bài giảng", "700+ bài tập phân loại", "15 đề ôn chuyên đề", "Bảng phản ứng hóa học tổng hợp", "Hỗ trợ Q&A qua Zalo nhóm"],
    lessonCount: 60, videoCount: 45, rating: 4.8, reviewCount: 87,
    previewChapters: ["Este & Lipit", "Amin & Amino axit", "Polyme", "Kim loại kiềm", "Crom & Sắt"],
  },
  {
    id: "pp4", title: "Tiếng Anh 12 — Ngữ pháp & Từ vựng",
    subject: "Tiếng Anh", grade: 12, price: 149000,
    tier: "basic",
    description: "Hệ thống toàn bộ ngữ pháp và từ vựng Tiếng Anh 12 theo cấu trúc đề thi THPT.",
    includes: ["24 video bài giảng", "300 câu trắc nghiệm ngữ pháp", "Flash cards từ vựng", "5 đề thi thử"],
    lessonCount: 30, videoCount: 24, rating: 4.6, reviewCount: 195,
    previewChapters: ["Thì và thể", "Câu điều kiện", "Từ vựng theo chủ đề", "Đọc hiểu nâng cao"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

function LessonIcon({ type, size = 16 }: { type: LessonType; size?: number }) {
  const s = `h-${size === 20 ? 5 : 4} w-${size === 20 ? 5 : 4}`;
  if (type === "video") return <PlayCircle className={s} />;
  if (type === "pdf") return <FileText className={s} />;
  return <Pencil className={s} />;
}

function TypeBadge({ type }: { type: LessonType }) {
  if (type === "video") return <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">Video</Badge>;
  if (type === "pdf") return <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">PDF</Badge>;
  return <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">Bài tập</Badge>;
}

const TIER_CONFIG = {
  basic: { label: "Basic", icon: Tag, color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", ring: "ring-slate-200 dark:ring-slate-700" },
  pro:   { label: "Pro",   icon: Zap, color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400", ring: "ring-violet-200 dark:ring-violet-800" },
  elite: { label: "Elite", icon: Crown, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", ring: "ring-amber-200 dark:ring-amber-800" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Purchase modal
// ─────────────────────────────────────────────────────────────────────────────

function PurchaseModal({ pkg, onClose }: { pkg: PaidPackage; onClose: () => void }) {
  const tier = TIER_CONFIG[pkg.tier];
  const TierIcon = tier.icon;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${tier.color}`}>
              <TierIcon className="h-3 w-3" />{tier.label}
            </span>
            <h3 className="font-semibold text-foreground text-sm">{pkg.title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-foreground">{fmt(pkg.price)}</p>
              {pkg.originalPrice && (
                <p className="text-sm text-muted-foreground line-through">{fmt(pkg.originalPrice)}</p>
              )}
            </div>
            {pkg.originalPrice && (
              <span className="text-xs font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-1 rounded-full">
                -{Math.round((1 - pkg.price / pkg.originalPrice) * 100)}%
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bao gồm</p>
            {pkg.includes.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                {item}
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Xem trước chương</p>
            <div className="flex flex-wrap gap-1.5">
              {pkg.previewChapters.map(ch => (
                <span key={ch} className="text-xs bg-muted px-2.5 py-1 rounded-lg text-foreground">{ch}</span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <div className="flex text-amber-400 text-sm">{"★".repeat(Math.floor(pkg.rating))}</div>
            <span className="text-sm font-semibold">{pkg.rating}</span>
            <span className="text-sm text-muted-foreground">({pkg.reviewCount} đánh giá)</span>
          </div>
        </div>

        <div className="p-5 border-t border-border flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Để sau</Button>
          <Button className="flex-1 gap-2" onClick={onClose}>
            <ShoppingCart className="h-4 w-4" /> Mua ngay
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Browse view
// ─────────────────────────────────────────────────────────────────────────────

function BrowseView({
  onSelectCourse,
}: {
  onSelectCourse: (course: OwnedCourse) => void;
}) {
  const [search, setSearch] = useState("");
  const [purchasingPkg, setPurchasingPkg] = useState<PaidPackage | null>(null);

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

        {OWNED_COURSES.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-xl py-10 text-center text-sm text-muted-foreground">
            Bạn chưa có tài liệu nào. Đăng ký lớp học để bắt đầu.
          </div>
        ) : (
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
                  {/* Color bar */}
                  <div className="h-1.5 w-full" style={{ background: course.color }} />

                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: course.color + "22" }}>
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
        )}
      </section>

      {/* ── Gói tài liệu trả phí ── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Mua thêm tài liệu</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Các gói tài liệu nâng cao, bộ đề luyện thi THPT</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm môn học, gói tài liệu..."
              className="pl-9 h-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          {filteredPkg.map(pkg => {
            const tier = TIER_CONFIG[pkg.tier];
            const TierIcon = tier.icon;
            const discount = pkg.originalPrice
              ? Math.round((1 - pkg.price / pkg.originalPrice) * 100)
              : null;

            return (
              <Card
                key={pkg.id}
                className={`group cursor-pointer hover:shadow-lg transition-all ring-1 ${tier.ring} hover:ring-primary/40`}
                onClick={() => setPurchasingPkg(pkg)}
              >
                <CardContent className="p-5 flex flex-col h-full">
                  {/* Tier + discount */}
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

                  {/* Subject badge */}
                  <Badge variant="outline" className="w-fit text-xs mb-2">{pkg.subject} · Khối {pkg.grade}</Badge>

                  <h3 className="font-semibold text-sm text-foreground leading-snug mb-2 group-hover:text-primary transition-colors flex-1">
                    {pkg.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{pkg.description}</p>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                    <span className="flex items-center gap-1"><PlayCircle className="h-3 w-3" />{pkg.videoCount} video</span>
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{pkg.lessonCount} bài</span>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-1.5 mb-4">
                    <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-xs font-semibold">{pkg.rating}</span>
                    <span className="text-xs text-muted-foreground">({pkg.reviewCount})</span>
                  </div>

                  {/* Price */}
                  <div className="flex items-center justify-between border-t border-border pt-3 mt-auto">
                    <div>
                      <p className="text-base font-bold text-foreground">{fmt(pkg.price)}</p>
                      {pkg.originalPrice && (
                        <p className="text-xs text-muted-foreground line-through">{fmt(pkg.originalPrice)}</p>
                      )}
                    </div>
                    <Button size="sm" className="h-8 gap-1.5 text-xs shrink-0">
                      <ShoppingCart className="h-3.5 w-3.5" /> Mua
                    </Button>
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

      {purchasingPkg && (
        <PurchaseModal pkg={purchasingPkg} onClose={() => setPurchasingPkg(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Player view (existing course player)
// ─────────────────────────────────────────────────────────────────────────────

function PlayerView({ course, onBack }: { course: OwnedCourse; onBack: () => void }) {
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Tài liệu
          </button>
          <span className="text-muted-foreground/40">/</span>
          <h1 className="text-base font-semibold text-foreground">{course.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">{doneCount}/{allLessons.length} bài</div>
          <div className="w-28 h-2 bg-muted rounded-full overflow-hidden">
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
                      const accessible = lesson.status !== "locked" || done;
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => accessible ? setSelectedId(lesson.id) : null}
                          className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors
                            ${isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/40 text-foreground/80"}
                            ${!accessible ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <div className={`w-2 h-2 rounded-full shrink-0 ${done ? "bg-green-500" : isSelected ? "bg-primary" : "border border-muted-foreground"}`} />
                          <span className="flex-1 text-xs leading-snug line-clamp-2">{lesson.title}</span>
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
            <div className="bg-black flex items-center justify-center relative" style={{ height: "280px" }}>
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
            <div className="flex items-center justify-center bg-muted/30 border-b border-border" style={{ height: "140px" }}>
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <LessonIcon type={selected.type} size={20} />
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
                <textarea
                  className="w-full h-32 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                  placeholder="Ghi chú của bạn về bài học này..."
                />
              )}
              {activeTab === "discuss" && (
                <div className="text-center py-8 text-muted-foreground text-sm">Chức năng thảo luận đang được phát triển</div>
              )}
            </div>

            <div className="flex items-center gap-2 px-6 pb-5 pt-2 border-t border-border">
              <Button variant="outline" size="sm" className="gap-1.5" disabled={!prevLesson}
                onClick={() => prevLesson && setSelectedId(prevLesson.id)}>
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
                <Button size="sm" variant="outline" className="gap-1.5" disabled={!nextLesson}
                  onClick={() => nextLesson && setSelectedId(nextLesson.id)}>
                  Bài tiếp →
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentMaterialsPage() {
  const [selectedCourse, setSelectedCourse] = useState<OwnedCourse | null>(null);

  return (
    <PortalLayout role="student" userName="" pageTitle="Tài liệu">
      <div className="max-w-7xl mx-auto">
        {selectedCourse ? (
          <PlayerView course={selectedCourse} onBack={() => setSelectedCourse(null)} />
        ) : (
          <BrowseView onSelectCourse={setSelectedCourse} />
        )}
      </div>
    </PortalLayout>
  );
}
