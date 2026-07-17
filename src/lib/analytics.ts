// ── Analytics / reporting aggregations ────────────────────────────────────────
// Tổng hợp dữ liệu cho trang Báo cáo (admin) và Xu hướng (giáo viên).
// Tất cả hàm aggregation đều thuần (pure) để dễ test và tái dùng cho cả 2 view;
// view giáo viên truyền `classIds` để lọc về đúng lớp mình dạy.

import {
  getClasses, getStudents, getTeachers, getInvoicesRaw,
  getAllTeacherAttendance, getClassTuition, getClassTeacherOverrides, getAllExamScores,
  type TuitionInvoice, type StoredExamScore,
} from "@/lib/storage";
import type { Class, Student, Teacher, Attendance } from "@/types";

const MONTHS_VI = ["Th.1", "Th.2", "Th.3", "Th.4", "Th.5", "Th.6", "Th.7", "Th.8", "Th.9", "Th.10", "Th.11", "Th.12"];

// Bảng màu ổn định cho các series khi entity không có màu riêng
const PALETTE = ["#6366f1", "#f59e0b", "#10b981", "#ec4899", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6", "#eab308", "#f97316"];
export function seriesColor(i: number): string { return PALETTE[i % PALETTE.length]; }

export interface RevenueEvent {
  amount: number;
  date: string;            // ISO hoặc YYYY-MM-DD
  classId?: string;
  teacherId?: string;
  source: "tuition" | "invoice";
}

export interface AnalyticsData {
  classes: Class[];
  students: Student[];
  teachers: Teacher[];
  attendance: Attendance[];
  examScores: StoredExamScore[];
  revenueEvents: RevenueEvent[];
  teacherOf: Record<string, string | undefined>;  // classId -> teacherId (đã áp override)
}

function parseLocalDate(d: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d);
}

function monthKey(d: Date): string { return `${d.getFullYear()}-${d.getMonth()}`; }

/** Danh sách N tháng gần nhất (gồm tháng hiện tại). */
export function lastNMonths(n: number, now = new Date()): { year: number; month: number; label: string; key: string }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth(), label: MONTHS_VI[d.getMonth()], key: `${d.getFullYear()}-${d.getMonth()}` };
  });
}

// ── Nạp toàn bộ dữ liệu thô ────────────────────────────────────────────────────
export async function loadAnalyticsData(): Promise<AnalyticsData> {
  const [classes, students, teachers, invoices, teacherAtt, overrides, storedScores] = await Promise.all([
    getClasses(),
    getStudents(),
    getTeachers(),
    getInvoicesRaw(),
    getAllTeacherAttendance(),
    getClassTeacherOverrides(),
    getAllExamScores().catch(() => [] as StoredExamScore[]),
  ]);

  // Điểm danh thật (giáo viên nhập) → chuẩn hoá về shape Attendance để tái dùng aggregation
  const attendance = teacherAtt.map(r => ({
    class_id: r.class_id, student_id: r.student_id, attendance_date: r.date, status: r.status,
  })) as unknown as Attendance[];

  const teacherOf: Record<string, string | undefined> = {};
  for (const c of classes) teacherOf[c.id] = overrides[c.id] ?? c.tutor_id;

  const firstClassOf = (studentId: string): string | undefined =>
    classes.find(c => (c.student_ids ?? []).includes(studentId))?.id;

  // Điểm thi: chỉ dùng dữ liệu thật đã lưu (không trộn mock)
  const examScores = storedScores;

  // ── Sự kiện doanh thu (gộp 3 nguồn tiền) ─────────────────────────────────────
  const revenueEvents: RevenueEvent[] = [];

  // 1) Học phí do giáo viên ghi nhận (chính xác nhất: có classId + studentId)
  const tuitionConfigs = await Promise.all(classes.map(c => getClassTuition(c.id).then(cfg => ({ classId: c.id, cfg })).catch(() => null)));
  for (const item of tuitionConfigs) {
    if (!item) continue;
    for (const sdata of Object.values(item.cfg.students)) {
      for (const p of sdata.payments ?? []) {
        revenueEvents.push({ amount: p.amount, date: p.paid_at, classId: item.classId, teacherId: teacherOf[item.classId], source: "tuition" });
      }
    }
  }

  // 2) Hoá đơn đã thanh toán (có class_id thì chính xác, không thì gán lớp đầu tiên của HV)
  for (const inv of invoices as TuitionInvoice[]) {
    if (inv.status !== "paid") continue;
    const classId = inv.class_id ?? firstClassOf(inv.child_id);
    revenueEvents.push({
      amount: inv.amount,
      date: inv.paid_at ?? inv.due_date,
      classId,
      teacherId: classId ? teacherOf[classId] : undefined,
      source: "invoice",
    });
  }

  return { classes, students, teachers, attendance, examScores, revenueEvents, teacherOf };
}

// ── Helpers lọc theo tập lớp (dùng cho view giáo viên) ──────────────────────────
function classFilter(classIds?: Set<string>) {
  return (id: string | undefined) => !classIds || (id != null && classIds.has(id));
}

