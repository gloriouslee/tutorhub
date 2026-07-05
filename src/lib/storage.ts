import { createClient } from "./supabase/client";
import { Student, Teacher, Class, Payment, Attendance, Notification, ClassSchedule } from "@/types";
import {
  MOCK_STUDENTS, MOCK_TEACHERS, MOCK_CLASSES,
  MOCK_PAYMENTS, MOCK_ATTENDANCE, MOCK_NOTIFICATIONS,
} from "@/lib/mock-data";

const supabase = createClient();

// localStorage keys for the six core entity lists (demo-mode persistence)
const ENTITY_KEYS = {
  students: "tutorhub_students",
  teachers: "tutorhub_teachers",
  classes: "tutorhub_classes",
  payments: "tutorhub_payments",
  attendance: "tutorhub_attendance",
  notifications: "tutorhub_notifications",
} as const;

function readLocal<T>(key: string): T[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T[];
  } catch (e) {
    console.error(`Error reading ${key} from localStorage`, e);
  }
  return null;
}

function writeLocal<T>(key: string, items: T[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    console.error(`Error writing ${key} to localStorage`, e);
  }
}

// Helper: attempt a Supabase query; on any error OR empty result fall back to mock data silently.
async function queryOrFallback<T>(
  query: () => Promise<{ data: T[] | null; error: unknown }>,
  fallback: T[]
): Promise<T[]> {
  try {
    const { data, error } = await query();
    if (error || !data || data.length === 0) return fallback;
    return data;
  } catch {
    return fallback;
  }
}

// Supabase-first getter: DB là nguồn dữ liệu chính; localStorage chỉ là cache
// offline. Bảng rỗng là trạng thái hợp lệ (đã xóa hết) — chỉ fallback khi lỗi.
async function getEntity<T>(
  key: string,
  query: () => Promise<{ data: T[] | null; error: unknown }>,
  fallback: T[]
): Promise<T[]> {
  try {
    const { data, error } = await query();
    if (!error && data) {
      writeLocal(key, data);
      return data;
    }
  } catch { /* offline hoặc chưa cấu hình — dùng cache */ }
  const local = readLocal<T>(key);
  if (local !== null) return local;
  return fallback;
}

// Supabase-first saver: upsert danh sách mới, xóa các row không còn trong
// danh sách (admin delete), và mirror vào localStorage làm cache.
async function saveEntity<T extends { id: string }>(
  key: string,
  table: string,
  items: T[]
): Promise<void> {
  writeLocal(key, items);
  try {
    if (items.length > 0) {
      const { error } = await supabase.from(table).upsert(items as any);
      if (error) { console.error(`Error saving ${table}:`, error); return; }
    }
    const keepIds = items.map((i) => i.id);
    const del = supabase.from(table).delete();
    const { error: delError } = keepIds.length > 0
      ? await del.not("id", "in", `(${keepIds.map((id) => `"${id}"`).join(",")})`)
      : await del.neq("id", "");
    if (delError) console.error(`Error pruning ${table}:`, delError);
  } catch (e) {
    console.error(`Supabase unreachable while saving ${table}; cached locally.`, e);
  }
}

export async function getStudents(): Promise<Student[]> {
  return getEntity(
    ENTITY_KEYS.students,
    () => supabase.from("students").select("*").order("created_at", { ascending: false }) as any,
    MOCK_STUDENTS as unknown as Student[]
  );
}

export async function saveStudents(students: Student[]): Promise<void> {
  return saveEntity(ENTITY_KEYS.students, "students", students);
}

export async function getTeachers(): Promise<Teacher[]> {
  return getEntity(
    ENTITY_KEYS.teachers,
    () => supabase.from("teachers").select("*").order("created_at", { ascending: false }) as any,
    MOCK_TEACHERS as unknown as Teacher[]
  );
}

export async function saveTeachers(teachers: Teacher[]): Promise<void> {
  return saveEntity(ENTITY_KEYS.teachers, "teachers", teachers);
}

