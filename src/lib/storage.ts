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

// ── Domain KV stores ─────────────────────────────────────────────────────────
// Mỗi nhóm dữ liệu có bảng Supabase riêng (kv_curriculum, kv_online_links...).
// kvGet/kvSet định tuyến key localStorage cũ sang đúng bảng + scope id,
// nên call site không cần biết chi tiết. localStorage vẫn là cache offline.

// [prefix key cũ, tên bảng] — prefix dài/cụ thể phải đứng trước prefix ngắn
const KV_PREFIX_ROUTES: Array<[string, string]> = [
  ["tutorhub_schedule_notifications", "kv_schedule_notifications"],
  ["tutorhub_curriculum_",            "kv_curriculum"],
  ["tutorhub_schedule_",              "kv_schedules"],
  ["tutorhub_online_link_",           "kv_online_links"],
  ["tutorhub_tuition_",               "kv_tuition"],
  ["tutorhub_student_packages_",      "kv_student_packages"],
  ["tutorhub_session_notes_",         "kv_session_notes"],
  ["tutorhub_class_extra_students_",  "kv_class_extra_students"],
  ["tutorhub_comments_",              "kv_student_comments"],
  ["tutorhub_exam_result_",           "kv_exam_results"],
  ["tutorhub_exam_submissions_",      "kv_exam_submissions"],
  ["tutorhub_exam_scores",            "kv_exam_scores"],
  ["tutorhub_course_reviews",         "kv_course_reviews"],
  ["tutorhub_invoices",               "kv_invoices"],
  ["tutorhub_managed_users",          "kv_managed_users"],
  ["tutorhub_student_accounts",       "kv_student_accounts"],
  ["tutorhub_homework_attachments",   "kv_homework_attachments"],
  ["tutorhub_class_materials",        "kv_class_materials"],
  ["tutorhub_class_teacher_overrides","kv_class_overrides"],
  ["tutorhub_teacher_homework",       "kv_teacher_homework"],
  ["tutorhub_teacher_classes",        "kv_teacher_classes"],
  ["tutorhub_teacher_attendance",     "kv_teacher_attendance"],
  ["tutorhub_teacher_materials",      "kv_teacher_materials"],
  ["tutorhub_submissions",            "kv_submissions"],
  ["tutorhub_parent_messages",        "kv_parent_messages"],
];

// key cũ → { bảng, id } (id = phần sau prefix, hoặc 'global' nếu không có)
function kvRoute(key: string): { table: string; id: string } | null {
  for (const [prefix, table] of KV_PREFIX_ROUTES) {
    if (key === prefix) return { table, id: "global" };
    if (key.startsWith(prefix)) return { table, id: key.slice(prefix.length) || "global" };
  }
  return null;
}

function kvReadLocal<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return null;
}

function kvWriteLocal<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const route = kvRoute(key);
  if (!route) {
    // Key chưa đăng ký bảng — giữ nguyên hành vi localStorage cũ
    const local = kvReadLocal<T>(key);
    return local !== null ? local : fallback;
  }
  try {
    const { data, error } = await supabase
      .from(route.table)
      .select("value")
      .eq("id", route.id)
      .maybeSingle();
    if (!error) {
      if (data) {
        kvWriteLocal(key, data.value);
        return data.value as T;
      }
      // Chưa có trên DB — nếu máy này còn dữ liệu cũ thì sync lên luôn
      const local = kvReadLocal<T>(key);
      if (local !== null) {
        void kvSet(key, local);
        return local;
      }
      return fallback;
    }
  } catch { /* offline */ }
  const local = kvReadLocal<T>(key);
  return local !== null ? local : fallback;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  kvWriteLocal(key, value);
  const route = kvRoute(key);
  if (!route) return;
  try {
    const { error } = await supabase
      .from(route.table)
      .upsert({ id: route.id, value, updated_at: new Date().toISOString() });
    if (error) console.error(`Error saving ${route.table}/${route.id}:`, error);
  } catch { /* offline — đã cache local */ }
}

// Đọc-sửa-ghi nguyên tử hơn: LUÔN đọc bản mới nhất từ DB ngay trước khi ghi,
// thay vì ghi đè bằng state đã load từ lúc mount (chống lost-update giữa
// 2 người dùng / 2 tab). Trả về giá trị sau khi cập nhật.
export async function kvUpdate<T>(
  key: string,
  fallback: T,
  updater: (current: T) => T
): Promise<T> {
  const current = await kvGet(key, fallback);
  const next = updater(current);
  await kvSet(key, next);
  return next;
}

