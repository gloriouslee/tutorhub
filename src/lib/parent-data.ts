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
