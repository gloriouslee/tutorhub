"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Nguồn dữ liệu THẬT cho parent portal — đọc từ chính các kho mà giáo viên ghi:
//   - Điểm danh:  kv "tutorhub_teacher_attendance" (trang điểm danh giáo viên)
//   - Bài tập:    kv "tutorhub_teacher_homework"
//   - Điểm thi:   kv "tutorhub_exam_scores" (giáo viên nhập) + kết quả bài thi
//                 online (kv_exam_results, qua getExamResult theo lộ trình)
// Mỗi helper merge kèm MOCK_* làm dữ liệu nền demo, bản ghi thật thắng khi trùng.
// ─────────────────────────────────────────────────────────────────────────────

import {
  kvGet, getCurriculum, getExamResult, getExamScoresByStudent,
  type StoredExamScore,
} from "@/lib/storage";
import { MOCK_ATTENDANCE, MOCK_HOMEWORK, MOCK_EXAM_SCORES, MOCK_CLASSES } from "@/lib/mock-data";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface ChildAttendanceRecord {
  id:         string;
  class_id:   string;
  student_id: string;
  date:       string; // YYYY-MM-DD
  status:     AttendanceStatus;
}

interface TeacherAttendanceKvRecord {
  class_id:   string;
  student_id: string;
  date:       string;
  status:     AttendanceStatus;
  saved_at:   string;
}

// Điểm danh của một (hoặc nhiều) học sinh: bản ghi giáo viên lưu thật + mock nền.
// Trùng (class_id, student_id, date) → bản thật thắng.
export async function loadChildrenAttendance(studentIds: string[]): Promise<ChildAttendanceRecord[]> {
  const idSet = new Set(studentIds);
  const real = (await kvGet<TeacherAttendanceKvRecord[]>("tutorhub_teacher_attendance", []))
    .filter(r => idSet.has(r.student_id))
    .map(r => ({
      id:         `real_${r.class_id}_${r.student_id}_${r.date}`,
      class_id:   r.class_id,
      student_id: r.student_id,
      date:       r.date,
      status:     r.status,
    }));
  const realKeys = new Set(real.map(r => `${r.class_id}|${r.student_id}|${r.date}`));
  const mock = MOCK_ATTENDANCE
    .filter(r => idSet.has(r.student_id))
    .filter(r => !realKeys.has(`${r.class_id}|${r.student_id}|${r.attendance_date}`))
    .map(r => ({
      id:         r.id,
      class_id:   r.class_id,
      student_id: r.student_id,
      date:       r.attendance_date,
      status:     r.status as AttendanceStatus,
    }));
  return [...real, ...mock].sort((a, b) => b.date.localeCompare(a.date));
}

// Tỉ lệ chuyên cần chuẩn (đồng bộ trang học viên):
// (present + late) / (tổng bản ghi − excused). Không có bản ghi → null.
export function attendanceRate(records: ChildAttendanceRecord[]): number | null {
  if (records.length === 0) return null;
  const excused  = records.filter(r => r.status === "excused").length;
  const attended = records.filter(r => r.status === "present" || r.status === "late").length;
  const denom = records.length - excused;
  return denom > 0 ? Math.round((attended / denom) * 100) : null;
}

// ── Điểm thi ──────────────────────────────────────────────────────────────────