// Xóa hẳn một key: cả row trên DB lẫn cache localStorage
// (dùng cho "làm lại bài thi" — kvGet sẽ không hồi sinh kết quả cũ nữa).
export async function kvDelete(key: string): Promise<void> {
  if (typeof window !== "undefined") {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
  const route = kvRoute(key);
  if (!route) return;
  try {
    const { error } = await supabase.from(route.table).delete().eq("id", route.id);
    if (error) console.error(`Error deleting ${route.table}/${route.id}:`, error);
  } catch { /* offline */ }
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

// Đánh dấu các bảng mà lần đọc gần nhất THỰC SỰ đến từ DB (không phải
// cache/mock). saveEntity chỉ được phép prune (xóa row vắng mặt) khi cờ này
// bật — ngăn thảm họa "load lỗi → state là mock → save ghi đè cả bảng thật".
const verifiedTables = new Set<string>();

// Supabase-first getter: DB là nguồn dữ liệu chính; localStorage chỉ là cache
// offline. Bảng rỗng là trạng thái hợp lệ (đã xóa hết) — chỉ fallback khi lỗi.
async function getEntity<T>(
  key: string,
  table: string,
  query: () => Promise<{ data: T[] | null; error: unknown }>,
  fallback: T[]
): Promise<T[]> {
  try {
    const { data, error } = await query();
    if (!error && data) {
      writeLocal(key, data);
      verifiedTables.add(table);
      return data;
    }
  } catch { /* offline hoặc chưa cấu hình — dùng cache */ }
  verifiedTables.delete(table);
  const local = readLocal<T>(key);
  if (local !== null) return local;
  return fallback;
}

// Supabase-first saver: upsert danh sách mới, mirror vào localStorage.
// Chỉ prune row vắng mặt khi phiên này đã đọc thành công từ DB — nếu không,
// upsert-only (an toàn: không bao giờ xóa dữ liệu dựa trên state mock/cache).
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
    if (!verifiedTables.has(table)) {
      console.warn(`Skip pruning ${table}: dữ liệu phiên này chưa xác thực từ DB.`);
      return;
    }
    const keepIds = items.map((i) => i.id);
    const del = supabase.from(table).delete();
    const { error: delError } = keepIds.length > 0
      ? await del.not("id", "in", `(${keepIds.map((id) => JSON.stringify(id)).join(",")})`)
      : await del.neq("id", "");
    if (delError) console.error(`Error pruning ${table}:`, delError);
  } catch (e) {
    console.error(`Supabase unreachable while saving ${table}; cached locally.`, e);
  }
}

export async function getStudents(): Promise<Student[]> {
  return getEntity(
    ENTITY_KEYS.students,
    "students",
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
    "teachers",
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
    "classes",
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
    "payments",
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
    "attendance",
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
    "notifications",
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
  const data = await kvGet<{ text: string; date: string; rating: number }[] | null>(`tutorhub_comments_${studentId}`, null);
  if (data) return data;
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
  await kvSet(`tutorhub_comments_${studentId}`, commentsList);
}

// ── Teacher-class assignment overrides (localStorage) ────────────────────────
// Allows admin to reassign classes to different teachers without touching mock data.

const TEACHER_OVERRIDE_KEY = "tutorhub_class_teacher_overrides";

export async function getClassTeacherOverrides(): Promise<Record<string, string>> {
  return kvGet<Record<string, string>>(TEACHER_OVERRIDE_KEY, {});
}

export async function setClassTeacherOverride(classId: string, teacherId: string): Promise<void> {
  const existing = await getClassTeacherOverrides();
  existing[classId] = teacherId;
  await kvSet(TEACHER_OVERRIDE_KEY, existing);
}

// ── Schedule overrides (localStorage) ───────────────────────────────────────

export async function getClassScheduleOverride(classId: string): Promise<ClassSchedule[] | null> {
  return kvGet<ClassSchedule[] | null>(`tutorhub_schedule_${classId}`, null);
}

export async function saveClassScheduleOverride(classId: string, schedule: ClassSchedule[]): Promise<void> {
  await kvSet(`tutorhub_schedule_${classId}`, schedule);
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

export async function getScheduleNotifications(): Promise<ScheduleNotification[]> {
  return kvGet<ScheduleNotification[]>("tutorhub_schedule_notifications", []);
}

export async function pushScheduleNotification(notif: Omit<ScheduleNotification, "id" | "created_at" | "is_read">): Promise<void> {
  const existing = await getScheduleNotifications();
  const next: ScheduleNotification = {
    ...notif,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    is_read: false,
  };
  await kvSet("tutorhub_schedule_notifications", [next, ...existing]);
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

function readTxLocal(): PurchaseTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TX_KEY);
    return raw ? (JSON.parse(raw) as PurchaseTransaction[]) : [];
  } catch { return []; }
}

