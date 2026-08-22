import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveChildIdsForParent } from "@/lib/guardian-server";
import {
  BADGE_CATALOG,
  currentValueForGoal,
  detectSupportAlert,
  goalProgressPercent,
  type GoalMetric,
  type SupportStudentSnapshot,
  xpLevel,
} from "@/lib/learning-growth";
import {
  autoQuestionScore,
  maxQuestionScore,
  type StudentAnswer,
  type TrueFalseScale,
} from "@/lib/exam-scoring";
import type { CurriculumChapter, CurriculumLesson, ExamQuestion, StoredExamResult } from "@/lib/storage";
import type {
  StudentActiveGoal,
  StudentClassMetrics,
  StudentRiskSummary,
  StudentWorkspaceProfile,
  StudentWorkspaceSummary,
} from "@/lib/teacher-student-workspace";
import { isAttendedStatus } from "@/lib/attendance";

type AdminClient = ReturnType<typeof createAdminClient>;

type GrowthClass = {
  id: string;
  class_name: string;
  subject: string;
  color: string;
  tutor_id: string | null;
  student_ids: string[];
};

type GrowthStudent = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  grade: string;
  school: string;
  learning_type: string;
};

type GrowthHomework = {
  id: string;
  classId: string;
  title: string;
  dueAt: string;
  assignedTo: string[] | null;
};

type GrowthSubmission = {
  id: string;
  classId: string;
  homeworkId: string;
  studentId: string;
  submittedAt: string;
  feedback: string | null;
  score: number | null;
};

type GrowthAttendance = {
  classId: string;
  studentId: string;
  date: string;
  status: "present" | "online" | "absent" | "late" | "excused";
};

type GrowthScore = {
  id: string;
  classId: string;
  studentId: string;
  title: string;
  score: number;
  maxScore: number;
  value100: number;
  recordedAt: string;
  source: "teacher" | "online";
  reviewHref: string | null;
};

type GrowthProgress = {
  classId: string;
  studentId: string;
  lessonId: string;
  completed: boolean;
  updatedAt: string;
};

type ExamDescriptor = {
  resultRegistryId: string;
  classId: string;
  lessonId: string;
  title: string;
  chapterTitle: string;
  questions: ExamQuestion[];
  trueFalseScale?: TrueFalseScale;
  resources: {
    lessonId: string;
    title: string;
    type: CurriculumLesson["type"];
    assignedTo: string[] | null;
  }[];
};

type OnlineExamResult = {
  id: string;
  descriptor: ExamDescriptor;
  result: StoredExamResult;
};

type GrowthDataset = {
  classes: GrowthClass[];
  students: GrowthStudent[];
  homework: GrowthHomework[];
  submissions: GrowthSubmission[];
  attendance: GrowthAttendance[];
  scores: GrowthScore[];
  progress: GrowthProgress[];
  onlineResults: OnlineExamResult[];
  packages: Record<string, Record<string, "online" | "advanced" | "offline">>;
};

const DAY_MS = 86_400_000;

function chunks<T>(items: T[], size = 100) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function validNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizedScore(score: unknown, maximum: unknown) {
  const numerator = Number(score);
  const denominator = Number(maximum);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return Math.min(100, Math.max(0, (numerator / denominator) * 100));
}

function assignedToStudent(assignedTo: string[] | null, studentId: string) {
  return !assignedTo || assignedTo.length === 0 || assignedTo.includes(studentId);
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function endOfDay(value: string) {
  // TutorHub currently operates in Asia/Bangkok. A date-only deadline means
  // the end of that local calendar day, not midnight at its beginning.
  return value.length === 10 ? `${value}T23:59:59.999+07:00` : value;
}

function inRange(value: string, start: string, end: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp)
    && timestamp >= new Date(`${start}T00:00:00.000Z`).getTime()
    && timestamp <= new Date(`${end}T23:59:59.999Z`).getTime();
}

function mondayOfWeek(reference: Date) {
  const date = new Date(Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth(),
    reference.getUTCDate(),
  ));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date;
}

