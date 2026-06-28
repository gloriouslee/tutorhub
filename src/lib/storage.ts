import { createClient } from "./supabase/client";
import { Student, Teacher, Class, Payment, Attendance, Notification, ClassSchedule } from "@/types";

const supabase = createClient();

export async function getStudents(): Promise<Student[]> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching students:", error);
    return [];
  }
  return data as Student[];
}

export async function saveStudents(students: Student[]): Promise<void> {
  const { error } = await supabase.from("students").upsert(students);
  if (error) {
    console.error("Error saving students:", error);
  }
}

export async function getTeachers(): Promise<Teacher[]> {
  const { data, error } = await supabase
    .from("teachers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching teachers:", error);
    return [];
  }
  return data as Teacher[];
}

export async function saveTeachers(teachers: Teacher[]): Promise<void> {
  const { error } = await supabase.from("teachers").upsert(teachers);
  if (error) {
    console.error("Error saving teachers:", error);
  }
}

export async function getClasses(): Promise<Class[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching classes:", error);
    return [];
  }
  return data as Class[];
}

export async function saveClasses(classes: Class[]): Promise<void> {
  const { error } = await supabase.from("classes").upsert(classes);
  if (error) {
    console.error("Error saving classes:", error);
  }
}

export async function getPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching payments:", error);
    return [];
  }
  return data as Payment[];
}

export async function savePayments(payments: Payment[]): Promise<void> {
  const { error } = await supabase.from("payments").upsert(payments);
  if (error) {
    console.error("Error saving payments:", error);
  }
}

export async function getAttendance(): Promise<Attendance[]> {
  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .order("attendance_date", { ascending: false });
  if (error) {
    console.error("Error fetching attendance:", error);
    return [];
  }
  return data as Attendance[];
}

export async function saveAttendance(attendance: Attendance[]): Promise<void> {
  const { error } = await supabase.from("attendance").upsert(attendance);
  if (error) {
    console.error("Error saving attendance:", error);
  }
}

export async function getNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }
  return data as Notification[];
}

export async function saveNotifications(notifications: Notification[]): Promise<void> {
  const { error } = await supabase.from("notifications").upsert(notifications);
  if (error) {
    console.error("Error saving notifications:", error);
  }
}

export async function resetAllStorage(): Promise<void> {
  console.log("Reset storage is deprecated now using database.");
}

export async function getStudentComments(studentId: string): Promise<{ text: string; date: string; rating: number }[]> {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(`tutorhub_comments_${studentId}`);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error("Error reading comments from localStorage", e);
  }
  // Default fallback mock data
  if (studentId === "s1") {
    return [
      { date: "2026-06-25", text: "Tiếp thu bài nhanh, làm đầy đủ bài tập về nhà.", rating: 5 },
      { date: "2026-06-22", text: "Hơi mất tập trung ở nửa đầu buổi học.", rating: 4 }
    ];
  }
  if (studentId === "s2") {
    return [
      { date: "2026-06-25", text: "Có tiến bộ trong phần giải bài tập hình học.", rating: 5 }
    ];
  }
  return [];
}

export async function saveStudentComment(studentId: string, commentsList: { text: string; date: string; rating: number }[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`tutorhub_comments_${studentId}`, JSON.stringify(commentsList));
  } catch (e) {
    console.error("Error saving comments to localStorage", e);
  }
}

// ── Schedule overrides (localStorage) ───────────────────────────────────────

export function getClassScheduleOverride(classId: string): ClassSchedule[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`tutorhub_schedule_${classId}`);
    if (raw) return JSON.parse(raw) as ClassSchedule[];
  } catch { /* ignore */ }
  return null;
}

export function saveClassScheduleOverride(classId: string, schedule: ClassSchedule[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`tutorhub_schedule_${classId}`, JSON.stringify(schedule));
  } catch (e) {
    console.error("Error saving schedule to localStorage", e);
  }
}

// ── Schedule-change notifications (localStorage) ─────────────────────────────

export interface ScheduleNotification {
  id: string;
  class_id: string;
  class_name: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

export function getScheduleNotifications(): ScheduleNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("tutorhub_schedule_notifications");
    if (raw) return JSON.parse(raw) as ScheduleNotification[];
  } catch { /* ignore */ }
  return [];
}

export function pushScheduleNotification(notif: Omit<ScheduleNotification, "id" | "created_at" | "is_read">): void {
  if (typeof window === "undefined") return;
  const existing = getScheduleNotifications();
  const next: ScheduleNotification = {
    ...notif,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    is_read: false,
  };
  try {
    localStorage.setItem("tutorhub_schedule_notifications", JSON.stringify([next, ...existing]));
  } catch (e) {
    console.error("Error saving schedule notification", e);
  }
}

export function markScheduleNotificationsRead(): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getScheduleNotifications().map(n => ({ ...n, is_read: true }));
    localStorage.setItem("tutorhub_schedule_notifications", JSON.stringify(existing));
  } catch { /* ignore */ }
}
