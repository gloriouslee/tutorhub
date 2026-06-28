import { createClient } from "./supabase/client";
import { Student, Teacher, Class, Payment, Attendance, Notification, ClassSchedule } from "@/types";
import {
  MOCK_STUDENTS, MOCK_TEACHERS, MOCK_CLASSES,
  MOCK_PAYMENTS, MOCK_ATTENDANCE, MOCK_NOTIFICATIONS,
} from "@/lib/mock-data";

const supabase = createClient();

// Helper: attempt a Supabase query; on any error fall back to mock data silently.
async function queryOrFallback<T>(
  query: () => Promise<{ data: T[] | null; error: unknown }>,
  fallback: T[]
): Promise<T[]> {
  try {
    const { data, error } = await query();
    if (error || !data) return fallback;
    return data;
  } catch {
    return fallback;
  }
}

export async function getStudents(): Promise<Student[]> {
  return queryOrFallback(
    () => supabase.from("students").select("*").order("created_at", { ascending: false }),
    MOCK_STUDENTS as unknown as Student[]
  );
}

export async function saveStudents(students: Student[]): Promise<void> {
  const { error } = await supabase.from("students").upsert(students);
  if (error) console.error("Error saving students:", error);
}

export async function getTeachers(): Promise<Teacher[]> {
  return queryOrFallback(
    () => supabase.from("teachers").select("*").order("created_at", { ascending: false }),
    MOCK_TEACHERS as unknown as Teacher[]
  );
}

export async function saveTeachers(teachers: Teacher[]): Promise<void> {
  const { error } = await supabase.from("teachers").upsert(teachers);
  if (error) console.error("Error saving teachers:", error);
}

export async function getClasses(): Promise<Class[]> {
  return queryOrFallback(
    () => supabase.from("classes").select("*").order("created_at", { ascending: false }),
    MOCK_CLASSES as unknown as Class[]
  );
}

export async function saveClasses(classes: Class[]): Promise<void> {
  const { error } = await supabase.from("classes").upsert(classes);
  if (error) console.error("Error saving classes:", error);
}

export async function getPayments(): Promise<Payment[]> {
  return queryOrFallback(
    () => supabase.from("payments").select("*").order("created_at", { ascending: false }),
    MOCK_PAYMENTS as unknown as Payment[]
  );
}

export async function savePayments(payments: Payment[]): Promise<void> {
  const { error } = await supabase.from("payments").upsert(payments);
  if (error) console.error("Error saving payments:", error);
}

export async function getAttendance(): Promise<Attendance[]> {
  return queryOrFallback(
    () => supabase.from("attendance").select("*").order("attendance_date", { ascending: false }),
    MOCK_ATTENDANCE as unknown as Attendance[]
  );
}

export async function saveAttendance(attendance: Attendance[]): Promise<void> {
  const { error } = await supabase.from("attendance").upsert(attendance);
  if (error) console.error("Error saving attendance:", error);
}

export async function getNotifications(): Promise<Notification[]> {
  return queryOrFallback(
    () => supabase.from("notifications").select("*").order("created_at", { ascending: false }),
    MOCK_NOTIFICATIONS as unknown as Notification[]
  );
}

export async function saveNotifications(notifications: Notification[]): Promise<void> {
  const { error } = await supabase.from("notifications").upsert(notifications);
  if (error) console.error("Error saving notifications:", error);
}

export async function resetAllStorage(): Promise<void> {
  console.log("Reset storage is deprecated; using database.");
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

// ── Material purchase transactions (localStorage) ────────────────────────────

export type TxStatus = "pending" | "approved" | "rejected";

export interface PurchaseTransaction {
  id: string;
  pkg_id: string;
  pkg_title: string;
  amount: number;
  student_id: string;
  student_name: string;
  student_email: string;
  transfer_note: string;
  status: TxStatus;
  created_at: string;
  reviewed_at?: string;
}

const TX_KEY = "tutorhub_transactions";
const ACCESS_KEY = "tutorhub_pkg_access";

export function getTransactions(): PurchaseTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TX_KEY);
    return raw ? (JSON.parse(raw) as PurchaseTransaction[]) : [];
  } catch { return []; }
}

export function createTransaction(tx: Omit<PurchaseTransaction, "id" | "created_at" | "status">): PurchaseTransaction {
  const full: PurchaseTransaction = { ...tx, id: crypto.randomUUID(), created_at: new Date().toISOString(), status: "pending" };
  const existing = getTransactions();
  localStorage.setItem(TX_KEY, JSON.stringify([full, ...existing]));
  return full;
}