async function loadGrowthDataset(admin: AdminClient, classes: GrowthClass[]): Promise<GrowthDataset> {
  const classIds = classes.map((item) => item.id);
  const studentIds = [...new Set(classes.flatMap((item) => item.student_ids))];
  if (classIds.length === 0 || studentIds.length === 0) {
    return { classes, students: [], homework: [], submissions: [], attendance: [], scores: [], progress: [], onlineResults: [], packages: {} };
  }

  const [
    studentsResponse,
    manualScoresResponse,
    curriculumResponse,
    homeworkResponse,
    submissionsResponse,
    attendanceResponse,
    progressResponse,
    packagesResponse,
  ] = await Promise.all([
    admin.from("students").select("id,full_name,avatar_url,grade,school,learning_type").in("id", studentIds),
    admin.from("app_exam_scores")
      .select("id,student_ref,class_id,exam_name,score,max_score,exam_date,created_at")
      .in("class_id", classIds)
      .in("student_ref", studentIds),
    admin.from("kv_curriculum").select("id,value").in("id", classIds),
    admin.from("teacher_homework").select("id,class_id,data").in("class_id", classIds),
    admin.from("hw_submissions")
      .select("id,class_id,homework_id,student_id,submitted_at,data")
      .in("class_id", classIds)
      .in("student_id", studentIds),
    admin.from("class_attendance")
      .select("class_id,student_id,attendance_date,data")
      .in("class_id", classIds)
      .in("student_id", studentIds),
    admin.from("student_lesson_progress")
      .select("student_id,resource_id,lesson_id,completed,updated_at")
      .in("student_id", studentIds)
      .in("resource_id", classIds),
    admin.from("kv_student_packages").select("id,value").in("id", classIds),
  ]);
  const failed = [
    studentsResponse,
    manualScoresResponse,
    curriculumResponse,
    homeworkResponse,
    submissionsResponse,
    attendanceResponse,
    progressResponse,
    packagesResponse,
  ].find((response) => response.error);
  if (failed?.error) throw failed.error;

  const curriculumByClass = new Map<string, CurriculumChapter[]>();
  for (const row of curriculumResponse.data ?? []) {
    curriculumByClass.set(String(row.id), Array.isArray(row.value) ? row.value as CurriculumChapter[] : []);
  }

  const descriptors: ExamDescriptor[] = [];
  for (const classId of classIds) {
    for (const chapter of curriculumByClass.get(classId) ?? []) {
      const resources = chapter.sessions
        .flatMap((session) => session.lessons)
        .filter((lesson) => lesson.type !== "exam" && lesson.is_published !== false)
        .map((lesson) => ({
          lessonId: lesson.id,
          title: lesson.title,
          type: lesson.type,
          assignedTo: lesson.assigned_to ?? null,
        }));
      for (const lesson of chapter.sessions.flatMap((session) => session.lessons)) {
        if (lesson.type !== "exam") continue;
        descriptors.push({
          resultRegistryId: `${classId}_${lesson.id}`,
          classId,
          lessonId: lesson.id,
          title: lesson.title,
          chapterTitle: chapter.title,
          questions: lesson.exam_content?.questions ?? [],
          trueFalseScale: lesson.exam_content?.true_false_scale,
          resources: resources.slice(0, 6),
        });
      }
    }
  }

  const descriptorByRegistry = new Map(descriptors.map((item) => [item.resultRegistryId, item]));
  const registryResponses = await Promise.all(
    chunks([...descriptorByRegistry.keys()]).map((ids) =>
      admin.from("kv_exam_submissions").select("id,value").in("id", ids),
    ),
  );
  const registryFailure = registryResponses.find((response) => response.error);
  if (registryFailure?.error) throw registryFailure.error;

  const resultDescriptorById = new Map<string, ExamDescriptor>();
  const allowedStudents = new Set(studentIds);
  for (const row of registryResponses.flatMap((response) => response.data ?? [])) {
    const descriptor = descriptorByRegistry.get(String(row.id));
    if (!descriptor || !Array.isArray(row.value)) continue;
    for (const rawStudentId of row.value) {
      const studentId = String(rawStudentId);
      if (allowedStudents.has(studentId)) {
        resultDescriptorById.set(`${descriptor.classId}_${descriptor.lessonId}_${studentId}`, descriptor);
      }
    }
  }

  const resultResponses = await Promise.all(
    chunks([...resultDescriptorById.keys()]).map((ids) =>
      admin.from("kv_exam_results").select("id,value").in("id", ids),
    ),
  );
  const resultFailure = resultResponses.find((response) => response.error);
  if (resultFailure?.error) throw resultFailure.error;
  const onlineResults: OnlineExamResult[] = resultResponses
    .flatMap((response) => response.data ?? [])
    .flatMap((row) => {
      const descriptor = resultDescriptorById.get(String(row.id));
      return descriptor ? [{ id: String(row.id), descriptor, result: row.value as StoredExamResult }] : [];
    });

  const homework = (homeworkResponse.data ?? []).map((row) => {
    const data = object(row.data);
    const dueDate = String(data.due_date ?? "");
    const assigned = data.assigned_to;
    return {
      id: String(row.id),
      classId: String(row.class_id),
      title: String(data.title ?? "Bài tập"),
      dueAt: endOfDay(dueDate),
      assignedTo: assigned === null || assigned === undefined ? null : strings(assigned),
    } satisfies GrowthHomework;
  }).filter((item) => item.dueAt.length > 0);

  const submissions = (submissionsResponse.data ?? []).map((row) => {
    const data = object(row.data);
    return {
      id: String(row.id),
      classId: String(row.class_id ?? data.class_id ?? ""),
      homeworkId: String(row.homework_id),
      studentId: String(row.student_id),
      submittedAt: String(row.submitted_at ?? data.submitted_at ?? ""),
      feedback: typeof data.feedback === "string" && data.feedback.trim() ? data.feedback.trim() : null,
      score: Number.isFinite(Number(data.score)) ? Number(data.score) : null,
    } satisfies GrowthSubmission;
  });

  const attendance = (attendanceResponse.data ?? []).flatMap((row) => {
    const data = object(row.data);
    const status = String(data.status ?? "");
    if (!["present", "online", "absent", "late", "excused"].includes(status)) return [];
    return [{
      classId: String(row.class_id),
      studentId: String(row.student_id),
      date: String(row.attendance_date ?? data.date ?? ""),
      status: status as GrowthAttendance["status"],
    } satisfies GrowthAttendance];
  });

  const scores: GrowthScore[] = [
    ...(manualScoresResponse.data ?? []).map((row) => ({
      id: String(row.id),
      classId: String(row.class_id),
      studentId: String(row.student_ref),
      title: String(row.exam_name ?? "Bài kiểm tra"),
      score: validNumber(row.score),
      maxScore: validNumber(row.max_score),
      value100: normalizedScore(row.score, row.max_score),
      recordedAt: String(row.exam_date ?? row.created_at ?? ""),
      source: "teacher" as const,
      reviewHref: null,
    })),
    ...onlineResults.map(({ id, descriptor, result }) => {
      const score = validNumber(result.score)
        + Object.values(result.manual_scores ?? {}).reduce((sum, value) => sum + validNumber(value), 0);
      return {
        id,
        classId: descriptor.classId,
        studentId: String(result.student_id),
        title: descriptor.title,
        score,
        maxScore: validNumber(result.total),
        value100: normalizedScore(score, result.total),
        recordedAt: result.submitted_at,
        source: "online" as const,
        reviewHref: `/teacher/classes/${encodeURIComponent(descriptor.classId)}?tab=curriculum&exam=${encodeURIComponent(descriptor.lessonId)}&student=${encodeURIComponent(String(result.student_id))}`,
      };
    }),
  ];

  return {
    classes,
    students: (studentsResponse.data ?? []).map((row) => ({
      id: String(row.id),
      full_name: String(row.full_name ?? "Học viên"),
      avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
      grade: String(row.grade ?? ""),
      school: String(row.school ?? ""),
      learning_type: String(row.learning_type ?? ""),
    })),
    homework,
    submissions,
    attendance,
    scores,
    progress: (progressResponse.data ?? []).map((row) => ({
      classId: String(row.resource_id),
      studentId: String(row.student_id),
      lessonId: String(row.lesson_id),
      completed: row.completed === true,
      updatedAt: String(row.updated_at ?? ""),
    })),
    onlineResults,
    packages: Object.fromEntries((packagesResponse.data ?? []).map((row) => [
      String(row.id),
      object(row.value) as Record<string, "online" | "advanced" | "offline">,
    ])),
  };
}

function classStudents(dataset: GrowthDataset) {
  return dataset.classes.flatMap((classItem) => classItem.student_ids.map((studentId) => ({ classItem, studentId })));
}

