import assert from "node:assert/strict";
import test from "node:test";
import {
  analyticsDeltas,
  attendanceByClass,
  computeKpis,
  teacherAttentionItems,
  type AnalyticsData,
} from "../src/lib/analytics";

function dateInMonth(offset: number): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 10);
  return date.toISOString().slice(0, 10);
}

function fixture(): AnalyticsData {
  return {
    classes: [{
      id: "class-1",
      class_name: "Toán 12",
      subject: "Toán",
      learning_mode: "hybrid",
      tutor_id: "teacher-1",
      schedule: [],
      student_ids: ["student-1"],
      created_at: dateInMonth(-3),
    }],
    students: [{
      id: "student-1",
      user_id: "user-1",
      full_name: "Nguyễn Minh",
      dob: "2008-01-01",
      school: "THPT A",
      grade: "12",
      learning_type: "hybrid",
      created_at: dateInMonth(-3),
    }],
    teachers: [{
      id: "teacher-1",
      user_id: "teacher-user-1",
      full_name: "Giáo viên A",
      specialization: "Toán",
      created_at: dateInMonth(-12),
    }],
    invoices: [],
    attendance: [
      { id: "a1", class_id: "class-1", student_id: "student-1", attendance_date: dateInMonth(0), status: "present", created_at: dateInMonth(0) },
      { id: "a2", class_id: "class-1", student_id: "student-1", attendance_date: dateInMonth(0), status: "absent", created_at: dateInMonth(0) },
      { id: "a3", class_id: "class-1", student_id: "student-1", attendance_date: dateInMonth(0), status: "absent", created_at: dateInMonth(0) },
      { id: "a4", class_id: "class-1", student_id: "student-1", attendance_date: dateInMonth(0), status: "excused", created_at: dateInMonth(0) },
      { id: "a5", class_id: "class-1", student_id: "student-1", attendance_date: dateInMonth(-1), status: "present", created_at: dateInMonth(-1) },
    ],
    examScores: [
      { id: "s1", student_id: "student-1", class_id: "class-1", exam_name: "Bài 1", score: 8, max_score: 10, exam_date: dateInMonth(-1) },
      { id: "s2", student_id: "student-1", class_id: "class-1", exam_name: "Bài 2", score: 4, max_score: 10, exam_date: dateInMonth(0) },
    ],
    revenueEvents: [],
    teacherOf: { "class-1": "teacher-1" },
    loadedAt: new Date().toISOString(),
  };
}

test("attendance metrics exclude excused records from the denominator", () => {
  const data = fixture();
  const scope = new Set(["class-1"]);
  assert.equal(computeKpis(data, scope).avgAttendancePct, 50);
  assert.equal(attendanceByClass(data, scope)[0]?.rate, 50);
});

test("teacher attention items explain why a student needs support", () => {
  const items = teacherAttentionItems(fixture(), new Set(["class-1"]));
  assert.equal(items.length, 1);
  assert.equal(items[0]?.studentName, "Nguyễn Minh");
  assert.ok(items[0]?.reasons.includes("Vắng 2 buổi"));
});

test("period deltas compare equal adjacent time windows", () => {
  const deltas = analyticsDeltas(fixture(), 1, new Set(["class-1"]));
  assert.equal(deltas.attendance.current, 33);
  assert.equal(deltas.attendance.previous, 100);
  assert.equal(deltas.score.delta, -4);
});