export function updateTransactionStatus(txId: string, status: "approved" | "rejected"): void {
  if (typeof window === "undefined") return;
  const txs = getTransactions().map(t =>
    t.id === txId ? { ...t, status, reviewed_at: new Date().toISOString() } : t
  );
  localStorage.setItem(TX_KEY, JSON.stringify(txs));
  if (status === "approved") {
    const tx = txs.find(t => t.id === txId);
    if (tx) grantPackageAccess(tx.pkg_id);
  }
}

export function grantPackageAccess(pkgId: string): void {
  if (typeof window === "undefined") return;
  const existing = getGrantedPackages();
  if (!existing.includes(pkgId)) {
    localStorage.setItem(ACCESS_KEY, JSON.stringify([...existing, pkgId]));
  }
}

export function getGrantedPackages(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACCESS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

export function markScheduleNotificationsRead(): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getScheduleNotifications().map(n => ({ ...n, is_read: true }));
    localStorage.setItem("tutorhub_schedule_notifications", JSON.stringify(existing));
  } catch { /* ignore */ }
}

// ── Enrollment requests (localStorage) ──────────────────────────────────────

export type EnrollmentStatus = "pending" | "approved" | "rejected";

export interface EnrollmentRequest {
  id: string;
  // Student info from form
  full_name: string;
  email: string;
  dob: string;
  school: string;
  grade: string;
  requested_class_id: string;
  parent_phone: string;
  note?: string;
  // Admin fields (set on approval)
  status: EnrollmentStatus;
  assigned_class_id?: string;
  account_username?: string;
  account_password?: string;
  reject_reason?: string;
  created_at: string;
  reviewed_at?: string;
}

export interface StudentAccount {
  student_id: string;          // e.g. "enr_<id>"
  full_name: string;
  email: string;
  dob: string;
  school: string;
  grade: string;
  assigned_class_id: string;
  parent_phone: string;
  username: string;
  created_at: string;
}

const ENROLL_KEY  = "tutorhub_enrollments";
const ACCOUNT_KEY = "tutorhub_student_accounts";

export function getEnrollments(): EnrollmentRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ENROLL_KEY);
    return raw ? (JSON.parse(raw) as EnrollmentRequest[]) : [];
  } catch { return []; }
}

export function createEnrollment(
  data: Omit<EnrollmentRequest, "id" | "status" | "created_at">
): EnrollmentRequest {
  const request: EnrollmentRequest = {
    ...data,
    id: crypto.randomUUID(),
    status: "pending",
    created_at: new Date().toISOString(),
  };
  const existing = getEnrollments();
  localStorage.setItem(ENROLL_KEY, JSON.stringify([request, ...existing]));
  return request;
}

export function approveEnrollment(
  id: string,
  opts: {
    assigned_class_id: string;
    account_username: string;
    account_password: string;
  }
): void {
  if (typeof window === "undefined") return;
  const enrollments = getEnrollments().map(e =>
    e.id === id
      ? { ...e, status: "approved" as EnrollmentStatus, ...opts, reviewed_at: new Date().toISOString() }
      : e
  );
  localStorage.setItem(ENROLL_KEY, JSON.stringify(enrollments));

  // Create student account record
  const enr = enrollments.find(e => e.id === id)!;
  const account: StudentAccount = {
    student_id:        `enr_${id}`,
    full_name:         enr.full_name,
    email:             enr.email,
    dob:               enr.dob,
    school:            enr.school,
    grade:             enr.grade,
    assigned_class_id: opts.assigned_class_id,
    parent_phone:      enr.parent_phone,
    username:          opts.account_username,
    created_at:        new Date().toISOString(),
  };
  const accounts = getStudentAccounts();
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify([
    ...accounts.filter(a => a.student_id !== account.student_id),
    account,
  ]));
}

export function rejectEnrollment(id: string, reason?: string): void {
  if (typeof window === "undefined") return;
  const enrollments = getEnrollments().map(e =>
    e.id === id
      ? { ...e, status: "rejected" as EnrollmentStatus, reject_reason: reason, reviewed_at: new Date().toISOString() }
      : e
  );
  localStorage.setItem(ENROLL_KEY, JSON.stringify(enrollments));
}

export function getStudentAccounts(): StudentAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as StudentAccount[]) : [];
  } catch { return []; }
}

// Returns the account for the demo student (s1) if an approved enrollment exists,
// otherwise null (caller falls back to MOCK_STUDENTS).
export function getCurrentStudentAccount(): StudentAccount | null {
  // In a real app this would use session/auth. Here we just return the most
  // recently approved account as a demo stand-in.
  const accounts = getStudentAccounts();
  return accounts.length > 0 ? accounts[accounts.length - 1] : null;
}