export async function getClasses(): Promise<Class[]> {
  return getEntity(
    ENTITY_KEYS.classes,
    () => supabase.from("classes").select("*").order("created_at", { ascending: false }) as any,
    MOCK_CLASSES as unknown as Class[]
  );
}

export async function saveClasses(classes: Class[]): Promise<void> {
  return saveEntity(ENTITY_KEYS.classes, "classes", classes);
}

export async function getPayments(): Promise<Payment[]> {
  return getEntity(
    ENTITY_KEYS.payments,
    () => supabase.from("payments").select("*").order("created_at", { ascending: false }) as any,
    MOCK_PAYMENTS as unknown as Payment[]
  );
}

export async function savePayments(payments: Payment[]): Promise<void> {
  return saveEntity(ENTITY_KEYS.payments, "payments", payments);
}

export async function getAttendance(): Promise<Attendance[]> {
  return getEntity(
    ENTITY_KEYS.attendance,
    () => supabase.from("attendance").select("*").order("attendance_date", { ascending: false }) as any,
    MOCK_ATTENDANCE as unknown as Attendance[]
  );
}

export async function saveAttendance(attendance: Attendance[]): Promise<void> {
  return saveEntity(ENTITY_KEYS.attendance, "attendance", attendance);
}

export async function getNotifications(): Promise<Notification[]> {
  return getEntity(
    ENTITY_KEYS.notifications,
    () => supabase.from("notifications").select("*").order("created_at", { ascending: false }) as any,
    MOCK_NOTIFICATIONS as unknown as Notification[]
  );
}

export async function saveNotifications(notifications: Notification[]): Promise<void> {
  return saveEntity(ENTITY_KEYS.notifications, "notifications", notifications);
}

export async function resetAllStorage(): Promise<void> {
  if (typeof window === "undefined") return;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("tutorhub_")) toRemove.push(key);
  }
  toRemove.forEach((key) => localStorage.removeItem(key));
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

// ── Teacher-class assignment overrides (localStorage) ────────────────────────
// Allows admin to reassign classes to different teachers without touching mock data.

const TEACHER_OVERRIDE_KEY = "tutorhub_class_teacher_overrides";

export function getClassTeacherOverrides(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(TEACHER_OVERRIDE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function setClassTeacherOverride(classId: string, teacherId: string): void {
  if (typeof window === "undefined") return;
  const existing = getClassTeacherOverrides();
  existing[classId] = teacherId;
  localStorage.setItem(TEACHER_OVERRIDE_KEY, JSON.stringify(existing));
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

// ── Curriculum (localStorage) ────────────────────────────────────────────────

export interface ExamQuestion {
  id: string;
  order: number;
  type: "multiple_choice" | "essay" | "true_false" | "fill_blank";
  content_html: string;      // TipTap HTML — đề bài
  options?: string[];        // A/B/C/D text (multiple_choice)
  correct_option?: number;   // 0-based index (multiple_choice)
  correct_value?: string;    // "true"/"false" or exact text (true_false / fill_blank)
  answer_html?: string;      // TipTap HTML — đáp án tự luận
  explanation_html?: string; // TipTap HTML — giải thích
  score: number;
  difficulty?: "easy" | "medium" | "hard";
  tags?: string[];
}

export interface ExamContent {
  questions:  ExamQuestion[];
  time_limit?: number; // phút
}

export interface CurriculumLesson {
  id: string;
  type: "lecture" | "material" | "homework" | "solution" | "exam";
  title: string;
  video_url?: string;
  file_url?: string;
  description?: string;
  due_date?: string;
  is_published: boolean;
  exam_content?: ExamContent;
  // Exam scheduling / access control
  exam_status?: "draft" | "open" | "closed"; // default: "draft"
  exam_opens_at?: string;                     // ISO datetime for scheduled auto-open
}

export interface CurriculumSession {
  id: string;
  title: string;
  order: number;
  date?: string;        // YYYY-MM-DD — linked scheduled session date
  lessons: CurriculumLesson[];
}

export interface CurriculumChapter {
  id: string;
  title: string;
  order: number;
  sessions: CurriculumSession[];
}

export function getCurriculum(classId: string): CurriculumChapter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`tutorhub_curriculum_${classId}`);
    return raw ? (JSON.parse(raw) as CurriculumChapter[]) : [];
  } catch { return []; }
}

