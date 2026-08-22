import { cachedJsonFetch, invalidateClientQueries } from "@/lib/client-query-cache";

export type StudentRiskPriority = "high" | "medium" | "low";
export type StudentWorkspaceTab =
  | "overview"
  | "scores"
  | "attendance"
  | "homework"
  | "notes"
  | "family";

export type StudentSupportSignal = {
  type: "score_drop" | "absence" | "late" | "homework" | string;
  title: string;
  detail: string;
  value: number;
};

export type StudentClassSummary = {
  id: string;
  name: string;
  subject: string;
  color: string;
  package: "online" | "advanced" | "offline" | null;
};

export type StudentActiveGoal = {
  id: string;
  classId: string | null;
  title: string;
  metric: string;
  currentValue: number;
  targetValue: number;
  progressPercent: number;
  status: string;
  periodEnd: string;
};

export type StudentRiskSummary = {
  id: string;
  priority: StudentRiskPriority;
  priorityScore: number;
  status: "open" | "monitoring" | string;
  classId: string;
  className: string;
  signals: StudentSupportSignal[];
};

export type StudentClassMetrics = {
  averageScore: number | null;
  assessmentCount: number;
  attendanceRate: number | null;
  punctualityRate: number | null;
  absences: number;
  lates: number;
  homeworkSubmittedRate: number | null;
  homeworkOnTimeRate: number | null;
  missingHomework: number;
  lateHomework: number;
};

export type StudentWorkspaceSummary = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  grade: string;
  school: string;
  learningType: string;
  classes: StudentClassSummary[];
  averageScore: number | null;
  assessmentCount: number;
  attendanceRate: number | null;
  punctualityRate: number | null;
  absences: number;
  lates: number;
  homeworkSubmittedRate: number | null;
  homeworkOnTimeRate: number | null;
  missingHomework: number;
  lateHomework: number;
  lastActivityAt: string | null;
  risk: StudentRiskSummary | null;
  activeGoal: StudentActiveGoal | null;
  weakTopicCount: number;
  classMetrics: Record<string, StudentClassMetrics>;
};

export type StudentScoreRecord = {
  id: string;
  classId: string;
  title: string;
  score: number;
  maxScore: number;
  value10: number;
  recordedAt: string;
  source: "teacher" | "online";
  reviewHref: string | null;
  canDelete: boolean;
};

export type StudentAttendanceRecord = {
  classId: string;
  date: string;
  status: "present" | "online" | "absent" | "late" | "excused";
};

export type StudentHomeworkRecord = {
  id: string;
  classId: string;
  title: string;
  dueAt: string;
  submittedAt: string | null;
  submissionId: string | null;
  score: number | null;
  feedback: string | null;
  status: "on_time" | "late" | "missing" | "upcoming";
  gradingHref: string;
};

export type StudentWeakTopic = {
  id: string;
  classId: string;
  topic: string;
  totalQuestions: number;
  incorrectQuestions: number;
  masteryPercent: number;
  lastExamTitle: string | null;
  lastExamAt: string | null;
  recommendedResources: {
    classId?: string;
    lessonId?: string;
    title?: string;
    type?: string;
  }[];
};

export type StudentBadge = {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  awardedAt: string;
};

export type StudentWeeklyReport = {
  id: string;
  weekStart: string;
  weekEnd: string;
  deliveryStatus: string;
  deliveredAt: string | null;
  teacherComment: string | null;
};

export type StudentWorkspaceProfile = StudentWorkspaceSummary & {
  scores: StudentScoreRecord[];
  attendance: StudentAttendanceRecord[];
  homework: StudentHomeworkRecord[];
  goals: StudentActiveGoal[];
  weakTopics: StudentWeakTopic[];
  badges: StudentBadge[];
  xp: {
    total: number;
    level: number;
    currentLevelXp: number;
    nextLevelXp: number;
    progressPercent: number;
  };
  reports: StudentWeeklyReport[];
};

export type TeacherStudentDirectoryPayload = {
  generatedAt: string;
  students: StudentWorkspaceSummary[];
};

const STUDENT_WORKSPACE_TTL_MS = 5 * 60_000;

type StudentWorkspaceFetchOptions = {
  refresh?: boolean;
  signal?: AbortSignal;
};

function invalidateStudentWorkspace(studentId?: string) {
  invalidateClientQueries("teacher-student-directory");
  invalidateClientQueries(
    studentId ? `teacher-student-profile:${studentId}` : "teacher-student-profile:",
  );
}

async function synchronizeStudentWorkspace(studentId?: string) {
  const response = await fetch("/api/teacher/students", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "refresh_workspace",
      ...(studentId ? { studentId } : {}),
    }),
  });
  if (!response.ok) throw new Error("student_workspace_refresh_failed");
}

export async function fetchTeacherStudentDirectory(
  options: StudentWorkspaceFetchOptions = {},
) {
  if (options.refresh) {
    await synchronizeStudentWorkspace();
    invalidateStudentWorkspace();
  }
  return cachedJsonFetch<TeacherStudentDirectoryPayload>(
    "teacher-student-directory",
    "/api/teacher/students",
    {
      cache: "no-store",
      credentials: "same-origin",
      signal: options.signal,
    },
    STUDENT_WORKSPACE_TTL_MS,
  );
}

export async function fetchTeacherStudentProfile(
  studentId: string,
  options: StudentWorkspaceFetchOptions = {},
) {
  if (options.refresh) {
    await synchronizeStudentWorkspace(studentId);
    invalidateStudentWorkspace(studentId);
  }
  const params = new URLSearchParams({ student_id: studentId });
  try {
    return await cachedJsonFetch<StudentWorkspaceProfile>(
      `teacher-student-profile:${studentId}`,
      `/api/teacher/students?${params.toString()}`,
      {
        cache: "no-store",
        credentials: "same-origin",
        signal: options.signal,
      },
      STUDENT_WORKSPACE_TTL_MS,
    );
  } catch (error) {
    if ((error as { status?: number }).status === 404) throw new Error("student_not_found");
    throw new Error("student_profile_unavailable");
  }
}
