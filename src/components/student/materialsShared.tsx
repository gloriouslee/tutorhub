"use client";

import type React from "react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { StudentPackage } from "@/lib/storage";
import { getTeacherMaterials } from "@/lib/storage";
import {
  PlayCircle,
  FileText,
  Pencil,
  Star,
  Zap,
  Crown,
  Tag,
  Wifi,
  School,
} from "lucide-react";

export type LessonType = "video" | "pdf" | "exercise";
export type LessonStatus = "done" | "active" | "locked";

export interface Attachment {
  name: string;
  size: string;
  type: "pdf" | "exercise";
}

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  duration?: string;
  status: LessonStatus;
  description?: string;
  attachments?: Attachment[];
  isPreview?: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface OwnedCourse {
  id: string;
  classId: string;
  title: string;
  subject: string;
  color: string;
  chapters: Chapter[];
}

export interface PaidLesson {
  id: string;
  title: string;
  type: LessonType;
  duration?: string;
  isPreview: boolean;
}

export interface PaidChapter {
  id: string;
  title: string;
  lessons: PaidLesson[];
}

export interface PaidPackage {
  id: string;
  title: string;
  subject: string;
  grade: number;
  price: number;
  originalPrice?: number;
  tier: "basic" | "pro" | "elite";
  description: string;
  includes: string[];
  rating: number;
  reviewCount: number;
  chapters: PaidChapter[];
}

export interface TeacherCourse {
  id: string;
  classId?: string;
  packages: StudentPackage[];
  type?: "class" | "paid_package";
  title?: string;
  subject?: string;
  grade?: number;
  price?: number;
  originalPrice?: number;
  tier?: string;
  description?: string;
  includes?: string[];
  rating?: number;
  reviewCount?: number;
  chapters?: Array<{
    id: string;
    title: string;
    lessons: Array<
      PaidLesson & {
        description?: string;
        fileName?: string;
        fileSize?: string;
      }
    >;
  }>;
  published?: boolean;
}

export async function loadTeacherCourses(): Promise<TeacherCourse[]> {
  try {
    return await getTeacherMaterials<TeacherCourse>();
  } catch {
    return [];
  }
}

export function teacherCourseToOwnedCourse(
  course: TeacherCourse,
  color: string,
): OwnedCourse | null {
  if (!course.classId || !course.title) return null;
  return {
    id: course.id,
    classId: course.classId,
    title: course.title,
    subject: course.subject ?? "",
    color,
    chapters: (course.chapters ?? []).map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      lessons: chapter.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        duration: lesson.duration,
        status: "active",
        description: lesson.description,
        isPreview: lesson.isPreview,
        attachments: lesson.fileName
          ? [{
              name: lesson.fileName,
              size: lesson.fileSize ?? "",
              type: lesson.type === "exercise" ? "exercise" : "pdf",
            }]
          : undefined,
      })),
    })),
  };
}

export function teacherCourseToPaidPackage(course: TeacherCourse): PaidPackage {
  return {
    id: course.id,
    title: course.title ?? "Gói tài liệu",
    subject: course.subject ?? "Chung",
    grade: course.grade ?? 12,
    price: course.price ?? 0,
    originalPrice: course.originalPrice,
    tier: (course.tier as PaidPackage["tier"]) ?? "basic",
    description: course.description ?? "",
    includes: course.includes ?? [],
    rating: course.rating ?? 0,
    reviewCount: course.reviewCount ?? 0,
    chapters: course.chapters ?? [],
  };
}

export const PKG_META: Record<
  StudentPackage,
  { label: string; icon: React.ElementType; color: string }
> = {
  online: {
    label: "Online",
    icon: Wifi,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  advanced: {
    label: "Nâng cao",
    icon: Star,
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  offline: {
    label: "Offline",
    icon: School,
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
};

export const fmt = formatCurrency;

export function LessonIcon({
  type,
  className,
}: {
  type: LessonType;
  className?: string;
}) {
  if (type === "video") {
    return <PlayCircle className={className ?? "h-4 w-4"} />;
  }
  if (type === "pdf") {
    return <FileText className={className ?? "h-4 w-4"} />;
  }
  return <Pencil className={className ?? "h-4 w-4"} />;
}

export function TypeBadge({ type }: { type: LessonType }) {
  if (type === "video") {
    return (
      <Badge className="border-0 bg-blue-100 px-1.5 text-[10px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
        Video
      </Badge>
    );
  }
  if (type === "pdf") {
    return (
      <Badge className="border-0 bg-red-100 px-1.5 text-[10px] text-red-700 dark:bg-red-900/30 dark:text-red-400">
        PDF
      </Badge>
    );
  }
  return (
    <Badge className="border-0 bg-green-100 px-1.5 text-[10px] text-green-700 dark:bg-green-900/30 dark:text-green-400">
      Bài tập
    </Badge>
  );
}

export const TIER_CONFIG = {
  basic: {
    label: "Basic",
    icon: Tag,
    color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    ring: "ring-slate-200 dark:ring-slate-700",
  },
  pro: {
    label: "Pro",
    icon: Zap,
    color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    ring: "ring-violet-200 dark:ring-violet-800",
  },
  elite: {
    label: "Elite",
    icon: Crown,
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    ring: "ring-amber-200 dark:ring-amber-800",
  },
};