export function saveCurriculum(classId: string, curriculum: CurriculumChapter[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(`tutorhub_curriculum_${classId}`, JSON.stringify(curriculum)); } catch { /* ignore */ }
}

// ── Exam results (per student, per exam) ─────────────────────────────────────

export interface StoredExamResult {
  student_id:   string;
  student_name: string;
  score:        number;
  total:        number;
  submitted_at: string;
  answers:      Record<string, unknown>;
}

function examResultKey(classId: string, lessonId: string, studentId: string) {
  return `tutorhub_exam_result_${classId}_${lessonId}_${studentId}`;
}
function examSubmissionsKey(classId: string, lessonId: string) {
  return `tutorhub_exam_submissions_${classId}_${lessonId}`;
}

export function saveExamResult(
  classId: string,
  lessonId: string,
  studentId: string,
  studentName: string,
  result: { score: number; total: number; submitted_at: string; answers: Record<string, unknown> }
): void {
  if (typeof window === "undefined") return;
  const stored: StoredExamResult = { student_id: studentId, student_name: studentName, ...result };
  localStorage.setItem(examResultKey(classId, lessonId, studentId), JSON.stringify(stored));
  // Track submission registry so teacher can list all results
  const subs: string[] = getExamSubmissionIds(classId, lessonId);
  if (!subs.includes(studentId)) {
    localStorage.setItem(examSubmissionsKey(classId, lessonId), JSON.stringify([...subs, studentId]));
  }
}

export function getExamResult(classId: string, lessonId: string, studentId: string): StoredExamResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(examResultKey(classId, lessonId, studentId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function getExamSubmissionIds(classId: string, lessonId: string): string[] {
  try {
    const raw = localStorage.getItem(examSubmissionsKey(classId, lessonId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function getAllExamResults(classId: string, lessonId: string): StoredExamResult[] {
  if (typeof window === "undefined") return [];
  return getExamSubmissionIds(classId, lessonId)
    .map(sid => getExamResult(classId, lessonId, sid))
    .filter(Boolean) as StoredExamResult[];
}

// ── Student package per class (localStorage) ────────────────────────────────

export type StudentPackage = "online" | "advanced" | "offline";

export function getStudentPackages(classId: string): Record<string, StudentPackage> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(`tutorhub_student_packages_${classId}`) ?? "{}"); } catch { return {}; }
}

export function saveStudentPackages(classId: string, packages: Record<string, StudentPackage>): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(`tutorhub_student_packages_${classId}`, JSON.stringify(packages)); } catch { /* ignore */ }
}

// ── Online meeting link per class (localStorage) ─────────────────────────────

export function getOnlineLink(classId: string): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(`tutorhub_online_link_${classId}`); } catch { return null; }
}

export function saveOnlineLink(classId: string, link: string): void {
  if (typeof window === "undefined") return;
  try {
    if (link.trim()) {
      localStorage.setItem(`tutorhub_online_link_${classId}`, link.trim());
    } else {
      localStorage.removeItem(`tutorhub_online_link_${classId}`);
    }
  } catch { /* ignore */ }
}

// ── Shared tuition invoices (localStorage) ───────────────────────────────────

export type InvoiceStatus = "pending" | "pending_verification" | "paid";

export interface TuitionInvoice {
  id: string;
  child_id: string;        // student id
  title: string;
  amount: number;
  due_date: string;
  status: InvoiceStatus;
  paid_at?: string;
  submitted_by?: "student" | "parent";  // who uploaded the receipt
}