// Toàn bộ điểm của một học sinh: giáo viên nhập (kv) + bài thi online đã làm
// (kv_exam_results theo lộ trình các lớp của em đó) + mock nền, dedup theo id.
export async function loadChildScores(
  studentId: string,
  classIds: string[]
): Promise<StoredExamScore[]> {
  const stored = await getExamScoresByStudent(studentId);

  const taken: StoredExamScore[] = [];
  for (const classId of classIds) {
    try {
      const chapters = await getCurriculum(classId);
      const examLessons = chapters
        .flatMap(ch => ch.sessions)
        .flatMap(s => s.lessons)
        .filter(l => l.type === "exam");
      const results = await Promise.all(
        examLessons.map(l => getExamResult(classId, l.id, studentId))
      );
      examLessons.forEach((lesson, i) => {
        const rec = results[i];
        if (!rec) return;
        taken.push({
          id:         `tutorhub_exam_result_${classId}_${lesson.id}_${studentId}`,
          student_id: studentId,
          class_id:   classId,
          exam_name:  lesson.title ?? "Bài kiểm tra trực tuyến",
          score:      rec.score,
          max_score:  rec.total,
          exam_date:  rec.submitted_at,
        });
      });
    } catch { /* lớp offline → bỏ qua */ }
  }

  const mock = MOCK_EXAM_SCORES.filter(s => s.student_id === studentId);
  const combined = [...stored, ...taken, ...mock];
  const seen = new Set<string>();
  return combined
    .filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; })
    .sort((a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime());
}

