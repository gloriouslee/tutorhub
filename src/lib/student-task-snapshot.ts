import { getSubmissionsByStudent, type SubmissionRecord } from "@/lib/supabase/submissions";
import {
  getStudentLearningSnapshot,
  getTeacherHomework,
  isAssignedToStudent,
} from "@/lib/storage";

export type StudentTaskKind = "file" | "exam";
export type StudentTaskState = "todo" | "overdue" | "returned" | "submitted" | "done";

export interface StudentTaskAssignment {
  id: string;
  class_id: string;
  title: string;
  description?: string;
  due_date: string;
  created_at?: string;
  assigned_to?: string[] | null;
  file_url?: string;
  kind?: StudentTaskKind;
  exam_done?: boolean;
  exam_score?: number;
  exam_total?: number;
}

export interface StudentTaskItem extends StudentTaskAssignment {
  key: string;
  kind: StudentTaskKind;
  state: StudentTaskState;
  submission?: SubmissionRecord;
  href: string;
}

export interface StudentTaskSnapshot {
  assignments: StudentTaskAssignment[];
  submissions: SubmissionRecord[];
  items: StudentTaskItem[];
  actionable: StudentTaskItem[];
  completedCount: number;
  completionPercent: number;
  nextTask: StudentTaskItem | null;
}

export function studentTaskKey(task: Pick<StudentTaskAssignment, "class_id" | "id">) {
  return `${task.class_id}:${task.id}`;
}

function endOfDueDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function findStudentTaskSubmission(
  task: StudentTaskAssignment,
  assignments: StudentTaskAssignment[],
  submissions: SubmissionRecord[],
  studentId: string,
) {
  const exact = submissions.find((submission) => (
    submission.student_id === studentId
    && submission.homework_id === task.id
    && submission.class_id === task.class_id
  ));
  if (exact) return exact;

  // Dữ liệu cũ chưa có class_id chỉ an toàn khi id bài tập là duy nhất.
  if (assignments.filter((item) => item.id === task.id).length !== 1) return undefined;
  return submissions.find((submission) => (
    submission.student_id === studentId
    && submission.homework_id === task.id
    && !submission.class_id
  ));
}

export function resolveStudentTaskState(
  task: StudentTaskAssignment,
  submission: SubmissionRecord | undefined,
  now = new Date(),
): StudentTaskState {
  if ((task.kind ?? "file") === "exam") return task.exam_done ? "done" : endOfDueDate(task.due_date) < now.getTime() ? "overdue" : "todo";
  if (submission?.status === "returned") return "returned";
  if (submission?.status === "graded") return "done";
  if (submission) return "submitted";
  return endOfDueDate(task.due_date) < now.getTime() ? "overdue" : "todo";
}

const TASK_PRIORITY: Record<StudentTaskState, number> = {
  returned: 0,
  overdue: 1,
  todo: 2,
  submitted: 3,
  done: 4,
};

export function buildStudentTaskSnapshot(
  assignments: StudentTaskAssignment[],
  submissions: SubmissionRecord[],
  studentId: string,
  now = new Date(),
): StudentTaskSnapshot {
  const items = assignments.map((task): StudentTaskItem => {
    const submission = findStudentTaskSubmission(task, assignments, submissions, studentId);
    const state = resolveStudentTaskState(task, submission, now);
    const kind = task.kind ?? "file";
    const homeworkHref = `/student/homework?classId=${encodeURIComponent(task.class_id)}&homeworkId=${encodeURIComponent(task.id)}${state === "todo" || state === "overdue" || state === "returned" ? "&action=submit" : ""}`;
    return {
      ...task,
      key: studentTaskKey(task),
      kind,
      state,
      submission,
      href: kind === "exam"
        ? `/student/classes/${encodeURIComponent(task.class_id)}/exam/${encodeURIComponent(task.id)}`
        : homeworkHref,
    };
  }).sort((left, right) => (
    TASK_PRIORITY[left.state] - TASK_PRIORITY[right.state]
    || endOfDueDate(left.due_date) - endOfDueDate(right.due_date)
    || left.title.localeCompare(right.title, "vi")
  ));

  const actionable = items.filter((item) => (
    item.state === "todo" || item.state === "overdue" || item.state === "returned"
  ));
  const completedCount = items.filter((item) => item.state === "submitted" || item.state === "done").length;

  return {
    assignments,
    submissions,
    items,
    actionable,
    completedCount,
    completionPercent: items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0,
    nextTask: actionable[0] ?? null,
  };
}

export async function loadStudentTaskSnapshot(
  studentId: string,
  classIds: readonly string[],
): Promise<StudentTaskSnapshot> {
  const uniqueClassIds = [...new Set(classIds.filter(Boolean))];
  if (!studentId || uniqueClassIds.length === 0) {
    return buildStudentTaskSnapshot([], [], studentId);
  }

  const [manualAssignments, learningSnapshot, submissions] = await Promise.all([
    getTeacherHomework<StudentTaskAssignment>(uniqueClassIds),
    getStudentLearningSnapshot(uniqueClassIds),
    getSubmissionsByStudent(studentId),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const curriculumAssignments: StudentTaskAssignment[] = [];

  for (const classId of uniqueClassIds) {
    for (const chapter of learningSnapshot.curricula[classId] ?? []) {
      for (const session of chapter.sessions) {
        for (const lesson of session.lessons) {
          if (lesson.is_published === false || !isAssignedToStudent(lesson.assigned_to, studentId)) continue;
          if (lesson.type !== "homework" && lesson.type !== "exam") continue;

          const result = lesson.type === "exam"
            ? learningSnapshot.examResults[`${classId}:${lesson.id}`]
            : undefined;
          const manualScore = result
            ? Object.values(result.manual_scores ?? {}).reduce((sum, score) => sum + score, 0)
            : 0;
          curriculumAssignments.push({
            id: lesson.id,
            class_id: classId,
            title: lesson.title,
            description: lesson.description,
            due_date: lesson.type === "exam"
              ? lesson.exam_opens_at?.slice(0, 10) ?? session.date ?? today
              : lesson.due_date ?? session.date ?? today,
            created_at: session.date,
            assigned_to: lesson.assigned_to,
            file_url: lesson.file_url,
            kind: lesson.type === "exam" ? "exam" : "file",
            exam_done: Boolean(result),
            exam_score: result ? Math.round((result.score + manualScore) * 100) / 100 : undefined,
            exam_total: result?.total,
          });
        }
      }
    }
  }

  const merged = new Map<string, StudentTaskAssignment>();
  for (const task of manualAssignments) {
    if (uniqueClassIds.includes(task.class_id) && isAssignedToStudent(task.assigned_to, studentId)) {
      merged.set(studentTaskKey(task), { ...task, kind: task.kind ?? "file" });
    }
  }
  for (const task of curriculumAssignments) {
    if (!merged.has(studentTaskKey(task))) merged.set(studentTaskKey(task), task);
  }

  return buildStudentTaskSnapshot([...merged.values()], submissions, studentId);
}