async function syncXp(admin: AdminClient, dataset: GrowthDataset, allowedStudentIds: Set<string>) {
  const homeworkById = new Map(dataset.homework.map((item) => [item.id, item]));
  const events: Record<string, unknown>[] = [];

  for (const submission of dataset.submissions) {
    if (!allowedStudentIds.has(submission.studentId)) continue;
    const homework = homeworkById.get(submission.homeworkId);
    if (!homework || !assignedToStudent(homework.assignedTo, submission.studentId)) continue;
    const onTime = new Date(submission.submittedAt).getTime() <= new Date(homework.dueAt).getTime();
    events.push({
      student_id: submission.studentId,
      class_id: submission.classId,
      source_type: "homework",
      source_id: submission.id,
      points: onTime ? 30 : 20,
      reason: onTime ? "Hoàn thành bài tập đúng hạn" : "Hoàn thành bài tập",
      metadata: { homework_id: submission.homeworkId, on_time: onTime },
      occurred_at: submission.submittedAt,
    });
  }

  for (const record of dataset.attendance) {
    if (!allowedStudentIds.has(record.studentId) || !isAttendedStatus(record.status)) continue;
    events.push({
      student_id: record.studentId,
      class_id: record.classId,
      source_type: "attendance",
      source_id: `${record.classId}:${record.date}`,
      points: record.status === "late" ? 4 : 10,
      reason: record.status === "late"
        ? "Tham gia buổi học dù đến muộn"
        : record.status === "online"
          ? "Tham gia buổi học online"
          : "Tham gia buổi học",
      metadata: { status: record.status },
      occurred_at: `${record.date}T12:00:00.000Z`,
    });
  }

  for (const progress of dataset.progress) {
    if (!allowedStudentIds.has(progress.studentId) || !progress.completed) continue;
    events.push({
      student_id: progress.studentId,
      class_id: progress.classId,
      source_type: "lesson",
      source_id: `${progress.classId}:${progress.lessonId}`,
      points: 5,
      reason: "Hoàn thành một nội dung học",
      metadata: { lesson_id: progress.lessonId },
      occurred_at: progress.updatedAt,
    });
  }

  for (const studentId of allowedStudentIds) {
    for (const classItem of dataset.classes.filter((item) => item.student_ids.includes(studentId))) {
      const scores = dataset.scores
        .filter((score) => score.studentId === studentId && score.classId === classItem.id)
        .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
      scores.forEach((score, index) => {
        if (index === 0 || score.value100 - scores[index - 1].value100 < 5) return;
        events.push({
          student_id: studentId,
          class_id: classItem.id,
          source_type: "improvement",
          source_id: score.id,
          points: 15,
          reason: "Cải thiện điểm số so với bài trước",
          metadata: { previous: scores[index - 1].value100, current: score.value100 },
          occurred_at: score.recordedAt,
        });
      });
    }
  }

  if (events.length > 0) {
    const { error } = await admin.from("student_xp_events").upsert(events, {
      onConflict: "student_id,source_type,source_id",
    });
    if (error) throw error;
  }

  const { data: storedEvents, error } = await admin
    .from("student_xp_events")
    .select("student_id,source_type,points,metadata,occurred_at")
    .in("student_id", [...allowedStudentIds]);
  if (error) throw error;

  const badges: Record<string, unknown>[] = [];
  for (const studentId of allowedStudentIds) {
    const rows = (storedEvents ?? []).filter((row) => String(row.student_id) === studentId);
    const totalXp = rows.reduce((sum, row) => sum + validNumber(row.points), 0);
    const onTime = rows.filter((row) => row.source_type === "homework" && object(row.metadata).on_time === true).length;
    const present = rows.filter((row) => {
      if (row.source_type !== "attendance") return false;
      const status = object(row.metadata).status;
      return status === "present" || status === "online";
    }).length;
    const improvements = rows.filter((row) => row.source_type === "improvement").length;
    const earned = new Set<string>();
    if (totalXp >= 20) earned.add("first_steps");
    if (onTime >= 5) earned.add("on_time_5");
    if (present >= 5) earned.add("attendance_star");
    if (improvements >= 1) earned.add("comeback");
    if (totalXp >= 500) earned.add("xp_500");
    for (const badge of BADGE_CATALOG.filter((item) => earned.has(item.code))) {
      badges.push({
        student_id: studentId,
        class_id: "",
        badge_code: badge.code,
        title: badge.title,
        description: badge.description,
        icon: badge.icon,
        metadata: { total_xp: totalXp },
      });
    }
  }
  if (badges.length > 0) {
    const { error: badgeError } = await admin.from("student_badges").upsert(badges, {
      onConflict: "student_id,badge_code,class_id",
      ignoreDuplicates: true,
    });
    if (badgeError) throw badgeError;
  }
  return storedEvents ?? [];
}

