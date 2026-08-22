import { createClient } from "./supabase/client";
import { Student, Teacher, Class, Notification, ClassSchedule } from "@/types";
import type { AttendanceStatus } from "@/lib/attendance";
import {
  cachedClientQuery,
  invalidateClientQueries,
  normalizedQueryKey,
} from "@/lib/client-query-cache";

const supabase = createClient();

// Cache keys for the four core entity lists that are still read directly.
const ENTITY_KEYS = {
  students: "tutorhub_cache_v2_students",
  teachers: "tutorhub_cache_v2_teachers",
  classes: "tutorhub_cache_v2_classes",
  notifications: "tutorhub_cache_v2_notifications",
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
// NOTE: datasets migrated to per-row tables (student_comments, course_reviews,
// class_materials, homework_attachments, class_teacher_overrides, teacher_homework,
// teacher classes→classes, teacher_attendance, teacher_materials, submissions,
// parent_messages, schedule_notifications) are accessed via their own wrappers,
// NOT through this KV routing map — their old kv_* tables no longer exist.
const KV_PREFIX_ROUTES: Array<[string, string]> = [
  ["tutorhub_curriculum_",            "kv_curriculum"],
  ["tutorhub_tuition_",               "kv_tuition"],
  ["tutorhub_student_packages_",      "kv_student_packages"],
  ["tutorhub_session_notes_",         "kv_session_notes"],
  ["tutorhub_class_extra_students_",  "kv_class_extra_students"],
  ["tutorhub_exam_result_",           "kv_exam_results"],
  ["tutorhub_exam_submissions_",      "kv_exam_submissions"],
  ["tutorhub_invoices",               "kv_invoices"],
  ["tutorhub_teacher_settings_",      "kv_teacher_settings"],
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
  return cachedClientQuery(`kv:${route.table}:${route.id}`, async () => {
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
        // DB không có row: có thể đã bị xóa (VD "làm lại bài thi") hoặc chưa từng
        // tồn tại. KHÔNG đẩy cache local ngược lên DB — làm vậy sẽ "hồi sinh" bản
        // đã xóa cho mọi thiết bị. Vẫn trả local (đọc offline/legacy), nhưng deletion
        // trên server được tôn trọng.
        const local = kvReadLocal<T>(key);
        return local !== null ? local : fallback;
      }
    } catch { /* offline */ }
    const local = kvReadLocal<T>(key);
    return local !== null ? local : fallback;
  }, 30_000);
}

function invalidateKvRelated(table: string) {
  if (table === "kv_curriculum") {
    invalidateClientQueries(
      "teacher-curricula:",
      "student-curriculum:",
      "student-learning-snapshot:",
      "teacher-submission-snapshots:",
    );
  }
  if (table === "kv_exam_results" || table === "kv_exam_submissions") {
    invalidateClientQueries(
      "student-learning-snapshot:",
      "teacher-submission-snapshots:",
    );
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  kvWriteLocal(key, value);
  const route = kvRoute(key);
  if (!route) return;
  invalidateClientQueries(`kv:${route.table}:${route.id}`);
  invalidateKvRelated(route.table);
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
  invalidateClientQueries(`kv:${route.table}:${route.id}`);
  invalidateKvRelated(route.table);
  try {
    const { error } = await supabase.from(route.table).delete().eq("id", route.id);
    if (error) console.error(`Error deleting ${route.table}/${route.id}:`, error);
  } catch { /* offline */ }
}

// Supabase-first getter: DB là nguồn dữ liệu chính; localStorage chỉ là cache
// offline. Bảng rỗng là trạng thái hợp lệ (đã xóa hết) — chỉ fallback khi lỗi.
async function getEntity<T>(
  key: string,
  table: string,
  query: () => Promise<{ data: T[] | null; error: unknown }>,
  ttlMs = 30_000,
): Promise<T[]> {
  return cachedClientQuery(`entity:${table}`, async () => {
    try {
      const { data, error } = await query();
      if (!error && data) {
        writeLocal(key, data);
        return data;
      }
      // Một truy vấn LỖI không giống "bảng rỗng", nhưng cả hai đều rơi xuống dưới
      // và trả về [] — nên RLS chặn, thiếu hàm helper, hay sai quyền đều hiện ra
      // thành "không có dữ liệu" và không ai chẩn đoán được. Ít nhất phải ghi ra.
      if (error) reportQueryFailure(table, error);
    } catch (thrown) {
      // Mất mạng hoặc chưa cấu hình — dùng cache. Vẫn ghi lại để phân biệt.
      reportQueryFailure(table, thrown);
    }
    const local = readLocal<T>(key);
    if (local !== null) return local;
    return [];
  }, ttlMs);
}

function reportQueryFailure(table: string, error: unknown) {
  if (typeof console === "undefined") return;
  const detail =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error);
  console.error(
    `[TutorHub] Không đọc được bảng "${table}" — danh sách sẽ hiện rỗng. Nguyên nhân: ${detail}`,
  );
}

async function upsertEntity<T extends { id: string }>(
  table: string,
  item: T,
): Promise<T> {
  const response = await fetch(`/api/data/entities/${encodeURIComponent(table)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Không thể lưu ${table}.`);
  }
  const saved = await response.json() as T;
  invalidateClientQueries(`entity:${table}`);
  return saved;
}

async function deleteEntity(table: string, id: string): Promise<void> {
  const response = await fetch(
    `/api/data/entities/${encodeURIComponent(table)}?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Không thể xóa ${table}.`);
  }
  invalidateClientQueries(`entity:${table}`);
}

export async function getStudents(): Promise<Student[]> {
  return getEntity(
    ENTITY_KEYS.students,
    "students",
    () => supabase.from("students").select("*").order("created_at", { ascending: false }) as any
  );
}

export async function upsertStudent(student: Student): Promise<Student> {
  return upsertEntity("students", student);
}

export async function deleteStudent(id: string): Promise<void> {
  return deleteEntity("students", id);
}

export async function getTeachers(): Promise<Teacher[]> {
  return getEntity(
    ENTITY_KEYS.teachers,
    "teachers",
    () => supabase.from("teachers").select("*").order("created_at", { ascending: false }) as any
  );
}

export async function upsertTeacher(teacher: Teacher): Promise<Teacher> {
  return upsertEntity("teachers", teacher);
}

export async function deleteTeacher(id: string): Promise<void> {
  return deleteEntity("teachers", id);
}

export async function getClasses(): Promise<Class[]> {
  return getEntity(
    ENTITY_KEYS.classes,
    "classes",
    () => supabase.from("classes").select("*").order("created_at", { ascending: false }) as any
  );
}