const INVOICE_KEY = "tutorhub_invoices";

const DEFAULT_INVOICES: TuitionInvoice[] = [
  { id: "INV-2026-06-01", child_id: "s1", title: "Học phí Toán cao cấp - Tháng 6",  amount: 1500000, due_date: "2026-06-15", status: "pending" },
  { id: "INV-2026-06-02", child_id: "s1", title: "Tài liệu Vật lý đại cương",         amount: 350000,  due_date: "2026-06-20", status: "pending" },
  { id: "INV-2026-06-03", child_id: "s4", title: "Học phí Hóa học cơ bản - Tháng 6", amount: 1200000, due_date: "2026-06-15", status: "pending" },
  { id: "INV-2026-05-01", child_id: "s1", title: "Học phí Toán cao cấp - Tháng 5",  amount: 1500000, due_date: "2026-05-15", status: "paid", paid_at: "2026-05-12" },
  { id: "INV-2026-05-02", child_id: "s4", title: "Học phí Hóa học cơ bản - Tháng 5", amount: 1200000, due_date: "2026-05-15", status: "paid", paid_at: "2026-05-13" },
];

export function getInvoices(): TuitionInvoice[] {
  if (typeof window === "undefined") return DEFAULT_INVOICES;
  try {
    const raw = localStorage.getItem(INVOICE_KEY);
    return raw ? (JSON.parse(raw) as TuitionInvoice[]) : DEFAULT_INVOICES;
  } catch { return DEFAULT_INVOICES; }
}

export function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
  submittedBy: "student" | "parent"
): void {
  if (typeof window === "undefined") return;
  const invoices = getInvoices().map(inv =>
    (invoiceId === "ALL" ? inv.status === "pending" : inv.id === invoiceId)
      ? { ...inv, status, submitted_by: submittedBy }
      : inv
  );
  localStorage.setItem(INVOICE_KEY, JSON.stringify(invoices));
}

// ── Enrollment requests (Supabase) ───────────────────────────────────────────

export type EnrollmentStatus = "pending" | "approved" | "rejected";

export interface EnrollmentRequest {
  id: string;
  full_name: string;
  email: string;
  dob: string;
  school: string;
  grade: string;
  requested_class_id: string;
  parent_phone: string;
  student_phone?: string;
  note?: string;
  status: EnrollmentStatus;
  assigned_class_id?: string;
  account_username?: string;
  account_password?: string;
  reject_reason?: string;
  supabase_user_id?: string;
  created_at: string;
  reviewed_at?: string;
}