async function syncTopicMastery(admin: AdminClient, dataset: GrowthDataset, allowedStudentIds: Set<string>) {
  type TopicAggregate = {
    studentId: string;
    classId: string;
    topic: string;
    total: number;
    incorrect: number;
    resources: ExamDescriptor["resources"];
    lastExamId: string;
    lastExamTitle: string;
    lastExamAt: string;
  };
  const aggregates = new Map<string, TopicAggregate>();
  for (const online of dataset.onlineResults) {
    const studentId = String(online.result.student_id);
    if (!allowedStudentIds.has(studentId)) continue;
    const answers = online.result.answers as Record<string, StudentAnswer>;
    for (const question of online.descriptor.questions) {
      const topic = question.tags?.find((tag) => tag.trim())?.trim() || online.descriptor.chapterTitle || "Nội dung tổng hợp";
      const key = `${studentId}\u0000${online.descriptor.classId}\u0000${topic}`;
      const current = aggregates.get(key) ?? {
        studentId,
        classId: online.descriptor.classId,
        topic,
        total: 0,
        incorrect: 0,
        resources: online.descriptor.resources.filter((resource) =>
          assignedToStudent(resource.assignedTo, studentId),
        ),
        lastExamId: online.descriptor.lessonId,
        lastExamTitle: online.descriptor.title,
        lastExamAt: online.result.submitted_at,
      };
      const maximum = maxQuestionScore(question);
      const earned = question.type === "essay"
        ? validNumber(online.result.manual_scores?.[question.id])
        : autoQuestionScore(question, answers[question.id], online.descriptor.trueFalseScale);
      current.total += 1;
      if (earned + 0.0001 < maximum) current.incorrect += 1;
      if (new Date(online.result.submitted_at) > new Date(current.lastExamAt)) {
        current.lastExamId = online.descriptor.lessonId;
        current.lastExamTitle = online.descriptor.title;
        current.lastExamAt = online.result.submitted_at;
        current.resources = online.descriptor.resources.filter((resource) =>
          assignedToStudent(resource.assignedTo, studentId),
        );
      }
      aggregates.set(key, current);
    }
  }

  const rows = [...aggregates.values()].map((item) => ({
    student_id: item.studentId,
    class_id: item.classId,
    topic: item.topic.slice(0, 160),
    total_questions: item.total,
    incorrect_questions: item.incorrect,
    mastery_percent: item.total > 0 ? Math.round(((item.total - item.incorrect) / item.total) * 10_000) / 100 : 0,
    recommended_resources: item.resources.slice(0, 3).map((resource) => ({
      classId: item.classId,
      lessonId: resource.lessonId,
      title: resource.title,
      type: resource.type,
    })),
    last_exam_id: item.lastExamId,
    last_exam_title: item.lastExamTitle,
    last_exam_at: item.lastExamAt,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length > 0) {
    const { error } = await admin.from("student_topic_mastery").upsert(rows, {
      onConflict: "student_id,class_id,topic",
    });
    if (error) throw error;
  }
  return rows;
}

async function syncGoals(
  admin: AdminClient,
  dataset: GrowthDataset,
  allowedStudentIds: Set<string>,
  storedXpEvents: Record<string, unknown>[],
) {
  const { data: goals, error } = await admin
    .from("learning_goals")
    .select("*")
    .in("student_id", [...allowedStudentIds])
    .in("status", ["active", "completed"]);
  if (error) throw error;
  const updates: Record<string, unknown>[] = [];
  const now = isoDate(new Date());
  for (const goal of goals ?? []) {
    const studentId = String(goal.student_id);
    const start = String(goal.period_start);
    const end = String(goal.period_end);
    const classId = typeof goal.class_id === "string" ? goal.class_id : null;
    const inScope = (valueClassId: string) => !classId || valueClassId === classId;
    const submissions = dataset.submissions.filter((row) =>
      row.studentId === studentId && inScope(row.classId) && inRange(row.submittedAt, start, end),
    );
    const scores = dataset.scores.filter((row) =>
      row.studentId === studentId && inScope(row.classId) && inRange(row.recordedAt, start, end),
    );
    const attendance = dataset.attendance.filter((row) =>
      row.studentId === studentId && inScope(row.classId) && inRange(row.date, start, end) && row.status !== "excused",
    );
    const progress = dataset.progress.filter((row) =>
      row.studentId === studentId && row.completed && inScope(row.classId) && inRange(row.updatedAt, start, end),
    );
    const xp = storedXpEvents.filter((row) =>
      String(row.student_id) === studentId && inRange(String(row.occurred_at), start, end),
    );
    const currentValue = currentValueForGoal(String(goal.metric) as GoalMetric, {
      homeworkCompleted: submissions.length,
      averageScore: scores.length > 0 ? Math.round((scores.reduce((sum, row) => sum + row.value100 / 10, 0) / scores.length) * 10) / 10 : 0,
      attendanceRate: attendance.length > 0
        ? Math.round((attendance.filter((row) => isAttendedStatus(row.status)).length / attendance.length) * 100)
        : 0,
      lessonsCompleted: progress.length,
      xpEarned: xp.reduce((sum, row) => sum + validNumber(row.points), 0),
    });
    const target = validNumber(goal.target_value);
    const status = currentValue >= target
      ? "completed"
      : end < now && goal.status !== "completed"
        ? "expired"
        : String(goal.status);
    updates.push({
      id: goal.id,
      current_value: currentValue,
      status,
      completed_at: status === "completed" ? goal.completed_at ?? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    });
  }
  for (const update of updates) {
    const { id, ...patch } = update;
    const { error: updateError } = await admin.from("learning_goals").update(patch).eq("id", id);
    if (updateError) throw updateError;
  }
}

async function syncAlerts(admin: AdminClient, dataset: GrowthDataset, teacherId: string, allowedStudentIds: Set<string>) {
  const studentById = new Map(dataset.students.map((item) => [item.id, item]));
  const detectedAt = new Date().toISOString();
  const alerts = classStudents(dataset).flatMap(({ classItem, studentId }) => {
    if (!allowedStudentIds.has(studentId)) return [];
    const submissionByHomework = new Map(
      dataset.submissions
        .filter((row) => row.studentId === studentId && row.classId === classItem.id)
        .map((row) => [row.homeworkId, row]),
    );
    const snapshot: SupportStudentSnapshot = {
      studentId,
      studentName: studentById.get(studentId)?.full_name ?? "Học viên",
      classId: classItem.id,
      className: classItem.class_name,
      scores: dataset.scores
        .filter((score) => score.studentId === studentId && score.classId === classItem.id)
        .map((score) => ({ value: score.value100, recordedAt: score.recordedAt })),
      attendance: dataset.attendance
        .filter((record) => record.studentId === studentId && record.classId === classItem.id)
        .map((record) => ({ status: record.status, date: record.date })),
      homework: dataset.homework
        .filter((item) => item.classId === classItem.id && assignedToStudent(item.assignedTo, studentId))
        .map((item) => ({ dueAt: item.dueAt, submittedAt: submissionByHomework.get(item.id)?.submittedAt ?? null })),
    };
    const alert = detectSupportAlert(snapshot);
    return alert ? [alert] : [];
  });

  const { data: existing, error: existingError } = await admin
    .from("student_support_alerts")
    .select("id,alert_key,status,resolved_at")
    .eq("teacher_id", teacherId);
  if (existingError) throw existingError;
  const existingByKey = new Map((existing ?? []).map((row) => [String(row.alert_key), row]));

  if (alerts.length > 0) {
    const { error } = await admin.from("student_support_alerts").upsert(
      alerts.map((alert) => {
        const previous = existingByKey.get(alert.alertKey);
        const resolvedAt = previous?.resolved_at ? new Date(String(previous.resolved_at)).getTime() : 0;
        const insideResolutionCooldown = previous?.status === "resolved"
          && Number.isFinite(resolvedAt)
          && resolvedAt > Date.now() - 14 * DAY_MS;
        const status = insideResolutionCooldown
          ? "resolved"
          : previous?.status === "monitoring"
            ? "monitoring"
            : "open";
        return {
          alert_key: alert.alertKey,
          teacher_id: teacherId,
          class_id: alert.classId,
          student_id: alert.studentId,
          priority: alert.priority,
          priority_score: alert.priorityScore,
          signals: alert.signals,
          status,
          resolved_at: status === "resolved" ? previous?.resolved_at : null,
          last_detected_at: detectedAt,
          updated_at: detectedAt,
        };
      }),
      { onConflict: "alert_key" },
    );
    if (error) throw error;
  }

  const activeKeys = new Set(alerts.map((alert) => alert.alertKey));
  for (const stale of (existing ?? []).filter((row) =>
    row.status !== "resolved" && !activeKeys.has(String(row.alert_key)),
  )) {
    const { error } = await admin.from("student_support_alerts").update({
      status: "resolved",
      resolved_at: detectedAt,
      updated_at: detectedAt,
    }).eq("id", stale.id);
    if (error) throw error;
  }
  return alerts;
}

async function syncGrowthDataset(
  admin: AdminClient,
  dataset: GrowthDataset,
  teacherId: string,
  studentIds?: string[],
  syncSupportAlerts = true,
) {
  const allowedStudentIds = new Set(studentIds ?? dataset.students.map((item) => item.id));
  if (allowedStudentIds.size === 0) return;
  const storedXp = await syncXp(admin, dataset, allowedStudentIds);
  const tasks: Promise<unknown>[] = [
    syncTopicMastery(admin, dataset, allowedStudentIds),
    syncGoals(admin, dataset, allowedStudentIds, storedXp as Record<string, unknown>[]),
  ];
  if (syncSupportAlerts) tasks.push(syncAlerts(admin, dataset, teacherId, allowedStudentIds));
  await Promise.all(tasks);
}

async function loadGrowthSnapshot(admin: AdminClient, studentIds: string[]) {
  if (studentIds.length === 0) return { xp: [], badges: [], goals: [], topics: [], reports: [] };
  const [xp, badges, goals, topics, reports] = await Promise.all([
    admin.from("student_xp_events").select("student_id,points,occurred_at").in("student_id", studentIds),
    admin.from("student_badges").select("*").in("student_id", studentIds).order("awarded_at", { ascending: false }),
    admin.from("learning_goals").select("*").in("student_id", studentIds).order("period_end", { ascending: true }),
    admin.from("student_topic_mastery").select("*").in("student_id", studentIds).order("mastery_percent", { ascending: true }),
    admin.from("weekly_parent_reports").select("*").in("student_id", studentIds).order("week_start", { ascending: false }).limit(24),
  ]);
  const failed = [xp, badges, goals, topics, reports].find((response) => response.error);
  if (failed?.error) throw failed.error;
  return {
    xp: xp.data ?? [],
    badges: badges.data ?? [],
    goals: goals.data ?? [],
    topics: topics.data ?? [],
    reports: reports.data ?? [],
  };
}

function shapeStudentGrowth(student: GrowthStudent, snapshot: Awaited<ReturnType<typeof loadGrowthSnapshot>>) {
  const xpRows = snapshot.xp.filter((row) => String(row.student_id) === student.id);
  const totalXp = xpRows.reduce((sum, row) => sum + validNumber(row.points), 0);
  return {
    studentId: student.id,
    studentName: student.full_name,
    avatarUrl: student.avatar_url,
    xp: { total: totalXp, ...xpLevel(totalXp) },
    badges: snapshot.badges.filter((row) => String(row.student_id) === student.id).map((row) => ({
      id: String(row.id),
      code: String(row.badge_code),
      title: String(row.title),
      description: String(row.description),
      icon: String(row.icon),
      awardedAt: String(row.awarded_at),
    })),
    goals: snapshot.goals.filter((row) => String(row.student_id) === student.id).map((row) => ({
      id: String(row.id),
      classId: typeof row.class_id === "string" ? row.class_id : null,
      title: String(row.title),
      metric: String(row.metric),
      targetValue: validNumber(row.target_value),
      currentValue: validNumber(row.current_value),
      progressPercent: goalProgressPercent(validNumber(row.current_value), validNumber(row.target_value)),
      periodStart: String(row.period_start),
      periodEnd: String(row.period_end),
      status: String(row.status),
    })),
    weakTopics: snapshot.topics
      .filter((row) => String(row.student_id) === student.id && validNumber(row.incorrect_questions) > 0)
      .slice(0, 6)
      .map((row) => ({
        id: String(row.id),
        classId: String(row.class_id),
        topic: String(row.topic),
        totalQuestions: validNumber(row.total_questions),
        incorrectQuestions: validNumber(row.incorrect_questions),
        masteryPercent: validNumber(row.mastery_percent),
        recommendedResources: Array.isArray(row.recommended_resources) ? row.recommended_resources : [],
        lastExamTitle: typeof row.last_exam_title === "string" ? row.last_exam_title : null,
        lastExamAt: typeof row.last_exam_at === "string" ? row.last_exam_at : null,
      })),
    reports: snapshot.reports.filter((row) => String(row.student_id) === student.id).map((row) => ({
      id: String(row.id),
      teacherId: String(row.teacher_id),
      weekStart: String(row.week_start),
      weekEnd: String(row.week_end),
      summary: object(row.summary),
      teacherComment: typeof row.teacher_comment === "string" ? row.teacher_comment : null,
      deliveryStatus: String(row.delivery_status),
      deliveredAt: typeof row.delivered_at === "string" ? row.delivered_at : null,
    })),
  };
}

async function teacherClasses(admin: AdminClient, teacherId: string) {
  const { data, error } = await admin
    .from("classes")
    .select("id,class_name,subject,color,tutor_id,student_ids")
    .eq("tutor_id", teacherId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    class_name: String(row.class_name ?? "Lớp học"),
    subject: String(row.subject ?? ""),
    color: String(row.color ?? "#4f46e5"),
    tutor_id: typeof row.tutor_id === "string" ? row.tutor_id : null,
    student_ids: strings(row.student_ids),
  })) as GrowthClass[];
}