// Targeted single-class write/delete (admin + owning teacher via RLS). Avoids the
// destructive full-table replace that could drop classes created by others.
export async function upsertClass(cls: Class): Promise<void> {
  const { error } = await supabase.from("classes").upsert({
    id: cls.id,
    class_name: cls.class_name,
    subject: cls.subject,
    grade: typeof cls.grade === "number" ? cls.grade : (cls.grade != null && /^[0-9]+$/.test(String(cls.grade)) ? Number(cls.grade) : null),
    learning_mode: cls.learning_mode,
    tutor_id: cls.tutor_id,
    classroom: cls.classroom ?? null,
    zoom_link: cls.zoom_link ?? null,
    schedule: cls.schedule ?? [],
    student_ids: cls.student_ids ?? [],
    description: cls.description ?? null,
    max_students: cls.max_students ?? 15,
    color: cls.color ?? "#6366f1",
  }, { onConflict: "id" });
  if (error) { console.error("upsertClass:", error); throw error; }
  invalidateClientQueries("entity:classes");
}

export async function deleteClass(id: string): Promise<void> {
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) { console.error("deleteClass:", error); throw error; }
  invalidateClientQueries("entity:classes");
}

/** Điểm danh THẬT do giáo viên nhập (kv_teacher_attendance) — dùng cho báo cáo. */
export interface TeacherAttendanceRecord {
  class_id: string;
  student_id: string;
  date: string;      // YYYY-MM-DD
  status: AttendanceStatus;
  saved_at: string;
}
export interface AttendanceQuery {
  classIds?: readonly string[];
  studentIds?: readonly string[];
  from?: string;
  to?: string;
}

export async function getAllTeacherAttendance(
  filters: AttendanceQuery = {},
): Promise<TeacherAttendanceRecord[]> {
  if (filters.classIds?.length === 0 || filters.studentIds?.length === 0) return [];
  const key = normalizedQueryKey("teacher-attendance", {
    classIds: filters.classIds,
    studentIds: filters.studentIds,
    from: filters.from,
    to: filters.to,
  });
  return cachedClientQuery(key, async () => {
    let query = supabase.from("class_attendance").select("data");
    if (filters.classIds) query = query.in("class_id", [...filters.classIds]);
    if (filters.studentIds) query = query.in("student_id", [...filters.studentIds]);
    if (filters.from) query = query.gte("attendance_date", filters.from);
    if (filters.to) query = query.lte("attendance_date", filters.to);

    const { data, error } = await query;
    if (error) {
      console.error("getAllTeacherAttendance:", error);
      return [];
    }
    return (data ?? []).map(r => r.data as TeacherAttendanceRecord);
  }, 30_000);
}

// Upsert attendance rows (per class/student/date). Replaces the old
// full-blob kvSet — callers pass the records they changed.
export async function saveClassAttendance(records: TeacherAttendanceRecord[]): Promise<void> {
  if (records.length === 0) return;
  const rows = records.map(r => ({
    class_id: r.class_id,
    student_id: r.student_id,
    attendance_date: r.date,
    data: r,
  }));
  const { error } = await supabase
    .from("class_attendance")
    .upsert(rows, { onConflict: "class_id,student_id,attendance_date" });
  if (error) {
    console.error("saveClassAttendance:", error);
    throw error;
  }
  invalidateClientQueries("teacher-attendance:");
}

/**
 * Thay toàn bộ điểm danh của các học viên đang được quản lý trong một buổi.
 * Các lựa chọn bị bỏ/reset được xóa thật khỏi Supabase; lịch sử của học viên đã
 * rời lớp không nằm trong managedStudentIds vẫn được giữ nguyên.
 */
export async function replaceClassAttendanceForDate(
  classId: string,
  date: string,
  records: TeacherAttendanceRecord[],
  managedStudentIds: readonly string[],
): Promise<void> {
  const managedIds = [...new Set(managedStudentIds.filter(Boolean))];
  const keepIds = new Set(records.map((record) => record.student_id));

  if (records.length > 0) {
    await saveClassAttendance(records);
  }

  const clearedIds = managedIds.filter((studentId) => !keepIds.has(studentId));
  if (clearedIds.length > 0) {
    const { error } = await supabase
      .from("class_attendance")
      .delete()
      .eq("class_id", classId)
      .eq("attendance_date", date)
      .in("student_id", clearedIds);
    if (error) {
      console.error("replaceClassAttendanceForDate(delete):", error);
      throw error;
    }
  }
  invalidateClientQueries("teacher-attendance:");
}

// ── Per-row wrappers for the migrated page datasets ──────────────────────────
// Each stores the full domain object in a jsonb `data` column plus scope columns
// used by RLS. Reads return the payload typed by the caller's generic.

export async function getTeacherHomework<T = Record<string, unknown>>(
  classIds?: readonly string[],
): Promise<T[]> {
  if (classIds?.length === 0) return [];
  const key = normalizedQueryKey("teacher-homework", { classIds });
  return cachedClientQuery(key, async () => {
    let query = supabase.from("teacher_homework").select("data");
    if (classIds) query = query.in("class_id", [...classIds]);
    const { data, error } = await query;
    if (error) { console.error("getTeacherHomework:", error); return []; }
    return (data ?? []).map(r => r.data as T);
  }, 30_000);
}
export async function upsertTeacherHomework<T extends { id: string; class_id: string }>(hw: T): Promise<void> {
  const { error } = await supabase
    .from("teacher_homework")
    .upsert({ id: hw.id, class_id: hw.class_id, data: hw }, { onConflict: "id" });
  if (error) { console.error("upsertTeacherHomework:", error); throw error; }
  invalidateClientQueries("teacher-homework:");
}
export async function removeTeacherHomework(id: string): Promise<void> {
  const { error } = await supabase.from("teacher_homework").delete().eq("id", id);
  if (error) { console.error("removeTeacherHomework:", error); throw error; }
  invalidateClientQueries("teacher-homework:");
}

// Teacher-created classes are now unified into the core `classes` table.
// getClasses()/useTeacherContext already return them (RLS-scoped), so this
// returns [] — call sites merge it with the context/classes list and thus see
// no duplicates. upsert/remove write directly to `classes` (teacher RLS).
export async function getTeacherExtraClasses<T = Record<string, unknown>>(): Promise<T[]> {
  return [];
}
export async function upsertTeacherExtraClass<T extends { id: string; tutor_id: string; student_ids?: string[] }>(cls: T): Promise<void> {
  const c = cls as Record<string, unknown>;
  const gradeRaw = c.grade;
  const grade = typeof gradeRaw === "number" ? gradeRaw : (typeof gradeRaw === "string" && /^[0-9]+$/.test(gradeRaw) ? parseInt(gradeRaw, 10) : null);
  const maxRaw = c.max_students;
  const row = {
    id: cls.id,
    class_name: (c.class_name as string) ?? "",
    subject: (c.subject as string) ?? "",
    grade,
    learning_mode: (c.learning_mode as string) || "hybrid",
    tutor_id: cls.tutor_id,
    classroom: (c.classroom as string) ?? null,
    zoom_link: (c.zoom_link as string) ?? null,
    schedule: c.schedule ?? [],
    student_ids: cls.student_ids ?? [],
    description: (c.description as string) ?? null,
    max_students: typeof maxRaw === "number" ? maxRaw : 15,
    color: (c.color as string) || "#6366f1",
  };
  const { error } = await supabase.from("classes").upsert(row, { onConflict: "id" });
  if (error) { console.error("upsertTeacherExtraClass(classes):", error); throw error; }
  invalidateClientQueries("entity:classes");
}
export async function removeTeacherExtraClass(id: string): Promise<void> {
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) { console.error("removeTeacherExtraClass(classes):", error); throw error; }
  invalidateClientQueries("entity:classes");
}