function writeTxLocal(txs: PurchaseTransaction[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(TX_KEY, JSON.stringify(txs)); } catch { /* ignore */ }
}

// Supabase-first: học viên tạo giao dịch trên máy của họ, admin duyệt trên
// máy khác — cả hai thấy cùng dữ liệu. localStorage chỉ là cache offline.
export async function getTransactions(): Promise<PurchaseTransaction[]> {
  try {
    const { data, error } = await supabase
      .from("purchase_transactions")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      writeTxLocal(data as PurchaseTransaction[]);
      return data as PurchaseTransaction[];
    }
  } catch { /* offline — dùng cache */ }
  return readTxLocal();
}

export async function createTransaction(
  tx: Omit<PurchaseTransaction, "id" | "created_at" | "status">
): Promise<PurchaseTransaction> {
  const full: PurchaseTransaction = { ...tx, id: crypto.randomUUID(), created_at: new Date().toISOString(), status: "pending" };
  try {
    const { error } = await supabase.from("purchase_transactions").insert(full);
    if (error) console.error("Error creating transaction:", error);
  } catch { /* offline */ }
  writeTxLocal([full, ...readTxLocal()]);
  return full;
}

export async function updateTransactionStatus(txId: string, status: "approved" | "rejected"): Promise<void> {
  const patch = { status, reviewed_at: new Date().toISOString() };
  try {
    const { error } = await supabase.from("purchase_transactions").update(patch).eq("id", txId);
    if (error) console.error("Error updating transaction:", error);
  } catch { /* offline */ }
  const txs = readTxLocal().map(t => (t.id === txId ? { ...t, ...patch } : t));
  writeTxLocal(txs);
  // Quyền truy cập suy ra từ giao dịch approved (getGrantedPackages) —
  // học viên tự thấy tài liệu mở khóa ở lần tải trang kế tiếp.
}

// Gói được mở khóa = có giao dịch approved của học viên đó (Supabase),
// hợp nhất với danh sách cấp thủ công cũ trong localStorage (legacy).
export async function getGrantedPackages(studentId?: string): Promise<string[]> {
  let granted: string[] = [];
  try {
    let query = supabase.from("purchase_transactions").select("pkg_id").eq("status", "approved");
    if (studentId) query = query.eq("student_id", studentId);
    const { data, error } = await query;
    if (!error && data) granted = data.map((r: { pkg_id: string }) => r.pkg_id);
  } catch { /* offline */ }
  try {
    const raw = localStorage.getItem(ACCESS_KEY);
    if (raw) granted = [...new Set([...granted, ...(JSON.parse(raw) as string[])])];
  } catch { /* ignore */ }
  return granted;
}

export async function markScheduleNotificationsRead(): Promise<void> {
  const existing = (await getScheduleNotifications()).map(n => ({ ...n, is_read: true }));
  await kvSet("tutorhub_schedule_notifications", existing);
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
  // Đúng sai nhiều mệnh đề (chuẩn THPT mới): mỗi mệnh đề a/b/c/d là Đ hoặc S.
  // Khi có statements, correct_value bị bỏ qua.
  statements?: { text: string; correct: boolean }[];
  answer_html?: string;      // TipTap HTML — đáp án tự luận
  explanation_html?: string; // TipTap HTML — giải thích
  score: number;
  difficulty?: "easy" | "medium" | "hard";
  tags?: string[];
}