async function classesForStudents(admin: AdminClient, studentIds: string[]) {
  if (studentIds.length === 0) return [];
  const responses = await Promise.all(studentIds.map((studentId) =>
    admin.from("classes")
      .select("id,class_name,subject,color,tutor_id,student_ids")
      .contains("student_ids", [studentId]),
  ));
  const failed = responses.find((response) => response.error);
  if (failed?.error) throw failed.error;
  const byId = new Map<string, GrowthClass>();
  for (const row of responses.flatMap((response) => response.data ?? [])) {
    byId.set(String(row.id), {
      id: String(row.id),
      class_name: String(row.class_name ?? "Lớp học"),
      subject: String(row.subject ?? ""),
      color: String(row.color ?? "#4f46e5"),
      tutor_id: typeof row.tutor_id === "string" ? row.tutor_id : null,
      student_ids: strings(row.student_ids),
    });
  }
  return [...byId.values()];
}

export async function loadTeacherLearningSupport(teacherId: string) {
  const admin = createAdminClient();
  const classes = await teacherClasses(admin, teacherId);
  const dataset = await loadGrowthDataset(admin, classes);
  await syncGrowthDataset(admin, dataset, teacherId);
  const studentIds = dataset.students.map((item) => item.id);
  const [snapshot, alertsResponse] = await Promise.all([
    loadGrowthSnapshot(admin, studentIds),
    admin.from("student_support_alerts")
      .select("*")
      .eq("teacher_id", teacherId)
      .neq("status", "resolved")
      .order("priority_score", { ascending: false })
      .limit(20),
  ]);
  if (alertsResponse.error) throw alertsResponse.error;
  const studentById = new Map(dataset.students.map((item) => [item.id, item]));
  const classById = new Map(classes.map((item) => [item.id, item]));
  return {
    generatedAt: new Date().toISOString(),
    alerts: (alertsResponse.data ?? []).map((row) => ({
      id: String(row.id),
      studentId: String(row.student_id),
      studentName: studentById.get(String(row.student_id))?.full_name ?? "Học viên",
      avatarUrl: studentById.get(String(row.student_id))?.avatar_url ?? null,
      classId: String(row.class_id),
      className: classById.get(String(row.class_id))?.class_name ?? "Lớp học",
      priority: String(row.priority),
      priorityScore: validNumber(row.priority_score),
      signals: Array.isArray(row.signals) ? row.signals : [],
      status: String(row.status),
      lastDetectedAt: String(row.last_detected_at),
    })),
    weakTopics: snapshot.topics
      .filter((row) => validNumber(row.incorrect_questions) > 0)
      .slice(0, 12)
      .map((row) => ({
        id: String(row.id),
        studentId: String(row.student_id),
        studentName: studentById.get(String(row.student_id))?.full_name ?? "Học viên",
        classId: String(row.class_id),
        className: classById.get(String(row.class_id))?.class_name ?? "Lớp học",
        topic: String(row.topic),
        masteryPercent: validNumber(row.mastery_percent),
        incorrectQuestions: validNumber(row.incorrect_questions),
        totalQuestions: validNumber(row.total_questions),
        recommendedResources: Array.isArray(row.recommended_resources) ? row.recommended_resources : [],
      })),
    goals: snapshot.goals
      .filter((row) => row.status === "active" || row.status === "completed")
      .slice(0, 12)
      .map((row) => ({
        id: String(row.id),
        studentId: String(row.student_id),
        studentName: studentById.get(String(row.student_id))?.full_name ?? "Học viên",
        title: String(row.title),
        currentValue: validNumber(row.current_value),
        targetValue: validNumber(row.target_value),
        progressPercent: goalProgressPercent(validNumber(row.current_value), validNumber(row.target_value)),
        status: String(row.status),
        periodEnd: String(row.period_end),
      })),
    activeGoals: snapshot.goals.filter((row) => row.status === "active").length,
    reportsThisWeek: snapshot.reports.filter((row) =>
      String(row.week_start) === isoDate(mondayOfWeek(new Date(Date.now() - 7 * DAY_MS))),
    ).length,
  };
}