export interface SubmissionQuery {
  classIds?: readonly string[];
  studentIds?: readonly string[];
  homeworkIds?: readonly string[];
}

export async function getHwSubmissions<T = Record<string, unknown>>(
  filters: SubmissionQuery = {},
): Promise<T[]> {
  if (
    filters.classIds?.length === 0
    || filters.studentIds?.length === 0
    || filters.homeworkIds?.length === 0
  ) return [];

  const key = normalizedQueryKey("homework-submissions", {
    classIds: filters.classIds,
    studentIds: filters.studentIds,
    homeworkIds: filters.homeworkIds,
  });
  return cachedClientQuery(key, async () => {
    let query = supabase.from("hw_submissions").select("data");
    if (filters.classIds) query = query.in("class_id", [...filters.classIds]);
    if (filters.studentIds) query = query.in("student_id", [...filters.studentIds]);
    if (filters.homeworkIds) query = query.in("homework_id", [...filters.homeworkIds]);
    const { data, error } = await query;
    if (error) { console.error("getHwSubmissions:", error); return []; }
    return (data ?? []).map(r => r.data as T);
  }, 20_000);
}
export async function upsertHwSubmission<T extends { id: string; homework_id: string; student_id: string; class_id?: string }>(sub: T): Promise<void> {
  const { error } = await supabase
    .from("hw_submissions")
    .upsert(
      { id: sub.id, homework_id: sub.homework_id, student_id: sub.student_id, class_id: sub.class_id ?? null, data: sub },
      { onConflict: "id" }
    );
  if (error) { console.error("upsertHwSubmission:", error); throw error; }
  invalidateClientQueries("homework-submissions:");
}

export async function getTeacherMaterials<T = Record<string, unknown>>(
  teacherId?: string,
): Promise<T[]> {
  return cachedClientQuery(`teacher-materials:${teacherId ?? "all"}`, async () => {
    let query = supabase.from("teacher_materials").select("data");
    if (teacherId) query = query.eq("teacher_id", teacherId);
    const { data, error } = await query;
    if (error) { console.error("getTeacherMaterials:", error); return []; }
    return (data ?? []).map(r => r.data as T);
  }, 60_000);
}

/** Filtered material catalog for the signed-in student.
 * Raw teacher_materials rows contain paid URLs and are intentionally not
 * selectable by student JWTs. */
