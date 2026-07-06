"use client";

import type React from "react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { StudentPackage } from "@/lib/storage";
import { kvGet } from "@/lib/storage";
import {
  PlayCircle, FileText, Pencil,
  Star, Zap, Crown, Tag, Wifi, School,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type LessonType = "video" | "pdf" | "exercise";
export type LessonStatus = "done" | "active" | "locked";

export interface Attachment { name: string; size: string; type: "pdf" | "exercise" }

export interface Lesson {
  id: string; title: string; type: LessonType;
  duration?: string; status: LessonStatus;
  description?: string; attachments?: Attachment[];
  isPreview?: boolean;
}

export interface Chapter { id: string; title: string; lessons: Lesson[] }

export interface OwnedCourse {
  id: string; classId: string; title: string; subject: string;
  color: string; chapters: Chapter[];
}

export interface PaidLesson {
  id: string; title: string; type: LessonType;
  duration?: string; isPreview: boolean;
}

export interface PaidChapter {
  id: string; title: string; lessons: PaidLesson[];
}

export interface PaidPackage {
  id: string; title: string; subject: string; grade: number;
  price: number; originalPrice?: number; tier: "basic" | "pro" | "elite";
  description: string; includes: string[];
  rating: number; reviewCount: number;
  chapters: PaidChapter[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────────────────────

export const OWNED_COURSES: OwnedCourse[] = [
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

export const PAID_PACKAGES: PaidPackage[] = [
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


export interface TeacherCourse {
  id: string; classId?: string; packages: StudentPackage[];
  type?: string; title?: string; subject?: string; grade?: number;
  price?: number; originalPrice?: number; tier?: string;
  description?: string; includes?: string[]; rating?: number; reviewCount?: number;
  chapters?: PaidChapter[]; published?: boolean;
}

export async function loadTeacherCourses(): Promise<TeacherCourse[]> {
  try {
    const raw = typeof window !== "undefined"
      ? await kvGet<TeacherCourse[] | null>("tutorhub_teacher_materials", null)
      : null;
    if (raw) return raw;
  } catch {}
  return [
    { id: "tc1", classId: "c1", packages: ["online", "advanced", "offline"] },
    { id: "tc2", packages: ["advanced", "offline"] },
  ];
}

export function teacherCourseToPaidPackage(tc: TeacherCourse): PaidPackage {
  return {
    id: tc.id,
    title: tc.title ?? "Gói tài liệu",
    subject: tc.subject ?? "Chung",
    grade: tc.grade ?? 12,
    price: tc.price ?? 0,
    originalPrice: tc.originalPrice,
    tier: (tc.tier as PaidPackage["tier"]) ?? "basic",
    description: tc.description ?? "",
    includes: tc.includes ?? [],
    rating: tc.rating ?? 0,
    reviewCount: tc.reviewCount ?? 0,
    chapters: tc.chapters ?? [],
  };
}

export const PKG_META: Record<StudentPackage, { label: string; icon: React.ElementType; color: string }> = {
  online:   { label: "Online",   icon: Wifi,   color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  advanced: { label: "Nâng cao", icon: Star,   color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  offline:  { label: "Offline",  icon: School, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
};

export const fmt = formatCurrency;

export function LessonIcon({ type, className }: { type: LessonType; className?: string }) {
  if (type === "video") return <PlayCircle className={className ?? "h-4 w-4"} />;
  if (type === "pdf") return <FileText className={className ?? "h-4 w-4"} />;
  return <Pencil className={className ?? "h-4 w-4"} />;
}

export function TypeBadge({ type }: { type: LessonType }) {
  if (type === "video") return <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">Video</Badge>;
  if (type === "pdf") return <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">PDF</Badge>;
  return <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">Bài tập</Badge>;
}

export const TIER_CONFIG = {
  basic: { label: "Basic", icon: Tag,   color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", ring: "ring-slate-200 dark:ring-slate-700" },
  pro:   { label: "Pro",   icon: Zap,   color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400", ring: "ring-violet-200 dark:ring-violet-800" },
  elite: { label: "Elite", icon: Crown, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", ring: "ring-amber-200 dark:ring-amber-800" },
};