function latestSubmissionByHomework(dataset: GrowthDataset, studentId: string) {
  const latest = new Map<string, GrowthSubmission>();
  for (const submission of dataset.submissions.filter((item) => item.studentId === studentId)) {
    const current = latest.get(submission.homeworkId);
    if (!current || new Date(submission.submittedAt).getTime() > new Date(current.submittedAt).getTime()) {
      latest.set(submission.homeworkId, submission);
    }
  }
  return latest;
}

function validLatestTimestamp(values: (string | null | undefined)[]) {
  const timestamps = values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  return timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;
}

function normalizedRisk(
  row: Record<string, unknown> | undefined,
  student: GrowthStudent,
  classes: GrowthClass[],
): StudentRiskSummary | null {
  if (!row) return null;
  const classId = String(row.class_id ?? "");
  return {
    id: String(row.id),
    priority: ["high", "medium", "low"].includes(String(row.priority))
      ? String(row.priority) as StudentRiskSummary["priority"]
      : "low",
    priorityScore: validNumber(row.priority_score),
    status: String(row.status ?? "open"),
    classId,
    className: classes.find((item) => item.id === classId)?.class_name ?? "Lớp học",
    signals: Array.isArray(row.signals) ? row.signals as StudentRiskSummary["signals"] : [],
  };
}

function activeGoalsForStudent(
  student: GrowthStudent,
  snapshot: Awaited<ReturnType<typeof loadGrowthSnapshot>>,
) {
  return shapeStudentGrowth(student, snapshot).goals
    .filter((goal) => goal.status === "active" || goal.status === "completed")
    .map((goal) => goal as StudentActiveGoal);
}

function metricsForStudentClasses(
  dataset: GrowthDataset,
  studentId: string,
  classIds: Set<string>,
): StudentClassMetrics {
  const scores = dataset.scores.filter((item) => item.studentId === studentId && classIds.has(item.classId));
  const attendance = dataset.attendance.filter((item) => item.studentId === studentId && classIds.has(item.classId));
  const accountableAttendance = attendance.filter((item) => item.status !== "excused");
  const attended = accountableAttendance.filter((item) => isAttendedStatus(item.status));
  const present = attendance.filter((item) => item.status === "present").length;
  const online = attendance.filter((item) => item.status === "online").length;
  const late = attendance.filter((item) => item.status === "late").length;
  const homework = dataset.homework.filter((item) => classIds.has(item.classId) && assignedToStudent(item.assignedTo, studentId));
  const latestSubmissions = latestSubmissionByHomework(dataset, studentId);
  const now = Date.now();
  const dueHomework = homework.filter((item) => new Date(item.dueAt).getTime() <= now);
  const submitted = dueHomework.filter((item) => latestSubmissions.has(item.id));
  const onTime = dueHomework.filter((item) => {
    const submission = latestSubmissions.get(item.id);
    return submission && new Date(submission.submittedAt).getTime() <= new Date(item.dueAt).getTime();
  });
  const lateHomework = dueHomework.filter((item) => {
    const submission = latestSubmissions.get(item.id);
    return submission && new Date(submission.submittedAt).getTime() > new Date(item.dueAt).getTime();
  }).length;

  return {
    averageScore: scores.length > 0
      ? Math.round((scores.reduce((sum, item) => sum + item.value100 / 10, 0) / scores.length) * 10) / 10
      : null,
    assessmentCount: scores.length,
    attendanceRate: accountableAttendance.length > 0
      ? Math.round((attended.length / accountableAttendance.length) * 100)
      : null,
    punctualityRate: present + online + late > 0
      ? Math.round(((present + online) / (present + online + late)) * 100)
      : null,
    absences: attendance.filter((item) => item.status === "absent").length,
    lates: late,
    homeworkSubmittedRate: dueHomework.length > 0 ? Math.round((submitted.length / dueHomework.length) * 100) : null,
    homeworkOnTimeRate: dueHomework.length > 0 ? Math.round((onTime.length / dueHomework.length) * 100) : null,
    missingHomework: dueHomework.filter((item) => !latestSubmissions.has(item.id)).length,
    lateHomework,
  };
}

function shapeWorkspaceSummary(
  dataset: GrowthDataset,
  snapshot: Awaited<ReturnType<typeof loadGrowthSnapshot>>,
  alerts: Record<string, unknown>[],
  student: GrowthStudent,
): StudentWorkspaceSummary {
  const classes = dataset.classes.filter((item) => item.student_ids.includes(student.id));
  const classIds = new Set(classes.map((item) => item.id));
  const scores = dataset.scores.filter((item) => item.studentId === student.id && classIds.has(item.classId));
  const attendance = dataset.attendance.filter((item) => item.studentId === student.id && classIds.has(item.classId));
  const metrics = metricsForStudentClasses(dataset, student.id, classIds);
  const studentAlerts = alerts
    .filter((row) => String(row.student_id) === student.id)
    .sort((a, b) => validNumber(b.priority_score) - validNumber(a.priority_score));
  const goals = activeGoalsForStudent(student, snapshot);
  const activeGoal = goals
    .filter((goal) => goal.status === "active" && (!goal.classId || classIds.has(goal.classId)))
    .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd))[0] ?? null;
  const weakTopicCount = snapshot.topics.filter((row) =>
    String(row.student_id) === student.id
      && classIds.has(String(row.class_id))
      && validNumber(row.incorrect_questions) > 0,
  ).length;

  return {
    id: student.id,
    fullName: student.full_name,
    avatarUrl: student.avatar_url,
    grade: student.grade,
    school: student.school,
    learningType: student.learning_type,
    classes: classes.map((item) => ({
      id: item.id,
      name: item.class_name,
      subject: item.subject,
      color: item.color,
      package: dataset.packages[item.id]?.[student.id] ?? null,
    })),
    ...metrics,
    lastActivityAt: validLatestTimestamp([
      ...scores.map((item) => item.recordedAt),
      ...attendance.map((item) => `${item.date}T12:00:00+07:00`),
      ...dataset.submissions.filter((item) => item.studentId === student.id).map((item) => item.submittedAt),
      ...dataset.progress.filter((item) => item.studentId === student.id).map((item) => item.updatedAt),
    ]),
    risk: normalizedRisk(studentAlerts[0], student, classes),
    activeGoal,
    weakTopicCount,
    classMetrics: Object.fromEntries(classes.map((item) => [
      item.id,
      metricsForStudentClasses(dataset, student.id, new Set([item.id])),
    ])),
  };
}