export async function getStudentMaterials<T = Record<string, unknown>>(): Promise<T[]> {
  return cachedClientQuery("student-materials", async () => {
    const response = await fetch("/api/student/materials", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error("Không thể tải tài liệu học viên.");
    return response.json() as Promise<T[]>;
  }, 60_000);
}
// Replace this teacher's catalog without a delete-first window. New/updated
// rows are persisted before stale rows are removed, so a failed upsert cannot
// erase the teacher's existing catalog.
export async function saveTeacherMaterials<T extends { id: string; classId?: string; published?: boolean }>(
  list: T[],
  teacherId: string,
): Promise<void> {
  const unique = [...new Map(list.map(item => [item.id, item])).values()];
  const rows = unique.map(c => ({
    id: c.id,
    teacher_id: teacherId,
    class_id: c.classId ?? null,
    published: !!c.published,
    data: c,
  }));
  if (rows.length > 0) {
    const { error } = await supabase
      .from("teacher_materials")
      .upsert(rows, { onConflict: "id" });
    if (error) {
      console.error("saveTeacherMaterials(upsert):", error);
      throw error;
    }
  }

  const { data: currentRows, error: currentError } = await supabase
    .from("teacher_materials")
    .select("id")
    .eq("teacher_id", teacherId);
  if (currentError) throw currentError;
  const keepIds = new Set(unique.map(item => item.id));
  const staleIds = (currentRows ?? []).map(row => String(row.id)).filter(id => !keepIds.has(id));
  invalidateClientQueries("teacher-materials:", "student-materials");
  if (staleIds.length === 0) return;
  const { error: deleteError } = await supabase
    .from("teacher_materials")
    .delete()
    .eq("teacher_id", teacherId)
    .in("id", staleIds);
  if (deleteError) {
    console.error("saveTeacherMaterials(delete stale):", deleteError);
    throw deleteError;
  }
}

// Per-parent messages (one jsonb row per parent).
export async function getParentMessages<T = unknown>(parentId: string): Promise<T | null> {
  if (!parentId) return null;
  return cachedClientQuery(`parent-messages:${parentId}`, async () => {
    const { data, error } = await supabase
      .from("parent_messages")
      .select("data")
      .eq("parent_id", parentId)
      .maybeSingle();
    if (error) { console.error("getParentMessages:", error); return null; }
    return (data?.data ?? null) as T | null;
  }, 30_000);
}
export async function saveParentMessages(parentId: string, contacts: unknown): Promise<void> {
  if (!parentId) return;
  const { error } = await supabase
    .from("parent_messages")
    .upsert({ parent_id: parentId, data: contacts, updated_at: new Date().toISOString() }, { onConflict: "parent_id" });
  if (error) console.error("saveParentMessages:", error);
  else invalidateClientQueries(`parent-messages:${parentId}`);
}

export async function getNotifications(): Promise<Notification[]> {
  return getEntity<Notification>(
    ENTITY_KEYS.notifications,
    "notifications",
    () => supabase.from("notifications").select("*").order("created_at", { ascending: false }) as any,
    120_000,
  );
}

export async function upsertNotification(
  notification: Notification,
): Promise<Notification> {
  return upsertEntity("notifications", notification);
}

export async function deleteNotification(id: string): Promise<void> {
  return deleteEntity("notifications", id);
}

export async function getNotificationStates(): Promise<Record<string, { isDeleted: boolean }>> {
  return cachedClientQuery("notification-states", async () => {
    const { data, error } = await supabase
      .from("notification_reads")
      .select("notification_id,is_deleted");
    if (error) throw error;
    return Object.fromEntries(
      (data ?? []).map(row => [
        String(row.notification_id),
        { isDeleted: row.is_deleted === true },
      ]),
    );
  }, 60_000);
}

export async function markNotificationState(
  notificationId: string,
  isDeleted = false,
): Promise<void> {
  const { error } = await supabase
    .from("notification_reads")
    .upsert(
      { notification_id: notificationId, is_deleted: isDeleted, read_at: new Date().toISOString() },
      { onConflict: "notification_id,user_id" },
    );
  if (error) throw error;
  invalidateClientQueries("notification-states");
}

export async function markNotificationsRead(notificationIds: readonly string[]): Promise<void> {
  if (notificationIds.length === 0) return;
  const rows = notificationIds.map(notificationId => ({
    notification_id: notificationId,
    is_deleted: false,
    read_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("notification_reads")
    .upsert(rows, { onConflict: "notification_id,user_id" });
  if (error) throw error;
  invalidateClientQueries("notification-states");
}

export interface NewNotification {
  title: string;
  content: string;
  target_role: Notification["target_role"];
  category?: Notification["category"];
  sent_by?: string;
  // Giới hạn theo lớp (cột có sẵn trong bảng notifications) — VD báo học sinh của
  // 1 lớp khi giao bài / chấm bài. Bỏ trống = gửi cho mọi người thuộc target_role.
  target_class_id?: string;
  target_class_name?: string;
  target_student_id?: string;
}

/** Thêm một thông báo (đọc danh sách hiện tại rồi ghi kèm mục mới lên đầu). */
export async function addNotification(n: NewNotification): Promise<void> {
  return addNotifications([n]);
}

/** Thêm nhiều thông báo trong một lần đọc-ghi. */
export async function addNotifications(items: NewNotification[]): Promise<void> {
  if (items.length === 0) return;
  const now = Date.now();
  const fulls: Notification[] = items.map((n, i) => ({
    id: `ntf_${now}_${i}_${Math.random().toString(36).slice(2, 5)}`,
    title: n.title,
    content: n.content,
    target_role: n.target_role,
    is_read: false,
    created_at: new Date(now + i).toISOString(),
    category: n.category,
    sent_by: n.sent_by,
    target_class_id: n.target_class_id,
    target_student_id: n.target_student_id,
  }));
  await Promise.all(fulls.map(upsertNotification));
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
  const { data, error } = await supabase
    .from("student_comments")
    .select("comment_text, comment_date, rating")
    .eq("student_id", studentId)
    .order("comment_date", { ascending: false });
  if (error) {
    console.error("getStudentComments:", error);
    return [];
  }
  return (data ?? []).map(r => ({ text: r.comment_text, date: r.comment_date, rating: r.rating }));
}

export async function getStudentCommentsMany(
  studentIds: readonly string[],
): Promise<Record<string, { text: string; date: string; rating: number }[]>> {
  if (studentIds.length === 0) return {};
  const { data, error } = await supabase
    .from("student_comments")
    .select("student_id,comment_text,comment_date,rating")
    .in("student_id", [...studentIds])
    .order("comment_date", { ascending: false });
  if (error) throw error;
  const grouped: Record<string, { text: string; date: string; rating: number }[]> = {};
  for (const row of data ?? []) {
    const studentId = String(row.student_id);
    (grouped[studentId] ??= []).push({
      text: row.comment_text,
      date: row.comment_date,
      rating: row.rating,
    });
  }
  return grouped;
}

export async function saveStudentComment(studentId: string, commentsList: { text: string; date: string; rating: number }[]): Promise<void> {
  // Compatibility for legacy callers: they put the newly-created note first.
  // Persist only that record so one teacher can never replace another teacher's
  // notes through a read-modify-write race.
  const newest = commentsList[0];
  if (!newest) return;
  const response = await fetch("/api/teacher/student-comments", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId,
      text: newest.text,
      date: newest.date,
      rating: newest.rating,
      visibility: "shared",
      tag: "general",
    }),
  });
  if (!response.ok) throw new Error("Không thể lưu nhận xét học viên.");
}

// ── Teacher-class assignment overrides (localStorage) ────────────────────────
// Allows admin to reassign classes to different teachers.

export async function getClassTeacherOverrides(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("class_teacher_overrides")
    .select("class_id, teacher_id");
  if (error) {
    console.error("getClassTeacherOverrides:", error);
    return {};
  }
  const map: Record<string, string> = {};
  for (const r of data ?? []) map[r.class_id] = r.teacher_id;
  return map;
}

export async function setClassTeacherOverride(classId: string, teacherId: string): Promise<void> {
  const { error } = await supabase
    .from("class_teacher_overrides")
    .upsert({ class_id: classId, teacher_id: teacherId, updated_at: new Date().toISOString() }, { onConflict: "class_id" });
  if (error) {
    console.error("setClassTeacherOverride:", error);
    throw error;
  }
}

// ── Schedule overrides (localStorage) ───────────────────────────────────────

export async function getClassScheduleOverride(classId: string): Promise<ClassSchedule[] | null> {
  const { data, error } = await supabase
    .from("classes")
    .select("schedule")
    .eq("id", classId)
    .maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.schedule) ? data.schedule as ClassSchedule[] : null;
}

export async function saveClassScheduleOverride(classId: string, schedule: ClassSchedule[]): Promise<void> {
  const { error } = await supabase
    .from("classes")
    .update({ schedule })
    .eq("id", classId);
  if (error) throw error;
  invalidateClientQueries("entity:classes");
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
  // RLS returns only notifications for classes the caller teaches or is enrolled
  // in. Read-state is per-user via schedule_notification_reads.
  const [notifRes, readRes] = await Promise.all([
    supabase.from("schedule_notifications").select("*").order("created_at", { ascending: false }),
    supabase.from("schedule_notification_reads").select("notification_id"),
  ]);
  if (notifRes.error) {
    console.error("getScheduleNotifications:", notifRes.error);
    return [];
  }
  const readSet = new Set((readRes.data ?? []).map(r => r.notification_id));
  return (notifRes.data ?? []).map(n => ({ ...n, is_read: readSet.has(n.id) })) as ScheduleNotification[];
}