/** Tập student_id thuộc các lớp cho trước (union). */
export function studentIdsOfClasses(data: AnalyticsData, classIds?: Set<string>): Set<string> {
  const ids = new Set<string>();
  for (const c of data.classes) {
    if (classIds && !classIds.has(c.id)) continue;
    for (const sid of c.student_ids ?? []) ids.add(sid);
  }
  return ids;
}

// ── KPIs ────────────────────────────────────────────────────────────────────
export interface Kpis {
  totalRevenue: number;
  studentCount: number;
  classCount: number;
  teacherCount: number;
  avgAttendancePct: number;   // present+late trên tổng
  avgScore: number;           // thang 10
}

export function computeKpis(data: AnalyticsData, classIds?: Set<string>): Kpis {
  const inClass = classFilter(classIds);
  const revenue = data.revenueEvents.filter(e => inClass(e.classId)).reduce((s, e) => s + e.amount, 0);

  const studentIds = studentIdsOfClasses(data, classIds);
  const studentCount = classIds ? studentIds.size : data.students.length;
  const classCount = classIds ? classIds.size : data.classes.length;
  const teacherCount = classIds
    ? new Set(data.classes.filter(c => classIds.has(c.id)).map(c => data.teacherOf[c.id]).filter(Boolean)).size
    : data.teachers.length;

  const att = data.attendance.filter(a => inClass(a.class_id));
  const present = att.filter(a => a.status === "present" || a.status === "late").length;
  const avgAttendancePct = att.length > 0 ? Math.round((present / att.length) * 100) : 0;

  const scores = data.examScores.filter(s => inClass(s.class_id));
  const avgScore = scores.length > 0
    ? +(scores.reduce((s, e) => s + (e.score / e.max_score) * 10, 0) / scores.length).toFixed(1)
    : 0;

  return { totalRevenue: revenue, studentCount, classCount, teacherCount, avgAttendancePct, avgScore };
}

// ── Doanh thu theo giáo viên ─────────────────────────────────────────────────
export function revenueByTeacher(data: AnalyticsData, classIds?: Set<string>): { name: string; value: number; color: string }[] {
  const inClass = classFilter(classIds);
  const totals = new Map<string, number>();
  for (const e of data.revenueEvents) {
    if (!inClass(e.classId) || !e.teacherId) continue;
    totals.set(e.teacherId, (totals.get(e.teacherId) ?? 0) + e.amount);
  }
  return data.teachers
    .filter(t => totals.has(t.id))
    .map((t, i) => ({ name: t.full_name, value: totals.get(t.id) ?? 0, color: seriesColor(i) }))
    .sort((a, b) => b.value - a.value);
}

// ── Doanh thu theo lớp ───────────────────────────────────────────────────────
export function revenueByClass(data: AnalyticsData, classIds?: Set<string>): { name: string; value: number; color: string }[] {
  const inClass = classFilter(classIds);
  const totals = new Map<string, number>();
  for (const e of data.revenueEvents) {
    if (!e.classId || !inClass(e.classId)) continue;
    totals.set(e.classId, (totals.get(e.classId) ?? 0) + e.amount);
  }
  return data.classes
    .filter(c => totals.has(c.id))
    .map(c => ({ name: c.class_name, value: totals.get(c.id) ?? 0, color: c.color ?? "#6366f1" }))
    .sort((a, b) => b.value - a.value);
}

// ── Xu hướng doanh thu theo tháng ────────────────────────────────────────────
export function revenueTrend(data: AnalyticsData, months: number, classIds?: Set<string>): { month: string; doanhThu: number }[] {
  const inClass = classFilter(classIds);
  const buckets = lastNMonths(months);
  const byKey = new Map<string, number>();
  for (const e of data.revenueEvents) {
    if (!inClass(e.classId)) continue;
    const k = monthKey(parseLocalDate(e.date));
    byKey.set(k, (byKey.get(k) ?? 0) + e.amount);
  }
  return buckets.map(b => ({ month: b.label, doanhThu: byKey.get(b.key) ?? 0 }));
}

// ── Tăng trưởng học viên (luỹ kế + mới theo tháng) ───────────────────────────
export function studentGrowth(data: AnalyticsData, months: number, classIds?: Set<string>): { month: string; moi: number; luyKe: number }[] {
  const pool = classIds
    ? data.students.filter(s => studentIdsOfClasses(data, classIds).has(s.id))
    : data.students;
  const buckets = lastNMonths(months);
  const newByKey = new Map<string, number>();
  for (const s of pool) {
    if (!s.created_at) continue;
    const k = monthKey(parseLocalDate(s.created_at));
    newByKey.set(k, (newByKey.get(k) ?? 0) + 1);
  }
  // luỹ kế: số HV được tạo trước hoặc trong tháng đó
  const firstBucketStart = new Date(buckets[0].year, buckets[0].month, 1);
  let baseline = pool.filter(s => s.created_at && parseLocalDate(s.created_at) < firstBucketStart).length;
  return buckets.map(b => {
    const moi = newByKey.get(b.key) ?? 0;
    baseline += moi;
    return { month: b.label, moi, luyKe: baseline };
  });
}