export interface ExamContent {
  questions:  ExamQuestion[];
  time_limit?: number; // phút
  // Cho học sinh xem "Lời giải" (explanation_html) sau khi nộp bài. Mặc định: true.
  show_solution_after_submit?: boolean;
  // Cho học sinh làm lại sau khi nộp. Mặc định: true.
  allow_retry?: boolean;
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

export async function getCurriculum(classId: string): Promise<CurriculumChapter[]> {
  return kvGet<CurriculumChapter[]>(`tutorhub_curriculum_${classId}`, []);
}

export async function saveCurriculum(classId: string, curriculum: CurriculumChapter[]): Promise<void> {
  await kvSet(`tutorhub_curriculum_${classId}`, curriculum);
}

// Merge-safe curriculum mutation: re-applies `fn` to the FRESH document read
// right before writing (kvUpdate) instead of overwriting with stale state.
export async function mutateCurriculum(
  classId: string,
  fn: (chapters: CurriculumChapter[]) => CurriculumChapter[]
): Promise<CurriculumChapter[]> {
  return kvUpdate<CurriculumChapter[]>(`tutorhub_curriculum_${classId}`, [], fn);
}

// ── Exam results (per student, per exam) ─────────────────────────────────────

export interface StoredExamResult {
  student_id:   string;
  student_name: string;
  score:        number;
  total:        number;
  submitted_at: string;
  answers:      Record<string, unknown>;
  // Chấm thủ công (tự luận): điểm giáo viên cho theo từng câu (question id → điểm)
  manual_scores?: Record<string, number>;
  teacher_feedback?: string;
  graded_at?: string;
}

/** Giáo viên chấm tự luận / nhận xét: ghi đè manual_scores + feedback vào kết quả đã nộp. */
export async function gradeExamResult(
  classId: string,
  lessonId: string,
  studentId: string,
  patch: { manual_scores?: Record<string, number>; teacher_feedback?: string }
): Promise<StoredExamResult | null> {
  const key = examResultKey(classId, lessonId, studentId);
  const current = await kvGet<StoredExamResult | null>(key, null);
  if (!current) return null;
  const updated: StoredExamResult = {
    ...current,
    ...patch,
    manual_scores: { ...(current.manual_scores ?? {}), ...(patch.manual_scores ?? {}) },
    graded_at: new Date().toISOString(),
  };
  await kvSet(key, updated);
  return updated;
}

function examResultKey(classId: string, lessonId: string, studentId: string) {
  return `tutorhub_exam_result_${classId}_${lessonId}_${studentId}`;
}
function examSubmissionsKey(classId: string, lessonId: string) {
  return `tutorhub_exam_submissions_${classId}_${lessonId}`;
}

export async function saveExamResult(
  classId: string,
  lessonId: string,
  studentId: string,
  studentName: string,
  result: { score: number; total: number; submitted_at: string; answers: Record<string, unknown> }
): Promise<void> {
  const stored: StoredExamResult = { student_id: studentId, student_name: studentName, ...result };
  await kvSet(examResultKey(classId, lessonId, studentId), stored);
  // Track submission registry so teacher can list all results
  const subs: string[] = await getExamSubmissionIds(classId, lessonId);
  if (!subs.includes(studentId)) {
    await kvSet(examSubmissionsKey(classId, lessonId), [...subs, studentId]);
  }
}

export async function getExamResult(classId: string, lessonId: string, studentId: string): Promise<StoredExamResult | null> {
  return kvGet<StoredExamResult | null>(examResultKey(classId, lessonId, studentId), null);
}

async function getExamSubmissionIds(classId: string, lessonId: string): Promise<string[]> {
  return kvGet<string[]>(examSubmissionsKey(classId, lessonId), []);
}

export async function getAllExamResults(classId: string, lessonId: string): Promise<StoredExamResult[]> {
  const ids = await getExamSubmissionIds(classId, lessonId);
  const results = await Promise.all(ids.map(sid => getExamResult(classId, lessonId, sid)));
  return results.filter(Boolean) as StoredExamResult[];
}

// ── Student package per class (localStorage) ────────────────────────────────

export type StudentPackage = "online" | "advanced" | "offline";

export async function getStudentPackages(classId: string): Promise<Record<string, StudentPackage>> {
  return kvGet<Record<string, StudentPackage>>(`tutorhub_student_packages_${classId}`, {});
}

export async function saveStudentPackages(classId: string, packages: Record<string, StudentPackage>): Promise<void> {
  await kvSet(`tutorhub_student_packages_${classId}`, packages);
}

// ── Online meeting link per class (localStorage) ─────────────────────────────

export async function getOnlineLink(classId: string): Promise<string | null> {
  return kvGet<string | null>(`tutorhub_online_link_${classId}`, null);
}

// Lưu "" khi giáo viên xóa link (khác với null = chưa từng đặt) — để trang
// không hồi sinh zoom_link mặc định sau khi link đã bị xóa chủ động.
export async function saveOnlineLink(classId: string, link: string): Promise<void> {
  await kvSet<string>(`tutorhub_online_link_${classId}`, link.trim());
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
  class_id?: string;       // liên kết với lớp học (hóa đơn do giáo viên phát hành)
  period?: string;         // "YYYY-MM"
}

const INVOICE_KEY = "tutorhub_invoices";

const DEFAULT_INVOICES: TuitionInvoice[] = [
  { id: "INV-2026-06-01", child_id: "s1", title: "Học phí Toán cao cấp - Tháng 6",  amount: 1500000, due_date: "2026-06-15", status: "pending" },
  { id: "INV-2026-06-02", child_id: "s1", title: "Tài liệu Vật lý đại cương",         amount: 350000,  due_date: "2026-06-20", status: "pending" },
  { id: "INV-2026-06-03", child_id: "s4", title: "Học phí Hóa học cơ bản - Tháng 6", amount: 1200000, due_date: "2026-06-15", status: "pending" },
  { id: "INV-2026-05-01", child_id: "s1", title: "Học phí Toán cao cấp - Tháng 5",  amount: 1500000, due_date: "2026-05-15", status: "paid", paid_at: "2026-05-12" },
  { id: "INV-2026-05-02", child_id: "s4", title: "Học phí Hóa học cơ bản - Tháng 5", amount: 1200000, due_date: "2026-05-15", status: "paid", paid_at: "2026-05-13" },
];

export async function getInvoices(): Promise<TuitionInvoice[]> {
  return kvGet<TuitionInvoice[]>(INVOICE_KEY, DEFAULT_INVOICES);
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
  submittedBy: "student" | "parent",
  childId?: string // bắt buộc khi invoiceId === "ALL" để không đụng hóa đơn của học sinh khác
): Promise<void> {
  await kvUpdate<TuitionInvoice[]>(INVOICE_KEY, DEFAULT_INVOICES, invoices =>
    invoices.map(inv => {
      const match = invoiceId === "ALL"
        ? inv.status === "pending" && (!childId || inv.child_id === childId)
        : inv.id === invoiceId;
      return match ? { ...inv, status, submitted_by: submittedBy } : inv;
    })
  );
}

/** Giáo viên phát hành hóa đơn học phí cho một học sinh trong lớp (idempotent theo id). */
export async function issueTuitionInvoice(params: {
  classId: string;
  className: string;
  studentId: string;
  amount: number;
  period: string;   // "YYYY-MM"
  dueDate: string;  // "YYYY-MM-DD"
}): Promise<TuitionInvoice> {
  const { classId, className, studentId, amount, period, dueDate } = params;
  const id = `INV-${period}-${classId}-${studentId}`;
  const [y, m] = period.split("-");
  const invoice: TuitionInvoice = {
    id,
    child_id: studentId,
    title: `Học phí ${className} - Tháng ${parseInt(m)}/${y}`,
    amount,
    due_date: dueDate,
    status: "pending",
    class_id: classId,
    period,
  };
  let result = invoice;
  await kvUpdate<TuitionInvoice[]>(INVOICE_KEY, DEFAULT_INVOICES, invoices => {
    const existing = invoices.find(inv => inv.id === id);
    if (existing) { result = existing; return invoices; }
    return [...invoices, invoice];
  });
  return result;
}

/** Giáo viên xác nhận đã thu tiền cho một hóa đơn. */
export async function confirmInvoicePaid(invoiceId: string): Promise<TuitionInvoice | null> {
  let result: TuitionInvoice | null = null;
  await kvUpdate<TuitionInvoice[]>(INVOICE_KEY, DEFAULT_INVOICES, invoices =>
    invoices.map(inv => {
      if (inv.id !== invoiceId) return inv;
      result = inv.status === "paid" ? inv : { ...inv, status: "paid" as const, paid_at: new Date().toISOString() };
      return result;
    })
  );
  return result;
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

  // Tạo tài khoản Supabase Auth thật (server route dùng service role key).
  // Nếu key chưa cấu hình (501) hoặc offline, đăng nhập vẫn hoạt động qua
  // fallback so khớp enrollment_requests — không chặn luồng duyệt.
  let res: Response | null = null;
  try {
    res = await fetch("/api/admin/create-student-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: opts.account_username,
        password: opts.account_password,
        full_name: enr.full_name,
        enrollment_id: id,
        assigned_class_id: opts.assigned_class_id,
      }),
    });
  } catch { /* offline — fallback login qua enrollment_requests vẫn hoạt động */ }
  if (res) {
    if (res.ok) {
      const { user_id } = await res.json();
      try {
        await supabase.from("enrollment_requests").update({ supabase_user_id: user_id }).eq("id", id);
      } catch { /* offline */ }
    } else if (res.status !== 501) {
      // Báo lỗi lên ApproveModal thay vì báo thành công giả
      const msg = await res.text().catch(() => "");
      throw new Error(msg || "Không tạo được tài khoản đăng nhập cho học viên.");
    }
  }

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
  const accounts = await getStudentAccounts();
  await kvSet(ACCOUNT_KEY, [
    ...accounts.filter(a => a.student_id !== account.student_id),
    account,
  ]);

  // Tạo bản ghi học viên thật trong bảng `students` + thêm vào sĩ số lớp.
  // Upsert trực tiếp (không qua saveStudents) để không prune dữ liệu khác.
  const studentId = `enr_${id}`;
  try {
    await supabase.from("students").upsert({
      id:            studentId,
      full_name:     enr.full_name,
      email:         enr.email,
      dob:           enr.dob,
      school:        enr.school,
      grade:         enr.grade,
      learning_type: "hybrid",
      created_at:    new Date().toISOString(),
    });
    const { data: cls } = await supabase
      .from("classes")
      .select("id, student_ids")
      .eq("id", opts.assigned_class_id)
      .maybeSingle();
    if (cls) {
      const ids: string[] = (cls.student_ids as string[] | null) ?? [];
      if (!ids.includes(studentId)) {
        await supabase
          .from("classes")
          .update({ student_ids: [...ids, studentId] })
          .eq("id", opts.assigned_class_id);
      }
    }
    // Lớp không có trong DB (mock-only) → bỏ qua im lặng
  } catch (e) {
    console.error("Không đồng bộ được học viên vào bảng students/classes:", e);
  }
}

