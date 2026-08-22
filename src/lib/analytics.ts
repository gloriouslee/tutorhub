// ── Analytics / reporting aggregations ────────────────────────────────────────
// Tổng hợp dữ liệu cho trang Báo cáo (admin) và Xu hướng (giáo viên).
// Tất cả hàm aggregation đều thuần (pure) để dễ test và tái dùng cho cả 2 view;
// view giáo viên truyền `classIds` để lọc về đúng lớp mình dạy.

import type { TuitionInvoice, StoredExamScore } from "@/lib/storage";
import { isAttendedStatus } from "@/lib/attendance";
import type { Class, Student, Teacher, Attendance } from "@/types";

const MONTHS_VI = ["Th.1", "Th.2", "Th.3", "Th.4", "Th.5", "Th.6", "Th.7", "Th.8", "Th.9", "Th.10", "Th.11", "Th.12"];

// Bảng màu ổn định cho các series khi entity không có màu riêng
const PALETTE = ["#6366f1", "#f59e0b", "#10b981", "#ec4899", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6", "#eab308", "#f97316"];
export function seriesColor(i: number): string { return PALETTE[i % PALETTE.length]; }

export interface RevenueEvent {
  amount: number;
  date: string;            // ISO hoặc YYYY-MM-DD
  classId?: string;
  studentId?: string;
  teacherId?: string;
  source: "tuition" | "invoice";
}

export interface AnalyticsData {
  classes: Class[];
  students: Student[];
  teachers: Teacher[];
  invoices: TuitionInvoice[];
  attendance: Attendance[];
  examScores: StoredExamScore[];
  revenueEvents: RevenueEvent[];
  teacherOf: Record<string, string | undefined>;  // classId -> teacherId (đã áp override)
  loadedAt: string;
}

const ANALYTICS_CACHE_TTL_MS = 2 * 60 * 1000;
let analyticsCache: { data: AnalyticsData; expiresAt: number } | null = null;
let analyticsRequest: Promise<AnalyticsData> | null = null;

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
async function fetchAnalyticsData(): Promise<AnalyticsData> {
  const {
    getClasses,
    getStudents,
    getTeachers,
    getInvoicesRaw,
    getAllTeacherAttendance,
    getClassTuitions,
    getClassTeacherOverrides,
    getAllExamScores,
  } = await import("@/lib/storage");
  // Học phí chỉ phụ thuộc danh sách lớp. Khởi chạy ngay khi lớp tải xong thay vì
  // đợi toàn bộ các nguồn khác, nhờ vậy không tạo waterfall ở cuối màn hình.
  const classesRequest = getClasses();
  const tuitionRequest = classesRequest.then(classes => getClassTuitions(classes.map(c => c.id)));
  const [classes, students, teachers, invoices, teacherAtt, overrides, storedScores, tuitionConfigs] = await Promise.all([
    classesRequest,
    getStudents(),
    getTeachers(),
    getInvoicesRaw(),
    getAllTeacherAttendance(),
    getClassTeacherOverrides(),
    getAllExamScores().catch(() => [] as StoredExamScore[]),
    tuitionRequest,
  ]);

  // Điểm danh thật (giáo viên nhập) → chuẩn hoá về shape Attendance để tái dùng aggregation
  const attendance = teacherAtt.map(r => ({
    class_id: r.class_id, student_id: r.student_id, attendance_date: r.date, status: r.status,
  })) as unknown as Attendance[];

  const teacherOf: Record<string, string | undefined> = {};
  for (const c of classes) teacherOf[c.id] = overrides[c.id] ?? c.tutor_id;

  const firstClassOf = (studentId: string): string | undefined =>
    classes.find(c => (c.student_ids ?? []).includes(studentId))?.id;

  // Điểm thi: chỉ dùng dữ liệu đã lưu.
  const examScores = storedScores;

  // ── Sự kiện doanh thu (gộp 3 nguồn tiền) ─────────────────────────────────────
  const revenueEvents: RevenueEvent[] = [];

  // 1) Học phí do giáo viên ghi nhận (chính xác nhất: có classId + studentId)
  const tuitionKeys = new Set<string>();  // classId|studentId|period đã ghi nhận
  for (const [classId, config] of Object.entries(tuitionConfigs)) {
    for (const [sid, sdata] of Object.entries(config.students)) {
      for (const p of sdata.payments ?? []) {
        revenueEvents.push({ amount: p.amount, date: p.paid_at, classId, studentId: sid, teacherId: teacherOf[classId], source: "tuition" });
        tuitionKeys.add(`${classId}|${sid}|${p.period}`);
      }
    }
  }

  // 2) Hoá đơn đã thanh toán (có class_id thì chính xác, không thì gán lớp đầu tiên của HV).
  //    Chống ĐẾM TRÙNG: recordTuitionPayment vừa lưu học phí vừa gạch nợ hoá đơn cùng
  //    lớp+HV+kỳ → nếu đã có khoản học phí tương ứng thì bỏ qua hoá đơn (cùng một tiền).
  for (const inv of invoices as TuitionInvoice[]) {
    if (inv.status !== "paid") continue;
    const classId = inv.class_id ?? firstClassOf(inv.child_id);
    if (classId && inv.period && tuitionKeys.has(`${classId}|${inv.child_id}|${inv.period}`)) continue;
    revenueEvents.push({
      amount: inv.amount,
      date: inv.paid_at ?? inv.due_date,
      classId,
      studentId: inv.child_id,
      teacherId: classId ? teacherOf[classId] : undefined,
      source: "invoice",
    });
  }

  return {
    classes,
    students,
    teachers,
    invoices,
    attendance,
    examScores,
    revenueEvents,
    teacherOf,
    loadedAt: new Date().toISOString(),
  };
}

/** Cache ngắn hạn dùng chung giữa các lần điều hướng trong portal. */
export async function loadAnalyticsData(options: { force?: boolean } = {}): Promise<AnalyticsData> {
  if (!options.force && analyticsCache && analyticsCache.expiresAt > Date.now()) {
    return analyticsCache.data;
  }
  if (!options.force && analyticsRequest) return analyticsRequest;

  const request = fetchAnalyticsData()
    .then(data => {
      analyticsCache = { data, expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS };
      return data;
    })
    .finally(() => {
      if (analyticsRequest === request) analyticsRequest = null;
    });
  analyticsRequest = request;
  return request;
}

// ── Lọc dữ liệu theo khoảng thời gian (N tháng gần nhất) ────────────────────────
// Trả về AnalyticsData MỚI với revenue/attendance/exam đã lọc theo ngày, để KPI và
// biểu đồ luôn nhất quán trong cùng khoảng. months=undefined/0 = toàn thời gian.
export function filterByMonths(data: AnalyticsData, months?: number): AnalyticsData {
  if (!months) return data;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const inRange = (d?: string) => !!d && parseLocalDate(d) >= start;
  return {
    ...data,
    revenueEvents: data.revenueEvents.filter(e => inRange(e.date)),
    attendance: data.attendance.filter(a => inRange(a.attendance_date)),
    examScores: data.examScores.filter(s => inRange(s.exam_date)),
  };
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
  avgAttendancePct: number;   // present+online+late trên tổng
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

  // Nghỉ có phép không phản ánh việc tham gia hay vắng mặt, nên không đưa vào
  // mẫu số. Quy tắc này cũng thống nhất với Student workspace.
  const att = data.attendance.filter(a => inClass(a.class_id) && a.status !== "excused");
  const present = att.filter(a => isAttendedStatus(a.status)).length;
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
      if (a.status === "excused") return false;
      const d = parseLocalDate(a.attendance_date);
      return d.getFullYear() === b.year && d.getMonth() === b.month;
    });
    const pct = (n: number) => (recs.length > 0 ? Math.round((n / recs.length) * 100) : 0);
    return {
      month: b.label,
      coMat: pct(recs.filter(a => isAttendedStatus(a.status)).length),
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
    if (a.status === "excused") continue;
    const cur = agg.get(a.class_id) ?? { ok: 0, n: 0 };
    if (isAttendedStatus(a.status)) cur.ok += 1;
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
  const studentNames = new Map(data.students.map(student => [student.id, student.full_name]));
  return [...agg.entries()]
    .map(([sid, a]) => ({
      name: studentNames.get(sid) ?? sid,
      diem: +(a.sum / a.n).toFixed(1),
      soBai: a.n,
    }))
    .sort((a, b) => b.diem - a.diem)
    .slice(0, limit);
}