// Điểm trung bình thang 10 (chuẩn hoá max_score), null nếu chưa có điểm.
export function averageScore(scores: StoredExamScore[]): number | null {
  if (scores.length === 0) return null;
  const sum = scores.reduce((s, e) => s + (e.max_score && e.max_score !== 10 ? (e.score / e.max_score) * 10 : e.score), 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

// ── Bài tập ───────────────────────────────────────────────────────────────────

export interface ChildHomework {
  id:          string;
  class_id:    string;
  title:       string;
  description?: string;
  due_date:    string;
  created_at?: string;
}

// Bài tập của các lớp: giáo viên tạo (kv) + mock nền, kv thắng khi trùng id.
export async function loadClassHomework(classIds: string[]): Promise<ChildHomework[]> {
  const idSet = new Set(classIds);
  const teacher = (await kvGet<ChildHomework[]>("tutorhub_teacher_homework", []))
    .filter(h => idSet.has(h.class_id));
  const kvIds = new Set(teacher.map(h => h.id));
  const mock = MOCK_HOMEWORK.filter(h => idSet.has(h.class_id) && !kvIds.has(h.id));
  return [...teacher, ...mock]
    .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());
}

// ── Tra cứu tên lớp (thật + mock) ────────────────────────────────────────────

export function classNameOf(classId: string, realClasses?: { id: string; class_name: string }[]): string {
  return realClasses?.find(c => c.id === classId)?.class_name
    ?? MOCK_CLASSES.find(c => c.id === classId)?.class_name
    ?? classId;
}

// ── Thông báo sự kiện cho phụ huynh ──────────────────────────────────────────
// Sinh từ dữ liệu THẬT của các con (điểm danh, bài tập, học phí, điểm thi) —
// bổ sung cho thông báo broadcast (getNotifications). Id ổn định theo bản ghi
// gốc để đánh dấu đã đọc/xóa (localStorage) vẫn hoạt động qua các lần tải.

export interface ParentEventNotification {
  id:          string;
  title:       string;
  content:     string;
  target_role: "parent";
  is_read:     boolean;
  created_at:  string;
  category:    "assignment" | "graded" | "system" | "payment" | "info";
  sent_by?:    string;
}

const DAY_MS = 86400000;

interface EventChild {
  id:   string;
  name: string;
  classes: { id: string; class_name: string }[];
}

export async function loadParentEventNotifications(children: EventChild[]): Promise<ParentEventNotification[]> {
  if (children.length === 0) return [];
  const now = Date.now();
  const events: ParentEventNotification[] = [];
  const allClasses = children.flatMap(c => c.classes);
  const childName = (id: string) => children.find(c => c.id === id)?.name ?? "Học viên";

  // 1. Điểm danh: vắng/muộn trong 14 ngày gần nhất
  try {
    const attendance = await loadChildrenAttendance(children.map(c => c.id));
    for (const r of attendance) {
      if (r.status !== "absent" && r.status !== "late") continue;
      const ts = new Date(`${r.date}T12:00:00`).getTime();
      if (now - ts > 14 * DAY_MS) continue;
      events.push({
        id:          `evt_att_${r.class_id}_${r.student_id}_${r.date}`,
        title:       r.status === "absent" ? "Vắng mặt buổi học" : "Đi học muộn",
        content:     `Em ${childName(r.student_id)} ${r.status === "absent" ? "vắng mặt" : "đi muộn"} buổi học ${classNameOf(r.class_id, allClasses)} ngày ${new Date(`${r.date}T12:00:00`).toLocaleDateString("vi-VN")}.`,
        target_role: "parent",
        is_read:     false,
        created_at:  `${r.date}T12:00:00`,
        category:    "system",
      });
    }
  } catch { /* offline */ }

  // 2. Bài tập: đến hạn trong 3 ngày tới
  try {
    const classIds = [...new Set(allClasses.map(c => c.id))];
    const homework = await loadClassHomework(classIds);
    for (const hw of homework) {
      const due = new Date(`${hw.due_date}T23:59:59`).getTime();
      if (due < now || due - now > 3 * DAY_MS) continue;
      const owners = children.filter(c => c.classes.some(cl => cl.id === hw.class_id));
      if (owners.length === 0) continue;
      events.push({
        id:          `evt_hw_${hw.id}`,
        title:       "Bài tập sắp đến hạn",
        content:     `"${hw.title}" (${classNameOf(hw.class_id, allClasses)}) hạn nộp ${new Date(hw.due_date).toLocaleDateString("vi-VN")} — của em ${owners.map(o => o.name).join(", ")}.`,
        target_role: "parent",
        is_read:     false,
        created_at:  hw.created_at ?? hw.due_date,
        category:    "assignment",
      });
    }
  } catch { /* offline */ }

  // 3. Học phí: hóa đơn chưa thanh toán quá hạn / sắp đến hạn (7 ngày),
  //    và xác nhận đã thu trong 14 ngày gần nhất
  try {
    const { getInvoices } = await import("@/lib/storage");
    const childIds = new Set(children.map(c => c.id));
    const invoices = (await getInvoices()).filter(inv => childIds.has(inv.child_id));
    for (const inv of invoices) {
      if (inv.status === "pending") {
        const due = new Date(`${inv.due_date}T23:59:59`).getTime();
        if (due - now > 7 * DAY_MS) continue;
        const overdue = due < now;
        events.push({
          id:          `evt_inv_due_${inv.id}`,
          title:       overdue ? "Học phí quá hạn" : "Học phí sắp đến hạn",
          content:     `${inv.title} của em ${childName(inv.child_id)} ${overdue ? "đã quá hạn" : "đến hạn"} ${new Date(inv.due_date).toLocaleDateString("vi-VN")}.`,
          target_role: "parent",
          is_read:     false,
          created_at:  inv.due_date,
          category:    "payment",
        });
      } else if (inv.status === "paid" && inv.paid_at) {
        const paidTs = new Date(inv.paid_at).getTime();
        if (now - paidTs > 14 * DAY_MS) continue;
        events.push({
          id:          `evt_inv_paid_${inv.id}`,
          title:       "Đã xác nhận thanh toán",
          content:     `${inv.title} của em ${childName(inv.child_id)} đã được trung tâm xác nhận thu.`,
          target_role: "parent",
          is_read:     false,
          created_at:  inv.paid_at,
          category:    "payment",
        });
      }
    }
  } catch { /* offline */ }

  // 4. Điểm thi: bài thi có kết quả trong 14 ngày gần nhất
  try {
    for (const child of children) {
      const scores = await loadChildScores(child.id, child.classes.map(c => c.id));
      for (const s of scores) {
        const ts = new Date(s.exam_date).getTime();
        if (isNaN(ts) || now - ts > 14 * DAY_MS) continue;
        events.push({
          id:          `evt_score_${s.id}`,
          title:       "Có kết quả bài kiểm tra",
          content:     `Em ${child.name} đạt ${s.score}/${s.max_score} điểm bài "${s.exam_name}" (${classNameOf(s.class_id, allClasses)}).`,
          target_role: "parent",
          is_read:     false,
          created_at:  s.exam_date,
          category:    "graded",
        });
      }
    }
  } catch { /* offline */ }

  return events.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