export async function pushScheduleNotification(notif: Omit<ScheduleNotification, "id" | "created_at" | "is_read">): Promise<void> {
  const { error } = await supabase.from("schedule_notifications").insert({
    id: crypto.randomUUID(),
    class_id: notif.class_id,
    class_name: notif.class_name,
    message: notif.message,
  });
  if (error) {
    console.error("pushScheduleNotification:", error);
    throw error;
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
  class_id?: string;
  teacher_id?: string;
  receipt_path?: string;
  transfer_note: string;
  status: TxStatus;
  created_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

const TX_KEY = "tutorhub_transactions";

function writeTxLocal(txs: PurchaseTransaction[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(TX_KEY, JSON.stringify(txs)); } catch { /* ignore */ }
}

// Supabase-first: học viên tạo giao dịch trên máy của họ, admin duyệt trên
// máy khác — cả hai thấy cùng dữ liệu. localStorage chỉ là cache offline.
export async function getTransactions(): Promise<PurchaseTransaction[]> {
  return cachedClientQuery("payment-transactions", async () => {
    const response = await fetch("/api/payments/transactions", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error("Không thể tải giao dịch.");
    const data = (await response.json()) as PurchaseTransaction[];
    writeTxLocal(data);
    return data;
  }, 20_000);
}

export async function createTransaction(
  tx: Omit<PurchaseTransaction, "id" | "created_at" | "status">
): Promise<PurchaseTransaction> {
  const response = await fetch("/api/payments/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pkg_id: tx.pkg_id,
      transfer_note: tx.transfer_note,
      receipt_path: tx.receipt_path,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Không thể tạo giao dịch.");
  invalidateClientQueries("payment-transactions");
  return result as PurchaseTransaction;
}

export async function updateTransactionStatus(
  txId: string,
  status: "approved" | "rejected",
  rejectionReason?: string,
): Promise<void> {
  const response = await fetch("/api/payments/transactions", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction_id: txId,
      status,
      rejection_reason: status === "rejected" ? rejectionReason : undefined,
    }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Không thể cập nhật giao dịch.");
  }
  invalidateClientQueries("payment-transactions");
}

// Gói được mở khóa = có giao dịch approved của học viên đó (Supabase),
// hợp nhất với danh sách cấp thủ công cũ trong localStorage (legacy).
export async function getGrantedPackages(studentId?: string): Promise<string[]> {
  const transactions = await getTransactions();
  return [
    ...new Set(
      transactions
        .filter(
          (transaction) =>
            transaction.status === "approved" &&
            (!studentId || transaction.student_id === studentId),
        )
        .map((transaction) => transaction.pkg_id),
    ),
  ];
}

export async function markScheduleNotificationsRead(): Promise<void> {
  // Mark all notifications visible to the caller as read (per-user rows).
  const { data: notifs } = await supabase.from("schedule_notifications").select("id");
  const rows = (notifs ?? []).map(n => ({ notification_id: n.id }));
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("schedule_notification_reads")
    .upsert(rows, { onConflict: "notification_id,user_id", ignoreDuplicates: true });
  if (error) console.error("markScheduleNotificationsRead:", error);
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
  // Đúng/Sai & Trả lời ngắn: mặc định chấm theo khung chuẩn THPT (bỏ qua score).
  // "custom" = giáo viên tự đặt điểm câu (đề không chuẩn form) — dùng score.
  score_mode?: "standard" | "custom";
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
  // Thang điểm câu Đúng/Sai — % điểm câu theo số ý đúng (1/2/3/4 ý).
  // Không đặt = dùng khung chuẩn THPT (DEFAULT_TF_SCALE: 10/25/50/100%).
  true_false_scale?: { one: number; two: number; three: number; four: number };
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
  /** undefined/null hoặc mảng rỗng = hiển thị cho cả lớp; string[] = chỉ các student_id được chọn mới thấy */
  assigned_to?: string[] | null;
  exam_content?: ExamContent;
  // Exam scheduling / access control
  exam_status?: "draft" | "open" | "closed"; // default: "draft"
  exam_opens_at?: string;                     // ISO datetime for scheduled auto-open
  // Video chữa bài: liên kết (tuỳ chọn) tới bài tập về nhà tương ứng (id lesson homework/exam).
  linked_homework_id?: string;
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

/** Một mục được giao (assigned_to) có áp dụng cho học viên `studentId` không?
 *  null/undefined/mảng rỗng = giao cả lớp; ngược lại chỉ các id trong danh sách. */
export function isAssignedToStudent(assignedTo: string[] | null | undefined, studentId: string): boolean {
  if (!assignedTo || assignedTo.length === 0) return true;
  return assignedTo.includes(studentId);
}

/** Nội dung lộ trình có hiển thị cho học viên `studentId` không?
 *  Điều kiện: đã publish VÀ (giao cả lớp HOẶC nằm trong danh sách được chọn). */
export function isLessonVisibleToStudent(lesson: CurriculumLesson, studentId: string): boolean {
  if (!lesson.is_published) return false;
  return isAssignedToStudent(lesson.assigned_to, studentId);
}

export async function getCurriculum(classId: string): Promise<CurriculumChapter[]> {
  return kvGet<CurriculumChapter[]>(`tutorhub_curriculum_${classId}`, []);
}

/** Read several teacher-owned curricula in one PostgREST round trip. */
export async function getCurricula(
  classIds: readonly string[],
): Promise<Record<string, CurriculumChapter[]>> {
  const ids = [...new Set(classIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const key = normalizedQueryKey("teacher-curricula", { classIds: ids });
  return cachedClientQuery(key, async () => {
    const { data, error } = await supabase
      .from("kv_curriculum")
      .select("id,value")
      .in("id", ids);
    if (error) throw error;
    const rows = new Map(
      (data ?? []).map((row) => [String(row.id), row.value as CurriculumChapter[]]),
    );
    return Object.fromEntries(ids.map((id) => [id, rows.get(id) ?? []]));
  }, 60_000);
}

/** Published, assigned and answer-free curriculum for the signed-in student. */
export async function getStudentCurriculum(classId: string): Promise<CurriculumChapter[]> {
  return cachedClientQuery(`student-curriculum:${classId}`, async () => {
    const response = await fetch(
      `/api/student/curriculum/${encodeURIComponent(classId)}`,
      { cache: "no-store", credentials: "same-origin" },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      const error = new Error(payload?.error || "student_curriculum_unavailable");
      Object.assign(error, { status: response.status });
      throw error;
    }
    const payload = await response.json() as unknown;
    if (!Array.isArray(payload)) throw new Error("student_curriculum_invalid_response");
    return payload as CurriculumChapter[];
  }, 60_000);
}

export interface StudentLessonProgress {
  lesson_id: string;
  completed: boolean;
  notes: string;
  updated_at: string;
}

export async function getStudentLessonProgress(
  resourceId: string,
): Promise<StudentLessonProgress[]> {
  return cachedClientQuery(`student-progress:${resourceId}`, async () => {
    const response = await fetch(
      `/api/student/progress?resource_id=${encodeURIComponent(resourceId)}`,
      { cache: "no-store", credentials: "same-origin" },
    );
    if (!response.ok) return [];
    return response.json() as Promise<StudentLessonProgress[]>;
  }, 20_000);
}

export async function saveStudentLessonProgress(
  resourceId: string,
  lessonId: string,
  patch: { completed?: boolean; notes?: string },
): Promise<StudentLessonProgress> {
  const response = await fetch("/api/student/progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resource_id: resourceId,
      lesson_id: lessonId,
      completed: patch.completed === true,
      notes: patch.notes ?? "",
    }),
  });
  if (!response.ok) throw new Error("Không thể lưu tiến độ học tập.");
  const saved = await response.json() as StudentLessonProgress;
  invalidateClientQueries(`student-progress:${resourceId}`);
  return saved;
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
  // Thời lượng làm bài (giây) và lần làm thứ mấy — best-effort, do client báo.
  duration_seconds?: number;
  attempt?: number;
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
  result: { score: number; total: number; submitted_at: string; answers: Record<string, unknown>; duration_seconds?: number; attempt?: number }
): Promise<void> {
  const stored: StoredExamResult = { student_id: studentId, student_name: studentName, ...result };
  await kvSet(examResultKey(classId, lessonId, studentId), stored);
  // Track submission registry so teacher can list all results — đọc-sửa-ghi nguyên
  // tử để 2 học sinh nộp gần như đồng thời không ghi đè registry của nhau.
  await kvUpdate<string[]>(examSubmissionsKey(classId, lessonId), [], subs =>
    subs.includes(studentId) ? subs : [...subs, studentId]
  );
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

export async function getStudentPackagesForClasses(
  classIds: readonly string[],
): Promise<Record<string, Record<string, StudentPackage>>> {
  if (classIds.length === 0) return {};
  const { data, error } = await supabase
    .from("kv_student_packages")
    .select("id,value")
    .in("id", [...classIds]);
  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map(row => [
      String(row.id),
      (row.value ?? {}) as Record<string, StudentPackage>,
    ]),
  );
}

export async function saveStudentPackages(classId: string, packages: Record<string, StudentPackage>): Promise<void> {
  await kvSet(`tutorhub_student_packages_${classId}`, packages);
}

// ── Online meeting link per class (localStorage) ─────────────────────────────

export async function getOnlineLink(classId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("classes")
    .select("zoom_link")
    .eq("id", classId)
    .maybeSingle();
  if (error) throw error;
  return typeof data?.zoom_link === "string" ? data.zoom_link : null;
}

// Lưu "" khi giáo viên xóa link (khác với null = chưa từng đặt) — để trang
// không hồi sinh zoom_link mặc định sau khi link đã bị xóa chủ động.
export async function saveOnlineLink(classId: string, link: string): Promise<void> {
  const { error } = await supabase
    .from("classes")
    .update({ zoom_link: link.trim() || null })
    .eq("id", classId);
  if (error) throw error;
  invalidateClientQueries("entity:classes");
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
  submitted_at?: string;
  submitted_by?: "student" | "parent";  // who uploaded the receipt
  receipt_path?: string;
  class_id?: string;       // liên kết với lớp học (hóa đơn do giáo viên phát hành)
  period?: string;         // "YYYY-MM"
}

export async function getInvoices(): Promise<TuitionInvoice[]> {
  try {
    return await getInvoicesOrThrow();
  } catch (error) {
    reportQueryFailure("invoices", error instanceof Error ? error.message : "unknown_error");
    return [];
  }
}

export interface StudentLearningSnapshot {
  curricula: Record<string, CurriculumChapter[]>;
  examResults: Record<string, StoredExamResult>;
}

/**
 * One authenticated request for all published curricula and the signed-in
 * student's matching online-exam results. This replaces the old
 * class -> curriculum -> exam -> result request waterfall.
 */
export async function getStudentLearningSnapshot(
  classIds: readonly string[],
): Promise<StudentLearningSnapshot> {
  const ids = [...new Set(classIds.filter(Boolean))];
  if (ids.length === 0) return { curricula: {}, examResults: {} };
  const key = normalizedQueryKey("student-learning-snapshot", { classIds: ids });
  return cachedClientQuery(key, async () => {
    const response = await fetch(
      `/api/student/learning-snapshot?class_ids=${encodeURIComponent(ids.join(","))}`,
      { cache: "no-store", credentials: "same-origin" },
    );
    if (!response.ok) throw new Error("student_learning_snapshot_unavailable");
    return response.json() as Promise<StudentLearningSnapshot>;
  }, 60_000);
}

/** Load invoices while preserving transport errors for screens that render retry states. */
export async function getInvoicesOrThrow(): Promise<TuitionInvoice[]> {
  return cachedClientQuery("payment-invoices", async () => {
    const response = await fetch("/api/payments/invoices", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Không thể tải hóa đơn (HTTP ${response.status}).`);
    }
    return response.json() as Promise<TuitionInvoice[]>;
  }, 20_000);
}

/** Hoá đơn đã lưu dùng cho báo cáo/thống kê. */
export async function getInvoicesRaw(): Promise<TuitionInvoice[]> {
  return getInvoices();
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
  submittedBy: "student" | "parent",
  childId?: string // bắt buộc khi invoiceId === "ALL" để không đụng hóa đơn của học sinh khác
): Promise<void> {
  void submittedBy;
  const action = status === "paid" ? "mark_paid" : "submit_receipt";
  const response = await fetch("/api/payments/invoices", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoice_id: invoiceId, child_id: childId, action }),
  });
  if (!response.ok) throw new Error("Không thể cập nhật hóa đơn.");
  invalidateClientQueries("payment-invoices");
}

/** Giáo viên phát hành hóa đơn học phí cho một học sinh trong lớp (idempotent theo id). */
export async function submitInvoiceReceipt(
  invoiceId: string | string[],
  childId: string | undefined,
  receiptPath: string,
): Promise<void> {
  const invoiceIds = Array.isArray(invoiceId) ? [...new Set(invoiceId)] : null;
  const response = await fetch("/api/payments/invoices", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      invoice_id: invoiceIds ? undefined : invoiceId,
      invoice_ids: invoiceIds ?? undefined,
      child_id: childId,
      action: "submit_receipt",
      receipt_path: receiptPath,
    }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Không thể gửi biên lai học phí.");
  }
  invalidateClientQueries("payment-invoices");
}

export async function issueTuitionInvoice(params: {
  classId: string;
  className: string;
  studentId: string;
  amount: number;
  period: string;   // "YYYY-MM"
  dueDate: string;  // "YYYY-MM-DD"
}): Promise<TuitionInvoice> {
  const { classId, className, studentId, amount, period, dueDate } = params;
  const response = await fetch("/api/payments/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      class_id: classId,
      class_name: className,
      child_id: studentId,
      amount,
      period,
      due_date: dueDate,
    }),
  });
  if (!response.ok) throw new Error("Không thể phát hành hóa đơn.");
  const invoice = await response.json() as TuitionInvoice;
  invalidateClientQueries("payment-invoices");
  return invoice;
}

/** Giáo viên xác nhận đã thu tiền cho một hóa đơn. */
export async function confirmInvoicePaid(invoiceId: string): Promise<TuitionInvoice | null> {
  const response = await fetch("/api/payments/invoices", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoice_id: invoiceId, action: "mark_paid" }),
  });
  if (!response.ok) return null;
  invalidateClientQueries("payment-invoices");
  return { id: invoiceId, status: "paid" } as TuitionInvoice;
}

// ── Teacher settings (QR thanh toán, thông tin ngân hàng) ────────────────────

export interface TeacherSettings {
  // Nhận diện portal riêng của giáo viên
  portal_name?: string;
  portal_logo_url?: string;
  // Hồ sơ giáo viên
  full_name?: string;
  specialization?: string;  // chuyên môn / môn dạy
  email?: string;
  phone?: string;
  bio?: string;             // giới thiệu ngắn
  avatar_url?: string;      // ảnh đại diện
  // Cài đặt thanh toán
  qr_image_url?: string;    // ảnh QR đã upload HOẶC link ảnh QR/VietQR
  bank_name?: string;
  account_holder?: string;
  account_number?: string;
  payment_note?: string;    // ghi chú thêm hiển thị khi thanh toán
}

const TEACHER_SETTINGS_KEY = "tutorhub_teacher_settings_";

export async function getTeacherSettings(teacherId: string): Promise<TeacherSettings> {
  return kvGet<TeacherSettings>(`${TEACHER_SETTINGS_KEY}${teacherId}`, {});
}

export async function saveTeacherSettings(teacherId: string, settings: TeacherSettings): Promise<void> {
  const key = `${TEACHER_SETTINGS_KEY}${teacherId}`;
  kvWriteLocal(key, settings);
  const { error } = await supabase
    .from("kv_teacher_settings")
    .upsert({
      id: teacherId,
      value: settings,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
  invalidateClientQueries(`kv:kv_teacher_settings:${teacherId}`);
}

export interface StudentAccount {
  student_id: string;
  full_name: string;
  email: string;
  dob: string;
  school: string;
  grade: string;
  phone: string;
  username: string;
  avatar_url?: string;
  created_at: string;
  profile_complete?: boolean;
}

export async function getStudentAccounts(): Promise<StudentAccount[]> {
  return cachedClientQuery("student-account", async () => {
    const response = await fetch("/api/account/profile", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) return [];
    return [await response.json() as StudentAccount];
  }, 60_000);
}

export async function changeStudentPassword(
  _studentId: string,
  _currentPassword: string,
  newPassword: string
): Promise<"ok" | "wrong_password" | "not_found"> {
  try {
    const res = await fetch("/api/account/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_password: newPassword }),
    });
    if (res.ok) return "ok";
    const { error } = await res.json();
    return error === "authentication_required" ? "not_found" : "wrong_password";
  } catch {
    return "not_found";
  }
}

export async function getCurrentStudentAccount(studentId: string): Promise<StudentAccount | null> {
  // Phải tra theo studentId của phiên hiện tại — trước đây trả account thêm cuối
  // cùng nên trên máy dùng chung sẽ ra nhầm học sinh.
  const accounts = await getStudentAccounts();
  return accounts.find(a => a.student_id === studentId) ?? null;
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

/** Tất cả điểm thi đã lưu (nhập tay) — dùng cho báo cáo/thống kê. */
export async function getAllExamScores(): Promise<StoredExamScore[]> {
  return cachedClientQuery("exam-scores:all", async () => {
    const response = await fetch("/api/exam-scores?all=true", { cache: "no-store" });
    if (!response.ok) throw new Error("Không thể tải danh sách điểm thi.");
    return response.json() as Promise<StoredExamScore[]>;
  }, 30_000);
}

export async function saveExamScore(score: Omit<StoredExamScore, "id">): Promise<StoredExamScore> {
  const response = await fetch("/api/exam-scores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...score,
      student_ref: score.student_id,
    }),
  });
  if (!response.ok) throw new Error("Không thể lưu điểm thi.");
  const record = await response.json();
  invalidateClientQueries("exam-scores:");
  return { ...record, student_id: record.student_ref } as StoredExamScore;
}

export async function deleteExamScore(id: string): Promise<void> {
  const response = await fetch(`/api/exam-scores/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Không thể xóa điểm thi.");
  invalidateClientQueries("exam-scores:");
}

export async function updateExamScore(
  id: string,
  score: Omit<StoredExamScore, "id" | "student_id">,
): Promise<StoredExamScore> {
  const response = await fetch(`/api/exam-scores/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(score),
  });
  if (!response.ok) throw new Error("Không thể cập nhật điểm thi.");
  const saved = await response.json() as StoredExamScore;
  invalidateClientQueries("exam-scores:");
  return saved;
}

export async function getExamScoresByStudent(studentId: string): Promise<StoredExamScore[]> {
  return cachedClientQuery(`exam-scores:student:${studentId}`, async () => {
    const response = await fetch(
      `/api/exam-scores?student_ref=${encodeURIComponent(studentId)}`,
      { cache: "no-store" },
    );
    if (!response.ok) return [];
    return response.json() as Promise<StoredExamScore[]>;
  }, 30_000);
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

export async function getClassMaterials(classId: string): Promise<StoredClassMaterial[]> {
  return cachedClientQuery(`class-materials:${classId}`, async () => {
    const { data, error } = await supabase
      .from("class_materials")
      .select("*")
      .eq("class_id", classId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("getClassMaterials:", error);
      return [];
    }
    return (data ?? []) as StoredClassMaterial[];
  }, 60_000);
}

export async function saveClassMaterial(mat: Omit<StoredClassMaterial, "id" | "download_count">): Promise<StoredClassMaterial> {
  const record: StoredClassMaterial = { ...mat, id: `mat_${crypto.randomUUID()}`, download_count: 0 };
  const { error } = await supabase.from("class_materials").insert(record);
  if (error) {
    console.error("saveClassMaterial:", error);
    throw error;
  }
  invalidateClientQueries(`class-materials:${mat.class_id}`);
  return record;
}

export async function deleteClassMaterial(materialId: string): Promise<void> {
  const { error } = await supabase.from("class_materials").delete().eq("id", materialId);
  if (error) {
    console.error("deleteClassMaterial:", error);
    throw error;
  }
  invalidateClientQueries("class-materials:");
}

export async function incrementMaterialDownload(materialId: string): Promise<void> {
  const response = await fetch(
    `/api/class-materials/${encodeURIComponent(materialId)}/download`,
    { method: "POST" },
  );
  if (!response.ok) throw new Error("Không thể ghi nhận lượt tải.");
}

// ── Homework file attachments (localStorage) ──────────────────────────────────

export interface HomeworkAttachment {
  homework_id: string;
  class_id: string;
  file_url: string;
  file_name: string;
  file_size: string;
  file_type: string;
}

export async function getHomeworkAttachments(homeworkId: string): Promise<HomeworkAttachment[]> {
  const { data, error } = await supabase
    .from("homework_attachments")
    .select("*")
    .eq("homework_id", homeworkId);
  if (error) {
    console.error("getHomeworkAttachments:", error);
    return [];
  }
  return (data ?? []) as HomeworkAttachment[];
}

export async function saveHomeworkAttachment(att: HomeworkAttachment): Promise<void> {
  const { error } = await supabase
    .from("homework_attachments")
    .insert({ id: `att_${crypto.randomUUID()}`, ...att });
  if (error) {
    console.error("saveHomeworkAttachment:", error);
    throw error;
  }
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

export interface TuitionDiscount {
  type: "amount" | "percent";  // giảm theo số tiền hoặc theo %
  value: number;               // VND (amount) hoặc 0..100 (percent)
}

export interface StudentTuitionData {
  custom_fee?: number;       // Monthly fee override; uses class default if absent
  payments: TuitionPaymentRecord[];
  notes?: string;
  next_due_date?: string;    // YYYY-MM-DD
  // Học phí theo buổi: ghi đè số buổi tính phí + giảm giá, theo từng kỳ "YYYY-MM"
  session_overrides?: Record<string, number>;
  discounts?: Record<string, TuitionDiscount>;
}

export interface PackagePrices { online: number; advanced: number; offline: number; }

/**
 * Cách tính học phí của lớp:
 *  - "session": đơn giá/buổi × số buổi thực đi (từ điểm danh, sửa tay được)
 *  - "month"  : trọn gói theo tháng, không phụ thuộc số buổi
 */
export type TuitionBillingMode = "session" | "month";

export interface ClassTuitionConfig {
  package_fees: {
    online: number;
    advanced: number;
    offline: number;
  };
  unit_price?: number;       // (Cũ) đơn giá/buổi toàn cục — chỉ dùng làm fallback lịch sử
  // Đơn giá/buổi theo GÓI, lưu SNAPSHOT theo từng kỳ "YYYY-MM" để đổi giá tháng
  // này KHÔNG làm thay đổi các tháng đã qua.
  unit_prices?: Record<string, PackagePrices>;
  // Mặc định "session" khi thiếu, để mọi lớp đã cấu hình trước đây giữ nguyên cách tính.
  billing_mode?: TuitionBillingMode;
  // Giá trọn gói/tháng theo gói — cũng snapshot theo kỳ như unit_prices.
  monthly_prices?: Record<string, PackagePrices>;
  students: Record<string, StudentTuitionData>;
}

const DEFAULT_TUITION: ClassTuitionConfig = {
  package_fees: { online: 0, advanced: 0, offline: 0 },
  students: {},
};

function tuitionKey(classId: string) { return `tutorhub_tuition_${classId}`; }

function normalizeTuitionConfig(
  parsed: ClassTuitionConfig & { default_fee?: number },
): ClassTuitionConfig {
  if (typeof parsed.default_fee === "number" && !parsed.package_fees) {
    return {
      package_fees: {
        online: parsed.default_fee,
        advanced: parsed.default_fee,
        offline: parsed.default_fee,
      },
      students: parsed.students ?? {},
    };
  }
  return {
    ...parsed,
    package_fees: parsed.package_fees ?? { ...DEFAULT_TUITION.package_fees },
    students: parsed.students ?? {},
  };
}

export async function getClassTuition(classId: string): Promise<ClassTuitionConfig> {
  const parsed = await kvGet<ClassTuitionConfig & { default_fee?: number }>(tuitionKey(classId), DEFAULT_TUITION);
  return normalizeTuitionConfig(parsed);
}

export async function getClassTuitions(
  classIds: string[],
): Promise<Record<string, ClassTuitionConfig>> {
  if (classIds.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from("kv_tuition")
      .select("id,value")
      .in("id", classIds);
    if (!error) {
      const byClass: Record<string, ClassTuitionConfig> = {};
      for (const classId of classIds) {
        byClass[classId] = { ...DEFAULT_TUITION, students: {} };
      }
      for (const row of data ?? []) {
        const value = normalizeTuitionConfig(
          row.value as ClassTuitionConfig & { default_fee?: number },
        );
        byClass[row.id] = value;
        kvWriteLocal(tuitionKey(row.id), value);
      }
      return byClass;
    }
  } catch {
    // Offline: use the existing cache-aware record loader below.
  }
  const entries = await Promise.all(
    classIds.map(async classId => [classId, await getClassTuition(classId)] as const),
  );
  return Object.fromEntries(entries);
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
  const invoice = (await getInvoices()).find(
    (item) =>
      item.class_id === classId &&
      item.child_id === studentId &&
      item.period === payment.period &&
      item.status !== "paid",
  );
  if (invoice && totalForPeriod >= invoice.amount) {
    await confirmInvoicePaid(invoice.id);
  }
}

/**
 * Xóa học viên khỏi lớp qua API nguyên tử: sĩ số, gói học, dữ liệu học phí và
 * yêu cầu đã duyệt đều được đóng để học viên có thể đăng ký lại sau này.
 */
export async function removeStudentFromClass(classId: string, studentId: string): Promise<void> {
  const response = await fetch(
    `/api/teacher/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}`,
    {
      method: "DELETE",
      credentials: "same-origin",
    },
  );
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error ?? "student_remove_failed");
  }
  invalidateClientQueries("entity:classes", "student-packages:", "class-tuition:");
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

// Per-row Supabase table `course_reviews` (RLS-scoped). Reads run under the
// signed-in user's JWT; RLS makes ratings publicly readable and limits writes
// to the authoring student.
export async function getCourseReviews(courseId: string): Promise<CourseReview[]> {
  const { data, error } = await supabase
    .from("course_reviews")
    .select("*")
    .eq("course_id", courseId);
  if (error) {
    console.error("getCourseReviews:", error);
    return [];
  }
  return (data ?? []) as CourseReview[];
}

export async function submitCourseReview(review: Omit<CourseReview, "id">): Promise<CourseReview> {
  // One review per student per course — upsert on (course_id, student_id).
  const { data: existing } = await supabase
    .from("course_reviews")
    .select("id")
    .eq("course_id", review.course_id)
    .eq("student_id", review.student_id)
    .maybeSingle();
  const record: CourseReview = { ...review, id: existing?.id ?? crypto.randomUUID() };
  const { error } = await supabase
    .from("course_reviews")
    .upsert(record, { onConflict: "course_id,student_id" });
  if (error) {
    console.error("submitCourseReview:", error);
    throw error;
  }
  return record;
}

export async function deleteReview(reviewId: string): Promise<void> {
  const { error } = await supabase.from("course_reviews").delete().eq("id", reviewId);
  if (error) {
    console.error("deleteReview:", error);
    throw error;
  }
}

export async function getCourseRating(courseId: string): Promise<{ rating: number; reviewCount: number }> {
  const reviews = await getCourseReviews(courseId);
  if (reviews.length === 0) return { rating: 0, reviewCount: 0 };
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  return { rating: Math.round(avg * 10) / 10, reviewCount: reviews.length };
}