export interface StudentAccount {
  student_id: string;
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

// Đọc/ghi enrollment: Supabase là nguồn chính, localStorage là cache offline.
async function readEnrollmentsLocal(): Promise<EnrollmentRequest[]> {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ENROLL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeEnrollmentsLocal(list: EnrollmentRequest[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(ENROLL_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export async function getEnrollments(): Promise<EnrollmentRequest[]> {
  try {
    const { data, error } = await supabase
      .from("enrollment_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      writeEnrollmentsLocal(data as EnrollmentRequest[]);
      return data as EnrollmentRequest[];
    }
  } catch { /* offline — dùng cache */ }
  return readEnrollmentsLocal();
}

export async function createEnrollment(
  data: Omit<EnrollmentRequest, "id" | "status" | "created_at">
): Promise<EnrollmentRequest> {
  const request: EnrollmentRequest = {
    ...data,
    id: crypto.randomUUID(),
    status: "pending",
    created_at: new Date().toISOString(),
  };
  try {
    const { error } = await supabase.from("enrollment_requests").insert(request);
    if (error) console.error("Error creating enrollment:", error);
  } catch { /* offline */ }
  writeEnrollmentsLocal([request, ...(await readEnrollmentsLocal())]);
  return request;
}

export async function approveEnrollment(
  id: string,
  opts: { assigned_class_id: string; account_username: string; account_password: string }
): Promise<void> {
  const patch = {
    status: "approved" as EnrollmentStatus,
    ...opts,
    reviewed_at: new Date().toISOString(),
  };
  try {
    const { error } = await supabase.from("enrollment_requests").update(patch).eq("id", id);
    if (error) console.error("Error approving enrollment:", error);
  } catch { /* offline */ }
  const all = await getEnrollments();
  const updated = all.map(e => (e.id === id ? { ...e, ...patch } : e));
  writeEnrollmentsLocal(updated);

  const enr = updated.find(e => e.id === id)!;
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

export async function deleteEnrollment(id: string): Promise<void> {
  try {
    const { error } = await supabase.from("enrollment_requests").delete().eq("id", id);
    if (error) console.error("Error deleting enrollment:", error);
  } catch { /* offline */ }
  writeEnrollmentsLocal((await readEnrollmentsLocal()).filter(e => e.id !== id));
  // Also remove student account if approved
  const accounts = getStudentAccounts();
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts.filter(a => a.student_id !== `enr_${id}`)));
}

export async function rejectEnrollment(id: string, reason?: string): Promise<void> {
  const patch = {
    status: "rejected" as EnrollmentStatus,
    reject_reason: reason,
    reviewed_at: new Date().toISOString(),
  };
  try {
    const { error } = await supabase.from("enrollment_requests").update(patch).eq("id", id);
    if (error) console.error("Error rejecting enrollment:", error);
  } catch { /* offline */ }
  writeEnrollmentsLocal((await readEnrollmentsLocal()).map(e => (e.id === id ? { ...e, ...patch } : e)));
}

export function getStudentAccounts(): StudentAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function changeStudentPassword(
  studentId: string,
  currentPassword: string,
  newPassword: string
): Promise<"ok" | "wrong_password" | "not_found"> {
  if (!studentId.startsWith("enr_")) return "not_found";
  const enrollmentId = studentId.slice(4);
  const all = await getEnrollments();
  const enr = all.find(e => e.id === enrollmentId);
  if (!enr || enr.status !== "approved") return "not_found";
  if (enr.account_password !== currentPassword) return "wrong_password";
  try {
    const { error } = await supabase
      .from("enrollment_requests")
      .update({ account_password: newPassword })
      .eq("id", enrollmentId);
    if (error) console.error("Error changing password:", error);
  } catch { /* offline */ }
  writeEnrollmentsLocal(
    all.map(e => (e.id === enrollmentId ? { ...e, account_password: newPassword } : e))
  );
  return "ok";
}

export function getCurrentStudentAccount(): StudentAccount | null {
  const accounts = getStudentAccounts();
  return accounts.length > 0 ? accounts[accounts.length - 1] : null;
}

// ── Exam scores (localStorage) ────────────────────────────────────────────────

export interface StoredExamScore {
  id:         string;
  student_id: string;
  class_id:   string;
  exam_name:  string;
  score:      number;
  max_score:  number;
  exam_date:  string;
}

const SCORES_KEY = "tutorhub_exam_scores";

function getStoredExamScores(): StoredExamScore[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveExamScore(score: Omit<StoredExamScore, "id">): Promise<StoredExamScore> {
  const record: StoredExamScore = { ...score, id: crypto.randomUUID() };
  localStorage.setItem(SCORES_KEY, JSON.stringify([...getStoredExamScores(), record]));
  return record;
}

export async function deleteExamScore(id: string): Promise<void> {
  localStorage.setItem(SCORES_KEY, JSON.stringify(getStoredExamScores().filter(s => s.id !== id)));
}

export async function getExamScoresByStudent(studentId: string): Promise<StoredExamScore[]> {
  return Promise.resolve(getStoredExamScores().filter(s => s.student_id === studentId));
}

// ── Class materials (localStorage) ────────────────────────────────────────────

export interface StoredClassMaterial {
  id: string;
  class_id: string;
  title: string;
  description?: string;
  file_url: string;
  file_type: string;
  file_size: string;
  category: string;
  uploaded_by: string;
  created_at: string;
  download_count: number;
  packages?: StudentPackage[];  // empty/undefined = visible to all packages
}

const MATERIALS_KEY = "tutorhub_class_materials";

function getStoredMaterials(): StoredClassMaterial[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MATERIALS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function getClassMaterials(classId: string): StoredClassMaterial[] {
  return getStoredMaterials().filter(m => m.class_id === classId);
}

export function saveClassMaterial(mat: Omit<StoredClassMaterial, "id" | "download_count">): StoredClassMaterial {
  const record: StoredClassMaterial = { ...mat, id: `mat_${Date.now()}`, download_count: 0 };
  localStorage.setItem(MATERIALS_KEY, JSON.stringify([...getStoredMaterials(), record]));
  return record;
}

export function deleteClassMaterial(materialId: string): void {
  if (typeof window === "undefined") return;
  const updated = getStoredMaterials().filter(m => m.id !== materialId);
  localStorage.setItem(MATERIALS_KEY, JSON.stringify(updated));
}

export function incrementMaterialDownload(materialId: string): void {
  if (typeof window === "undefined") return;
  const all = getStoredMaterials();
  const idx = all.findIndex(m => m.id === materialId);
  if (idx >= 0) {
    all[idx] = { ...all[idx], download_count: all[idx].download_count + 1 };
    localStorage.setItem(MATERIALS_KEY, JSON.stringify(all));
  }
}

// ── Homework file attachments (localStorage) ──────────────────────────────────

export interface HomeworkAttachment {
  homework_id: string;
  file_url: string;
  file_name: string;
  file_size: string;
  file_type: string;
}

const HW_ATTACHMENTS_KEY = "tutorhub_homework_attachments";

function getAllHomeworkAttachments(): HomeworkAttachment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HW_ATTACHMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function getHomeworkAttachments(homeworkId: string): HomeworkAttachment[] {
  return getAllHomeworkAttachments().filter(a => a.homework_id === homeworkId);
}

export function saveHomeworkAttachment(att: HomeworkAttachment): void {
  localStorage.setItem(HW_ATTACHMENTS_KEY, JSON.stringify([...getAllHomeworkAttachments(), att]));
}

// ── Teacher tuition management per class (localStorage) ──────────────────────

export interface TuitionPaymentRecord {
  id: string;
  amount: number;
  period: string;     // "YYYY-MM"
  paid_at: string;    // ISO datetime
  method: "cash" | "transfer" | "other";
  note?: string;
}

export interface StudentTuitionData {
  custom_fee?: number;       // Monthly fee override; uses class default if absent
  payments: TuitionPaymentRecord[];
  notes?: string;
  next_due_date?: string;    // YYYY-MM-DD
}

export interface ClassTuitionConfig {
  package_fees: {
    online: number;
    advanced: number;
    offline: number;
  };
  students: Record<string, StudentTuitionData>;
}

const DEFAULT_TUITION: ClassTuitionConfig = {
  package_fees: { online: 0, advanced: 0, offline: 0 },
  students: {},
};

function tuitionKey(classId: string) { return `tutorhub_tuition_${classId}`; }

export function getClassTuition(classId: string): ClassTuitionConfig {
  if (typeof window === "undefined") return DEFAULT_TUITION;
  try {
    const raw = localStorage.getItem(tuitionKey(classId));
    if (!raw) return DEFAULT_TUITION;
    const parsed = JSON.parse(raw);
    // Migrate old default_fee format
    if (typeof parsed.default_fee === "number" && !parsed.package_fees) {
      return { package_fees: { online: parsed.default_fee, advanced: parsed.default_fee, offline: parsed.default_fee }, students: parsed.students ?? {} };
    }
    return parsed;
  } catch { return DEFAULT_TUITION; }
}

export function saveClassTuition(classId: string, config: ClassTuitionConfig): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(tuitionKey(classId), JSON.stringify(config)); } catch { /* ignore */ }
}

export function recordTuitionPayment(
  classId: string,
  studentId: string,
  payment: Omit<TuitionPaymentRecord, "id">
): void {
  const config = getClassTuition(classId);
  const student = config.students[studentId] ?? { payments: [] };
  const newPayment: TuitionPaymentRecord = { ...payment, id: crypto.randomUUID() };
  config.students[studentId] = { ...student, payments: [...student.payments, newPayment] };
  saveClassTuition(classId, config);
}

export function deleteTuitionPayment(classId: string, studentId: string, paymentId: string): void {
  const config = getClassTuition(classId);
  const student = config.students[studentId];
  if (!student) return;
  config.students[studentId] = { ...student, payments: student.payments.filter(p => p.id !== paymentId) };
  saveClassTuition(classId, config);
}


// ── Course reviews (localStorage) ─────────────────────────────────────────────

export interface CourseReview {
  id: string;
  course_id: string;
  student_id: string;
  student_name: string;
  rating: number; // 1–5
  comment?: string;
  created_at: string;
}

const REVIEWS_KEY = "tutorhub_course_reviews";

function getStoredReviews(): CourseReview[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(REVIEWS_KEY) ?? "[]"); } catch { return []; }
}

export function getCourseReviews(courseId: string): CourseReview[] {
  return getStoredReviews().filter(r => r.course_id === courseId);
}

export function submitCourseReview(review: Omit<CourseReview, "id">): CourseReview {
  const all = getStoredReviews();
  // One review per student per course — upsert
  const existing = all.findIndex(r => r.course_id === review.course_id && r.student_id === review.student_id);
  const record: CourseReview = { ...review, id: existing >= 0 ? all[existing].id : crypto.randomUUID() };
  if (existing >= 0) all[existing] = record; else all.push(record);
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(all));
  return record;
}

export function deleteReview(reviewId: string): void {
  if (typeof window === "undefined") return;
  const updated = getStoredReviews().filter(r => r.id !== reviewId);
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(updated));
}