async function loadTeacherWorkspaceBase(teacherId: string, studentId?: string) {
  const admin = createAdminClient();
  const allClasses = await teacherClasses(admin, teacherId);
  const classes = studentId
    ? allClasses.filter((item) => item.student_ids.includes(studentId))
    : allClasses;
  if (studentId && classes.length === 0) return null;
  const dataset = await loadGrowthDataset(admin, classes);
  await syncGrowthDataset(admin, dataset, teacherId);
  const studentIds = dataset.students.map((item) => item.id);
  const [snapshot, alertsResponse] = await Promise.all([
    loadGrowthSnapshot(admin, studentIds),
    studentIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : admin.from("student_support_alerts")
          .select("*")
          .eq("teacher_id", teacherId)
          .in("student_id", studentIds)
          .neq("status", "resolved")
          .order("priority_score", { ascending: false }),
  ]);
  if (alertsResponse.error) throw alertsResponse.error;
  return {
    dataset,
    snapshot,
    alerts: (alertsResponse.data ?? []) as Record<string, unknown>[],
  };
}

export async function loadTeacherStudentDirectory(teacherId: string) {
  const base = await loadTeacherWorkspaceBase(teacherId);
  if (!base) return { generatedAt: new Date().toISOString(), students: [] };
  return {
    generatedAt: new Date().toISOString(),
    students: base.dataset.students
      .map((student) => shapeWorkspaceSummary(base.dataset, base.snapshot, base.alerts, student))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "vi")),
  };
}