export interface AttentionItem {
  studentId: string;
  studentName: string;
  className: string;
  severity: "high" | "medium";
  reasons: string[];
  attendanceRate: number | null;
  averageScore: number | null;
}

/** Danh sách ưu tiên có giải thích, không gắn nhãn học viên bằng một điểm rủi ro mơ hồ. */
export function teacherAttentionItems(
  data: AnalyticsData,
  classIds?: Set<string>,
  limit = 8,
): AttentionItem[] {
  const studentNames = new Map(data.students.map(student => [student.id, student.full_name]));
  const classNames = new Map(data.classes.map(cls => [cls.id, cls.class_name]));
  const studentClass = new Map<string, string>();
  for (const cls of data.classes) {
    if (classIds && !classIds.has(cls.id)) continue;
    for (const studentId of cls.student_ids ?? []) {
      if (!studentClass.has(studentId)) studentClass.set(studentId, cls.id);
    }
  }

  const attendance = new Map<string, { attended: number; total: number; absent: number; late: number }>();
  for (const record of data.attendance) {
    if ((classIds && !classIds.has(record.class_id)) || record.status === "excused") continue;
    const current = attendance.get(record.student_id) ?? { attended: 0, total: 0, absent: 0, late: 0 };
    current.total += 1;
    if (isAttendedStatus(record.status)) current.attended += 1;
    if (record.status === "absent") current.absent += 1;
    if (record.status === "late") current.late += 1;
    attendance.set(record.student_id, current);
  }

  const scores = new Map<string, StoredExamScore[]>();
  for (const score of data.examScores) {
    if (classIds && !classIds.has(score.class_id)) continue;
    const list = scores.get(score.student_id) ?? [];
    list.push(score);
    scores.set(score.student_id, list);
  }

  const items: AttentionItem[] = [];
  for (const [studentId, classId] of studentClass) {
    const att = attendance.get(studentId);
    const studentScores = (scores.get(studentId) ?? []).toSorted((a, b) => a.exam_date.localeCompare(b.exam_date));
    const normalizedScores = studentScores.map(score => score.max_score > 0 ? (score.score / score.max_score) * 10 : 0);
    const attendanceRate = att?.total ? Math.round((att.attended / att.total) * 100) : null;
    const averageScore = normalizedScores.length
      ? +(normalizedScores.reduce((sum, score) => sum + score, 0) / normalizedScores.length).toFixed(1)
      : null;
    const reasons: string[] = [];

    if (att && att.absent >= 2) reasons.push(`Vắng ${att.absent} buổi`);
    else if (attendanceRate !== null && att && att.total >= 3 && attendanceRate < 80) reasons.push(`Chuyên cần ${attendanceRate}%`);
    if (att && att.late >= 2) reasons.push(`Đi trễ ${att.late} buổi`);
    if (averageScore !== null && normalizedScores.length >= 2 && averageScore < 5) reasons.push(`Điểm trung bình ${averageScore}/10`);

    if (normalizedScores.length >= 4) {
      const recent = normalizedScores.slice(-2).reduce((sum, score) => sum + score, 0) / 2;
      const previous = normalizedScores.slice(-4, -2).reduce((sum, score) => sum + score, 0) / 2;
      const drop = previous - recent;
      if (drop >= 1) reasons.push(`Giảm ${drop.toFixed(1)} điểm gần đây`);
    }

    if (reasons.length === 0) continue;
    const severity: AttentionItem["severity"] =
      (att?.absent ?? 0) >= 3 || (averageScore !== null && averageScore < 4) || reasons.some(reason => reason.startsWith("Giảm"))
        ? "high"
        : "medium";
    items.push({
      studentId,
      studentName: studentNames.get(studentId) ?? "Học viên",
      className: classNames.get(classId) ?? "Lớp học",
      severity,
      reasons,
      attendanceRate,
      averageScore,
    });
  }

  return items
    .toSorted((a, b) => Number(b.severity === "high") - Number(a.severity === "high") || b.reasons.length - a.reasons.length)
    .slice(0, limit);
}