// ── Sĩ số theo lớp ───────────────────────────────────────────────────────────
export function enrollmentByClass(data: AnalyticsData, classIds?: Set<string>): { name: string; value: number; color: string }[] {
  return data.classes
    .filter(c => !classIds || classIds.has(c.id))
    .map(c => ({ name: c.class_name, value: (c.student_ids ?? []).length, color: c.color ?? "#6366f1" }))
    .sort((a, b) => b.value - a.value);
}

// ── Điểm trung bình theo lớp (thang 10) ──────────────────────────────────────
export function examPerfByClass(data: AnalyticsData, classIds?: Set<string>): { name: string; diem: number; color: string }[] {
  const inClass = classFilter(classIds);
  const agg = new Map<string, { sum: number; n: number }>();
  for (const s of data.examScores) {
    if (!inClass(s.class_id)) continue;
    const cur = agg.get(s.class_id) ?? { sum: 0, n: 0 };
    cur.sum += (s.score / s.max_score) * 10;
    cur.n += 1;
    agg.set(s.class_id, cur);
  }
  return data.classes
    .filter(c => agg.has(c.id))
    .map(c => {
      const a = agg.get(c.id)!;
      return { name: c.class_name, diem: +(a.sum / a.n).toFixed(1), color: c.color ?? "#6366f1" };
    })
    .sort((a, b) => b.diem - a.diem);
}

// ── Xu hướng điểm danh theo tháng (%) ────────────────────────────────────────
export function attendanceTrend(data: AnalyticsData, months: number, classIds?: Set<string>): { month: string; coMat: number; treGio: number; vangMat: number }[] {
  const inClass = classFilter(classIds);
  const buckets = lastNMonths(months);
  return buckets.map(b => {
    const recs = data.attendance.filter(a => {
      if (!inClass(a.class_id)) return false;
      const d = parseLocalDate(a.attendance_date);
      return d.getFullYear() === b.year && d.getMonth() === b.month;
    });
    const pct = (n: number) => (recs.length > 0 ? Math.round((n / recs.length) * 100) : 0);
    return {
      month: b.label,
      coMat: pct(recs.filter(a => a.status === "present" || a.status === "late").length),
      treGio: pct(recs.filter(a => a.status === "late").length),
      vangMat: pct(recs.filter(a => a.status === "absent").length),
    };
  });
}

// ── Tỉ lệ chuyên cần theo lớp (%) ────────────────────────────────────────────
export function attendanceByClass(data: AnalyticsData, classIds?: Set<string>): { name: string; rate: number; color: string }[] {
  const agg = new Map<string, { ok: number; n: number }>();
  for (const a of data.attendance) {
    if (classIds && !classIds.has(a.class_id)) continue;
    const cur = agg.get(a.class_id) ?? { ok: 0, n: 0 };
    if (a.status === "present" || a.status === "late") cur.ok += 1;
    cur.n += 1;
    agg.set(a.class_id, cur);
  }
  return data.classes
    .filter(c => agg.has(c.id))
    .map(c => {
      const a = agg.get(c.id)!;
      return { name: c.class_name, rate: a.n > 0 ? Math.round((a.ok / a.n) * 100) : 0, color: c.color ?? "#6366f1" };
    })
    .sort((a, b) => b.rate - a.rate);
}

// ── Phân bố hình thức học ─────────────────────────────────────────────────────
export function learningModeDist(data: AnalyticsData, classIds?: Set<string>): { name: string; value: number; color: string }[] {
  const pool = classIds
    ? data.students.filter(s => studentIdsOfClasses(data, classIds).has(s.id))
    : data.students;
  const count = (mode: string) => pool.filter(s => s.learning_type === mode).length;
  return [
    { name: "Trực tuyến", value: count("online"), color: "#3b82f6" },
    { name: "Tại lớp", value: count("offline"), color: "#8b5cf6" },
    { name: "Kết hợp", value: count("hybrid"), color: "#14b8a6" },
  ].filter(d => d.value > 0);
}

// ── Top học viên theo điểm TB (thang 10) ─────────────────────────────────────
export function topStudents(data: AnalyticsData, limit: number, classIds?: Set<string>): { name: string; diem: number; soBai: number }[] {
  const inClass = classFilter(classIds);
  const agg = new Map<string, { sum: number; n: number }>();
  for (const s of data.examScores) {
    if (!inClass(s.class_id)) continue;
    const cur = agg.get(s.student_id) ?? { sum: 0, n: 0 };
    cur.sum += (s.score / s.max_score) * 10;
    cur.n += 1;
    agg.set(s.student_id, cur);
  }
  return [...agg.entries()]
    .map(([sid, a]) => ({
      name: data.students.find(s => s.id === sid)?.full_name ?? sid,
      diem: +(a.sum / a.n).toFixed(1),
      soBai: a.n,
    }))
    .sort((a, b) => b.diem - a.diem)
    .slice(0, limit);
}
