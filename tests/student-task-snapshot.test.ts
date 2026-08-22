import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStudentTaskSnapshot,
  findStudentTaskSubmission,
  resolveStudentTaskState,
  type StudentTaskAssignment,
} from "../src/lib/student-task-snapshot";
import type { SubmissionRecord } from "../src/lib/supabase/submissions";

const studentId = "stu_1";
const now = new Date("2026-08-23T12:00:00+07:00");

function task(overrides: Partial<StudentTaskAssignment> = {}): StudentTaskAssignment {
  return {
    id: "hw_1",
    class_id: "cls_1",
    title: "Bài tập số 1",
    due_date: "2026-08-24",
    kind: "file",
    ...overrides,
  };
}

function submission(overrides: Partial<SubmissionRecord> = {}): SubmissionRecord {
  return {
    id: "sub_1",
    class_id: "cls_1",
    homework_id: "hw_1",
    student_id: studentId,
    status: "submitted",
    submitted_at: "2026-08-22T08:00:00+07:00",
    ...overrides,
  };
}

test("chỉ bài chưa hoàn thành, quá hạn hoặc bị trả lại mới là việc cần làm", () => {
  const assignments = [
    task(),
    task({ id: "hw_overdue", due_date: "2026-08-20" }),
    task({ id: "hw_returned" }),
    task({ id: "exam_done", kind: "exam", exam_done: true }),
  ];
  const submissions = [
    submission(),
    submission({ id: "sub_returned", homework_id: "hw_returned", status: "returned" }),
  ];

  const snapshot = buildStudentTaskSnapshot(assignments, submissions, studentId, now);

  assert.deepEqual(snapshot.actionable.map((item) => item.id), ["hw_returned", "hw_overdue"]);
  assert.equal(snapshot.completedCount, 2);
  assert.equal(snapshot.completionPercent, 50);
  assert.equal(snapshot.nextTask?.state, "returned");
  assert.equal(snapshot.items.find((item) => item.id === "exam_done")?.href, "/student/classes/cls_1/exam/exam_done");
});

test("submission cũ thiếu class_id không được ghép khi hai lớp trùng homework_id", () => {
  const assignments = [task(), task({ class_id: "cls_2" })];
  const legacySubmission = submission({ class_id: undefined });

  assert.equal(findStudentTaskSubmission(assignments[0], assignments, [legacySubmission], studentId), undefined);
  assert.equal(findStudentTaskSubmission(assignments[1], assignments, [legacySubmission], studentId), undefined);
});

test("trạng thái bài thi và file dùng cùng quy tắc hạn nộp", () => {
  assert.equal(resolveStudentTaskState(task({ due_date: "2026-08-20" }), undefined, now), "overdue");
  assert.equal(resolveStudentTaskState(task({ kind: "exam", exam_done: false, due_date: "2026-08-20" }), undefined, now), "overdue");
  assert.equal(resolveStudentTaskState(task({ kind: "exam", exam_done: true }), undefined, now), "done");
});