export function getCourseRating(courseId: string): { rating: number; reviewCount: number } {
  const reviews = getCourseReviews(courseId);
  if (reviews.length === 0) return { rating: 0, reviewCount: 0 };
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  return { rating: Math.round(avg * 10) / 10, reviewCount: reviews.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// User Management (admin)
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = "student" | "teacher" | "admin";

export interface ManagedUser {
  id: string;
  type: UserRole;
  full_name: string;
  username: string;
  email?: string;
  password?: string;
  disabled: boolean;
  created_at: string;
  // role-specific extras
  grade?: string;
  school?: string;
  specialization?: string;
}

const MANAGED_USERS_KEY = "tutorhub_managed_users";

function ls(key: string): string | null {
  try { return typeof window !== "undefined" ? localStorage.getItem(key) : null; } catch { return null; }
}

export function getManagedUsers(): ManagedUser[] {
  try {
    const raw = ls(MANAGED_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveManagedUser(user: ManagedUser): void {
  const all = getManagedUsers();
  const idx = all.findIndex(u => u.id === user.id);
  if (idx >= 0) all[idx] = user; else all.push(user);
  localStorage.setItem(MANAGED_USERS_KEY, JSON.stringify(all));
}

export function deleteManagedUser(id: string): void {
  const all = getManagedUsers().filter(u => u.id !== id);
  localStorage.setItem(MANAGED_USERS_KEY, JSON.stringify(all));
}

export function resetManagedUserPassword(id: string, newPassword: string): void {
  const all = getManagedUsers();
  const user = all.find(u => u.id === id);
  if (user) { user.password = newPassword; localStorage.setItem(MANAGED_USERS_KEY, JSON.stringify(all)); }
}

export function toggleManagedUserDisabled(id: string): void {
  const all = getManagedUsers();
  const user = all.find(u => u.id === id);
  if (user) { user.disabled = !user.disabled; localStorage.setItem(MANAGED_USERS_KEY, JSON.stringify(all)); }
}
