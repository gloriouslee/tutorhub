import { ClassSchedule } from "@/types";
import { toLocalDateKey } from "@/lib/utils";
import type { HomeworkAttachment, StudentPackage } from "@/lib/storage";

export const DAYS_VI = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

export const DAY_TO_NUM: Record<string, number> = {
  Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 0,
  "Thứ 2": 1, "Thứ 3": 2, "Thứ 4": 3, "Thứ 5": 4, "Thứ 6": 5, "Thứ 7": 6, "Chủ nhật": 0,
};

export const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  formula:  { label: "Công thức", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  exam_prep:{ label: "Ôn thi",    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  summary:  { label: "Tóm tắt",   color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  textbook: { label: "Giáo trình",color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
};

export const PACKAGE_TYPES: Record<string, { label: string; color: string; description: string }> = {
  online:   { label: "Gói Online",   color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",   description: "Chỉ join online (Miễn phí)" },
  advanced: { label: "Gói Nâng cao", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", description: "Online + Tài liệu nâng cao" },
  offline:  { label: "Gói Offline",  color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",  description: "Học tại trung tâm + Full tài liệu" },
};

// Parse date-only strings as LOCAL midnight (avoid UTC shifting the day)
function parseLocalDate(dateStr: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(`${dateStr}T00:00:00`) : new Date(dateStr);
}

export function formatDate(dateStr: string) {
  return parseLocalDate(dateStr).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Session types ────────────────────────────────────────────────────────────

export interface Session {
  date: string;       // YYYY-MM-DD
  dayLabel: string;   // from toLocaleDateString("vi-VN", { weekday: "long" })
  start_time: string;
  end_time: string;
  isPast: boolean;
  isToday: boolean;
}

export function generateSessions(schedule: ClassSchedule[]): Session[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessions: Session[] = [];

  // Keep in sync with CurriculumTab.generateSlots (−12/+8 weeks)
  const pastWeeks = 12;
  const futureWeeks = 8;
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - pastWeeks * 7);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + futureWeeks * 7);

  for (const sched of schedule) {
    const targetDay = DAY_TO_NUM[sched.day];
    if (targetDay === undefined) continue;

    const cursor = new Date(startDate);
    // Align cursor to the target weekday
    const diff = (targetDay - cursor.getDay() + 7) % 7;
    cursor.setDate(cursor.getDate() + diff);

    while (cursor <= endDate) {
      const dateStr = toLocalDateKey(cursor);
      const cursorCopy = new Date(cursor);
      cursorCopy.setHours(0, 0, 0, 0);
      const isToday = cursorCopy.getTime() === today.getTime();
      const isPast = cursorCopy.getTime() < today.getTime();
      const dayLabel = cursorCopy.toLocaleDateString("vi-VN", { weekday: "long" });

      sessions.push({
        date: dateStr,
        dayLabel,
        start_time: sched.start_time,
        end_time: sched.end_time,
        isPast,
        isToday,
      });

      cursor.setDate(cursor.getDate() + 7);
    }
  }

  sessions.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
  return sessions;
}

// ── Homework types ───────────────────────────────────────────────────────────

export interface Homework {
  id: string;
  class_id: string;
  title: string;
  description?: string;
  due_date: string;
  created_at: string;
  attachment?: HomeworkAttachment;
  /** undefined/null = giao cho cả lớp; string[] = danh sách student_id được giao */
  assigned_to?: string[] | null;
}

export interface Submission {
  id: string;
  homework_id: string;
  student_id: string;
  score?: number;
}

export function dueStatus(dueDate: string): { label: string; color: string } {
  const now = new Date();
  const due = parseLocalDate(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: "Đã hết hạn", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (diffDays === 0) return { label: "Hôm nay", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  if (diffDays <= 3) return { label: `Còn ${diffDays} ngày`, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" };
  return { label: `Còn ${diffDays} ngày`, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
}

// ── Attendance types ─────────────────────────────────────────────────────────

export type AttendanceStatus = "present" | "absent" | "late";

export interface SavedAttendanceRecord {
  class_id: string;
  student_id: string;
  date: string;
  status: AttendanceStatus;
  saved_at: string;
}

export type { StudentPackage };