export async function loadTeacherStudentProfile(
  teacherId: string,
  studentId: string,
): Promise<StudentWorkspaceProfile | null> {
  const base = await loadTeacherWorkspaceBase(teacherId, studentId);
  if (!base) return null;
  const student = base.dataset.students.find((item) => item.id === studentId);
  if (!student) return null;
  const summary = shapeWorkspaceSummary(base.dataset, base.snapshot, base.alerts, student);
  const classIds = new Set(summary.classes.map((item) => item.id));
  const growth = shapeStudentGrowth(student, base.snapshot);
  const latestSubmissions = latestSubmissionByHomework(base.dataset, student.id);
  const now = Date.now();

  return {
    ...summary,
    scores: base.dataset.scores
      .filter((item) => item.studentId === student.id && classIds.has(item.classId))
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
      .map((item) => ({
        id: item.id,
        classId: item.classId,
        title: item.title,
        score: item.score,
        maxScore: item.maxScore,
        value10: Math.round((item.value100 / 10) * 100) / 100,
        recordedAt: item.recordedAt,
        source: item.source,
        reviewHref: item.reviewHref,
        canDelete: item.source === "teacher",
      })),
    attendance: base.dataset.attendance
      .filter((item) => item.studentId === student.id && classIds.has(item.classId))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((item) => ({ classId: item.classId, date: item.date, status: item.status })),
    homework: base.dataset.homework
      .filter((item) => classIds.has(item.classId) && assignedToStudent(item.assignedTo, student.id))
      .map((item) => {
        const submission = latestSubmissions.get(item.id) ?? null;
        const dueAt = new Date(item.dueAt).getTime();
        const submittedAt = submission ? new Date(submission.submittedAt).getTime() : null;
        const status = submission
          ? submittedAt !== null && submittedAt <= dueAt ? "on_time" as const : "late" as const
          : dueAt < now ? "missing" as const : "upcoming" as const;
        return {
          id: item.id,
          classId: item.classId,
          title: item.title,
          dueAt: item.dueAt,
          submittedAt: submission?.submittedAt ?? null,
          submissionId: submission?.id ?? null,
          score: submission?.score ?? null,
          feedback: submission?.feedback ?? null,
          status,
          gradingHref: `/teacher/homework?class=${encodeURIComponent(item.classId)}&homework=${encodeURIComponent(item.id)}&student=${encodeURIComponent(student.id)}`,
        };
      })
      .sort((a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime()),
    goals: growth.goals
      .filter((goal) => !goal.classId || classIds.has(goal.classId))
      .map((goal) => goal as StudentActiveGoal),
    weakTopics: growth.weakTopics.filter((topic) => classIds.has(topic.classId)),
    badges: growth.badges,
    xp: growth.xp,
    reports: growth.reports.filter((report) => report.teacherId === teacherId).map((report) => ({
      id: report.id,
      weekStart: report.weekStart,
      weekEnd: report.weekEnd,
      deliveryStatus: report.deliveryStatus,
      deliveredAt: report.deliveredAt,
      teacherComment: report.teacherComment,
    })),
  };
}

export async function loadStudentLearningGrowth(studentId: string) {
  const admin = createAdminClient();
  const classes = await classesForStudents(admin, [studentId]);
  const dataset = await loadGrowthDataset(admin, classes);
  const teacherId = classes.find((item) => item.tutor_id)?.tutor_id ?? "system";
  await syncGrowthDataset(admin, dataset, teacherId, [studentId], false);
  const snapshot = await loadGrowthSnapshot(admin, [studentId]);
  const student = dataset.students.find((item) => item.id === studentId);
  if (!student) throw new Error("student_not_found");
  return shapeStudentGrowth(student, snapshot);
}

export async function loadParentLearningGrowth(parentId: string) {
  const admin = createAdminClient();
  const studentIds = await getActiveChildIdsForParent(admin, parentId);
  if (studentIds.length === 0) return { generatedAt: new Date().toISOString(), children: [] };
  const classes = await classesForStudents(admin, studentIds);
  const dataset = await loadGrowthDataset(admin, classes);
  const classesByTeacher = new Map<string, GrowthClass[]>();
  for (const classItem of classes) {
    const teacherId = classItem.tutor_id ?? "system";
    classesByTeacher.set(teacherId, [...(classesByTeacher.get(teacherId) ?? []), classItem]);
  }
  for (const [teacherId, scopedClasses] of classesByTeacher) {
    const scopedDataset: GrowthDataset = {
      ...dataset,
      classes: scopedClasses,
      students: dataset.students.filter((student) => scopedClasses.some((item) => item.student_ids.includes(student.id))),
    };
    await syncGrowthDataset(admin, scopedDataset, teacherId, studentIds);
  }
  const snapshot = await loadGrowthSnapshot(admin, studentIds);
  return {
    generatedAt: new Date().toISOString(),
    children: dataset.students
      .filter((student) => studentIds.includes(student.id))
      .map((student) => shapeStudentGrowth(student, snapshot)),
  };
}

export async function createLearningGoal(input: {
  studentId: string;
  classId: string | null;
  title: string;
  metric: GoalMetric;
  targetValue: number;
  periodStart: string;
  periodEnd: string;
  createdByUserId: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("learning_goals").insert({
    student_id: input.studentId,
    class_id: input.classId,
    title: input.title,
    metric: input.metric,
    target_value: input.targetValue,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    created_by_user_id: input.createdByUserId,
  }).select("*").single();
  if (error) throw error;
  return data;
}

export async function cancelLearningGoal(studentId: string, goalId: string) {
  const { data, error } = await createAdminClient().from("learning_goals").update({
    status: "cancelled",
    updated_at: new Date().toISOString(),
  }).eq("id", goalId).eq("student_id", studentId).select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function updateSupportAlertStatus(teacherId: string, alertId: string, status: "open" | "monitoring" | "resolved") {
  const now = new Date().toISOString();
  const { data, error } = await createAdminClient().from("student_support_alerts").update({
    status,
    resolved_at: status === "resolved" ? now : null,
    updated_at: now,
  }).eq("id", alertId).eq("teacher_id", teacherId).select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function generateWeeklyReportsForTeacher(
  teacherId: string,
  referenceDate = new Date(Date.now() - 7 * DAY_MS),
  onlyStudentId?: string,
) {
  const admin = createAdminClient();
  const classes = await teacherClasses(admin, teacherId);
  const dataset = await loadGrowthDataset(admin, classes);
  await syncGrowthDataset(admin, dataset, teacherId);
  const reportStudents = onlyStudentId
    ? dataset.students.filter((item) => item.id === onlyStudentId)
    : dataset.students;
  const studentIds = reportStudents.map((item) => item.id);
  if (studentIds.length === 0) return { generated: 0, weekStart: null, weekEnd: null };
  const weekStartDate = mondayOfWeek(referenceDate);
  const weekEndDate = new Date(weekStartDate.getTime() + 6 * DAY_MS);
  const weekStart = isoDate(weekStartDate);
  const weekEnd = isoDate(weekEndDate);
  const snapshot = await loadGrowthSnapshot(admin, studentIds);
  const rows = reportStudents.map((student) => {
    const studentClasses = classes.filter((item) => item.student_ids.includes(student.id));
    const classIds = new Set(studentClasses.map((item) => item.id));
    const attendance = dataset.attendance.filter((item) =>
      item.studentId === student.id && classIds.has(item.classId) && inRange(item.date, weekStart, weekEnd),
    );
    const homework = dataset.homework.filter((item) =>
      classIds.has(item.classId) && assignedToStudent(item.assignedTo, student.id) && inRange(item.dueAt, weekStart, weekEnd),
    );
    const submittedIds = new Set(dataset.submissions
      .filter((item) => item.studentId === student.id && inRange(item.submittedAt, weekStart, weekEnd))
      .map((item) => item.homeworkId));
    const scores = dataset.scores.filter((item) =>
      item.studentId === student.id && classIds.has(item.classId) && inRange(item.recordedAt, weekStart, weekEnd),
    );
    const completedLessons = dataset.progress.filter((item) =>
      item.studentId === student.id && item.completed && classIds.has(item.classId) && inRange(item.updatedAt, weekStart, weekEnd),
    ).length;
    const xpEarned = snapshot.xp.filter((item) =>
      String(item.student_id) === student.id && inRange(String(item.occurred_at), weekStart, weekEnd),
    ).reduce((sum, item) => sum + validNumber(item.points), 0);
    const feedback = [
      ...dataset.submissions
        .filter((item) => item.studentId === student.id && item.feedback && inRange(item.submittedAt, weekStart, weekEnd))
        .map((item) => item.feedback as string),
      ...dataset.onlineResults
        .filter((item) => item.result.student_id === student.id && item.result.teacher_feedback && inRange(item.result.submitted_at, weekStart, weekEnd))
        .map((item) => item.result.teacher_feedback as string),
    ].slice(0, 3);
    const activeGoals = snapshot.goals.filter((item) => String(item.student_id) === student.id && item.status === "active");
    return {
      teacher_id: teacherId,
      student_id: student.id,
      week_start: weekStart,
      week_end: weekEnd,
      summary: {
        attendance: {
          present: attendance.filter((item) => item.status === "present").length,
          online: attendance.filter((item) => item.status === "online").length,
          late: attendance.filter((item) => item.status === "late").length,
          absent: attendance.filter((item) => item.status === "absent").length,
          total: attendance.filter((item) => item.status !== "excused").length,
        },
        homework: { assigned: homework.length, submitted: homework.filter((item) => submittedIds.has(item.id)).length },
        scores: {
          count: scores.length,
          average: scores.length > 0
            ? Math.round((scores.reduce((sum, item) => sum + item.value100 / 10, 0) / scores.length) * 10) / 10
            : null,
        },
        completedLessons,
        xpEarned,
        activeGoals: activeGoals.map((goal) => ({
          title: goal.title,
          currentValue: validNumber(goal.current_value),
          targetValue: validNumber(goal.target_value),
        })),
        feedback,
        classes: studentClasses.map((item) => ({ id: item.id, name: item.class_name })),
      },
      teacher_comment: feedback[0] ?? null,
      delivery_channel: "notification",
      delivery_status: "delivered",
      delivered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
  const { error } = await admin.from("weekly_parent_reports").upsert(rows, {
    onConflict: "teacher_id,student_id,week_start",
  });
  if (error) throw error;
  return { generated: rows.length, weekStart, weekEnd };
}

export async function generateAllWeeklyReports(referenceDate = new Date(Date.now() - 7 * DAY_MS)) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("teachers").select("id");
  if (error) throw error;
  const results: Awaited<ReturnType<typeof generateWeeklyReportsForTeacher>>[] = [];
  for (const batch of chunks(data ?? [], 3)) {
    results.push(...await Promise.all(
      batch.map((teacher) => generateWeeklyReportsForTeacher(String(teacher.id), referenceDate)),
    ));
  }
  return {
    teachers: results.length,
    reports: results.reduce((sum, result) => sum + result.generated, 0),
  };
}