export async function deleteEnrollment(id: string): Promise<void> {
  const enr = (await readEnrollmentsLocal()).find(e => e.id === id);
  try {
    const { error } = await supabase.from("enrollment_requests").delete().eq("id", id);
    if (error) console.error("Error deleting enrollment:", error);
  } catch { /* offline */ }
  writeEnrollmentsLocal((await readEnrollmentsLocal()).filter(e => e.id !== id));
  // Also remove student account if approved
  const studentId = `enr_${id}`;
  const accounts = await getStudentAccounts();
  await kvSet(ACCOUNT_KEY, accounts.filter(a => a.student_id !== studentId));

  // Dọn dẹp bản ghi students + sĩ số lớp
  try {
    await supabase.from("students").delete().eq("id", studentId);
    const classId = enr?.assigned_class_id;
    if (classId) {
      const { data: cls } = await supabase
        .from("classes")
        .select("id, student_ids")
        .eq("id", classId)
        .maybeSingle();
      const ids = (cls?.student_ids as string[] | null) ?? [];
      if (ids.includes(studentId)) {
        await supabase
          .from("classes")
          .update({ student_ids: ids.filter(x => x !== studentId) })
          .eq("id", classId);
      }
    }
  } catch { /* offline */ }

  // Xóa tài khoản Supabase Auth (enr?.supabase_user_id) cần service role key
  // phía server — chưa làm ở client. TODO phase 3.
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

export async function getStudentAccounts(): Promise<StudentAccount[]> {
  return kvGet<StudentAccount[]>(ACCOUNT_KEY, []);
}

export async function changeStudentPassword(
  studentId: string,
  currentPassword: string,
  newPassword: string
): Promise<"ok" | "wrong_password" | "not_found"> {
  if (!studentId.startsWith("enr_")) return "not_found";
  const enrollmentId = studentId.slice(4);
  // Xác thực + cập nhật server-side, đồng bộ cả Supabase Auth
  try {
    const res = await fetch("/api/account/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollment_id: enrollmentId,
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
    if (res.ok) {
      // Cập nhật cache local cho khớp
      const all = await readEnrollmentsLocal();
      writeEnrollmentsLocal(
        all.map(e => (e.id === enrollmentId ? { ...e, account_password: newPassword } : e))
      );
      return "ok";
    }
    const { error } = await res.json();
    if (error === "wrong_password") return "wrong_password";
    if (error === "not_found") return "not_found";
    // API chưa cấu hình (501) → fallback cập nhật trực tiếp bảng (không sync auth)
    if (res.status !== 501) return "not_found";
  } catch { /* offline — fallback bên dưới */ }

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

export async function getCurrentStudentAccount(): Promise<StudentAccount | null> {
  const accounts = await getStudentAccounts();
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

async function getStoredExamScores(): Promise<StoredExamScore[]> {
  return kvGet<StoredExamScore[]>(SCORES_KEY, []);
}

export async function saveExamScore(score: Omit<StoredExamScore, "id">): Promise<StoredExamScore> {
  const record: StoredExamScore = { ...score, id: crypto.randomUUID() };
  await kvSet(SCORES_KEY, [...(await getStoredExamScores()), record]);
  return record;
}

export async function deleteExamScore(id: string): Promise<void> {
  await kvSet(SCORES_KEY, (await getStoredExamScores()).filter(s => s.id !== id));
}

export async function getExamScoresByStudent(studentId: string): Promise<StoredExamScore[]> {
  return (await getStoredExamScores()).filter(s => s.student_id === studentId);
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
  pinned?: boolean;             // notes: pinned to top
  kind?: "material" | "lecture" | "note"; // undefined = material (backward compat)
}

const MATERIALS_KEY = "tutorhub_class_materials";

async function getStoredMaterials(): Promise<StoredClassMaterial[]> {
  return kvGet<StoredClassMaterial[]>(MATERIALS_KEY, []);
}

export async function getClassMaterials(classId: string): Promise<StoredClassMaterial[]> {
  return (await getStoredMaterials()).filter(m => m.class_id === classId);
}

export async function saveClassMaterial(mat: Omit<StoredClassMaterial, "id" | "download_count">): Promise<StoredClassMaterial> {
  const record: StoredClassMaterial = { ...mat, id: `mat_${Date.now()}`, download_count: 0 };
  await kvSet(MATERIALS_KEY, [...(await getStoredMaterials()), record]);
  return record;
}

export async function deleteClassMaterial(materialId: string): Promise<void> {
  const updated = (await getStoredMaterials()).filter(m => m.id !== materialId);
  await kvSet(MATERIALS_KEY, updated);
}

export async function incrementMaterialDownload(materialId: string): Promise<void> {
  const all = await getStoredMaterials();
  const idx = all.findIndex(m => m.id === materialId);
  if (idx >= 0) {
    all[idx] = { ...all[idx], download_count: all[idx].download_count + 1 };
    await kvSet(MATERIALS_KEY, all);
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

async function getAllHomeworkAttachments(): Promise<HomeworkAttachment[]> {
  return kvGet<HomeworkAttachment[]>(HW_ATTACHMENTS_KEY, []);
}

export async function getHomeworkAttachments(homeworkId: string): Promise<HomeworkAttachment[]> {
  return (await getAllHomeworkAttachments()).filter(a => a.homework_id === homeworkId);
}

export async function saveHomeworkAttachment(att: HomeworkAttachment): Promise<void> {
  await kvSet(HW_ATTACHMENTS_KEY, [...(await getAllHomeworkAttachments()), att]);
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

export async function getClassTuition(classId: string): Promise<ClassTuitionConfig> {
  const parsed = await kvGet<ClassTuitionConfig & { default_fee?: number }>(tuitionKey(classId), DEFAULT_TUITION);
  // Migrate old default_fee format
  if (typeof parsed.default_fee === "number" && !parsed.package_fees) {
    return { package_fees: { online: parsed.default_fee, advanced: parsed.default_fee, offline: parsed.default_fee }, students: parsed.students ?? {} };
  }
  return parsed;
}

export async function saveClassTuition(classId: string, config: ClassTuitionConfig): Promise<void> {
  await kvSet(tuitionKey(classId), config);
}

export async function recordTuitionPayment(
  classId: string,
  studentId: string,
  payment: Omit<TuitionPaymentRecord, "id">
): Promise<void> {
  const config = await getClassTuition(classId);
  const student = config.students[studentId] ?? { payments: [] };
  const newPayment: TuitionPaymentRecord = { ...payment, id: crypto.randomUUID() };
  config.students[studentId] = { ...student, payments: [...student.payments, newPayment] };
  await saveClassTuition(classId, config);

  // Đồng bộ: chỉ đánh dấu hóa đơn (lớp + học sinh + kỳ) là đã đóng khi tổng
  // các lần đóng trong kỳ đã đủ số tiền hóa đơn (hỗ trợ đóng từng phần).
  const totalForPeriod = config.students[studentId].payments
    .filter(p => p.period === payment.period)
    .reduce((s, p) => s + p.amount, 0);
  await kvUpdate<TuitionInvoice[]>(INVOICE_KEY, DEFAULT_INVOICES, invoices =>
    invoices.map(inv =>
      inv.class_id === classId && inv.child_id === studentId && inv.period === payment.period &&
      inv.status !== "paid" && totalForPeriod >= inv.amount
        ? { ...inv, status: "paid" as const, paid_at: new Date().toISOString() }
        : inv
    )
  );
}

/** Xóa học viên khỏi sĩ số lớp trong DB (bảng classes.student_ids). */
export async function removeStudentFromClass(classId: string, studentId: string): Promise<void> {
  try {
    const { data: cls } = await supabase
      .from("classes")
      .select("id, student_ids")
      .eq("id", classId)
      .maybeSingle();
    const ids = (cls?.student_ids as string[] | null) ?? [];
    if (ids.includes(studentId)) {
      await supabase
        .from("classes")
        .update({ student_ids: ids.filter(x => x !== studentId) })
        .eq("id", classId);
    }
  } catch { /* offline — DB sẽ không đổi, extra-students local vẫn được cập nhật */ }
}

export async function deleteTuitionPayment(classId: string, studentId: string, paymentId: string): Promise<void> {
  const config = await getClassTuition(classId);
  const student = config.students[studentId];
  if (!student) return;
  config.students[studentId] = { ...student, payments: student.payments.filter(p => p.id !== paymentId) };
  await saveClassTuition(classId, config);
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

async function getStoredReviews(): Promise<CourseReview[]> {
  return kvGet<CourseReview[]>(REVIEWS_KEY, []);
}

export async function getCourseReviews(courseId: string): Promise<CourseReview[]> {
  return (await getStoredReviews()).filter(r => r.course_id === courseId);
}

export async function submitCourseReview(review: Omit<CourseReview, "id">): Promise<CourseReview> {
  const all = await getStoredReviews();
  // One review per student per course — upsert
  const existing = all.findIndex(r => r.course_id === review.course_id && r.student_id === review.student_id);
  const record: CourseReview = { ...review, id: existing >= 0 ? all[existing].id : crypto.randomUUID() };
  if (existing >= 0) all[existing] = record; else all.push(record);
  await kvSet(REVIEWS_KEY, all);
  return record;
}

export async function deleteReview(reviewId: string): Promise<void> {
  const updated = (await getStoredReviews()).filter(r => r.id !== reviewId);
  await kvSet(REVIEWS_KEY, updated);
}

export async function getCourseRating(courseId: string): Promise<{ rating: number; reviewCount: number }> {
  const reviews = await getCourseReviews(courseId);
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

export async function getManagedUsers(): Promise<ManagedUser[]> {
  return kvGet<ManagedUser[]>(MANAGED_USERS_KEY, []);
}

export async function saveManagedUser(user: ManagedUser): Promise<void> {
  const all = await getManagedUsers();
  const idx = all.findIndex(u => u.id === user.id);
  if (idx >= 0) all[idx] = user; else all.push(user);
  await kvSet(MANAGED_USERS_KEY, all);
}

export async function deleteManagedUser(id: string): Promise<void> {
  const all = (await getManagedUsers()).filter(u => u.id !== id);
  await kvSet(MANAGED_USERS_KEY, all);
}

export async function resetManagedUserPassword(id: string, newPassword: string): Promise<void> {
  const all = await getManagedUsers();
  const user = all.find(u => u.id === id);
  if (user) { user.password = newPassword; await kvSet(MANAGED_USERS_KEY, all); }
}

export async function toggleManagedUserDisabled(id: string): Promise<void> {
  const all = await getManagedUsers();
  const user = all.find(u => u.id === id);
  if (user) { user.disabled = !user.disabled; await kvSet(MANAGED_USERS_KEY, all); }
}