export interface MetricDelta {
  current: number;
  previous: number;
  delta: number;
  hasData: boolean;
}

/** So sánh khoảng hiện tại với khoảng ngay trước đó, cùng độ dài. */
export function analyticsDeltas(data: AnalyticsData, months: number, classIds?: Set<string>) {
  const now = new Date();
  const currentStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - (months * 2 - 1), 1);
  const inClass = classFilter(classIds);
  const period = <T,>(records: T[], dateOf: (record: T) => string, start: Date, end?: Date) => records.filter(record => {
    const date = parseLocalDate(dateOf(record));
    return date >= start && (!end || date < end);
  });
  const metric = (current: number, previous: number, hasData: boolean): MetricDelta => ({
    current,
    previous,
    delta: +(current - previous).toFixed(1),
    hasData,
  });

  const attendanceRateFor = (records: Attendance[]) => {
    const eligible = records.filter(record => record.status !== "excused");
    return eligible.length ? Math.round((eligible.filter(record => isAttendedStatus(record.status)).length / eligible.length) * 100) : 0;
  };
  const scoreAverageFor = (records: StoredExamScore[]) => records.length
    ? +(records.reduce((sum, record) => sum + (record.max_score > 0 ? (record.score / record.max_score) * 10 : 0), 0) / records.length).toFixed(1)
    : 0;

  const scopedAttendance = data.attendance.filter(record => inClass(record.class_id));
  const scopedScores = data.examScores.filter(record => inClass(record.class_id));
  const scopedRevenue = data.revenueEvents.filter(record => inClass(record.classId));
  const currentAttendance = period(scopedAttendance, record => record.attendance_date, currentStart);
  const previousAttendance = period(scopedAttendance, record => record.attendance_date, previousStart, currentStart);
  const currentScores = period(scopedScores, record => record.exam_date, currentStart);
  const previousScores = period(scopedScores, record => record.exam_date, previousStart, currentStart);
  const currentRevenue = period(scopedRevenue, record => record.date, currentStart);
  const previousRevenue = period(scopedRevenue, record => record.date, previousStart, currentStart);

  return {
    attendance: metric(attendanceRateFor(currentAttendance), attendanceRateFor(previousAttendance), currentAttendance.length > 0),
    score: metric(scoreAverageFor(currentScores), scoreAverageFor(previousScores), currentScores.length > 0),
    revenue: metric(
      currentRevenue.reduce((sum, record) => sum + record.amount, 0),
      previousRevenue.reduce((sum, record) => sum + record.amount, 0),
      currentRevenue.length > 0,
    ),
  };
}
