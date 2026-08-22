export type SupportPriority = "high" | "medium" | "low";
export type SupportSignalType = "score_drop" | "absence" | "late" | "homework";
export type GoalMetric =
  | "homework_completed"
  | "average_score"
  | "attendance_rate"
  | "lessons_completed"
  | "xp_earned";

export interface SupportSignal {
  type: SupportSignalType;
  title: string;
  detail: string;
  value: number;
}

export interface SupportStudentSnapshot {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  scores: { value: number; recordedAt: string }[];
  attendance: { status: "present" | "online" | "absent" | "late" | "excused"; date: string }[];
  homework: { dueAt: string; submittedAt: string | null }[];
}

export interface DetectedSupportAlert {
  alertKey: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  priority: SupportPriority;
  priorityScore: number;
  signals: SupportSignal[];
}

const DAY_MS = 86_400_000;

function average(values: number[]) {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function withinDays(value: string, now: Date, days: number) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp >= now.getTime() - days * DAY_MS;
}

export function detectSupportAlert(
  snapshot: SupportStudentSnapshot,
  now = new Date(),
): DetectedSupportAlert | null {
  const signals: SupportSignal[] = [];
  const scores = [...snapshot.scores]
    .filter((score) => Number.isFinite(score.value))
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .slice(-6);

  if (scores.length >= 4 && withinDays(scores[scores.length - 1].recordedAt, now, 45)) {
    const recent = average(scores.slice(-2).map((score) => score.value));
    const previous = average(scores.slice(-4, -2).map((score) => score.value));
    const drop = Math.round((previous - recent) * 10) / 10;
    if (drop >= 8) {
      signals.push({
        type: "score_drop",
        title: "Điểm số đang giảm",
        detail: `Trung bình 2 bài gần nhất giảm ${drop.toFixed(1)} điểm phần trăm.`,
        value: drop,
      });
    }
  }

  const recentAttendance = snapshot.attendance.filter((record) => withinDays(record.date, now, 30));
  const absences = recentAttendance.filter((record) => record.status === "absent").length;
  const late = recentAttendance.filter((record) => record.status === "late").length;
  if (absences >= 2) {
    signals.push({
      type: "absence",
      title: "Vắng học nhiều",
      detail: `${absences} buổi vắng trong 30 ngày gần nhất.`,
      value: absences,
    });
  }
  if (late >= 3) {
    signals.push({
      type: "late",
      title: "Đi học muộn liên tục",
      detail: `${late} lần đi muộn trong 30 ngày gần nhất.`,
      value: late,
    });
  }

  const overdueHomework = snapshot.homework.filter((item) => {
    if (!withinDays(item.dueAt, now, 30)) return false;
    const dueAt = new Date(item.dueAt).getTime();
    if (dueAt > now.getTime()) return false;
    return !item.submittedAt || new Date(item.submittedAt).getTime() > dueAt;
  }).length;
  if (overdueHomework >= 2) {
    signals.push({
      type: "homework",
      title: "Bài tập trễ hạn",
      detail: `${overdueHomework} bài thiếu hoặc nộp trễ trong 30 ngày gần nhất.`,
      value: overdueHomework,
    });
  }

  if (signals.length === 0) return null;
  const priorityScore = signals.reduce((score, signal) => {
    if (signal.type === "score_drop") return score + Math.min(45, Math.round(signal.value * 2));
    if (signal.type === "absence") return score + signal.value * 15;
    if (signal.type === "late") return score + signal.value * 8;
    return score + signal.value * 12;
  }, 0);
  const priority: SupportPriority = priorityScore >= 55 || signals.length >= 3
    ? "high"
    : priorityScore >= 28 || signals.length >= 2
      ? "medium"
      : "low";

  return {
    alertKey: `${snapshot.classId}:${snapshot.studentId}`,
    studentId: snapshot.studentId,
    studentName: snapshot.studentName,
    classId: snapshot.classId,
    className: snapshot.className,
    priority,
    priorityScore,
    signals,
  };
}

export interface GoalProgressInputs {
  homeworkCompleted: number;
  averageScore: number;
  attendanceRate: number;
  lessonsCompleted: number;
  xpEarned: number;
}

export function currentValueForGoal(metric: GoalMetric, inputs: GoalProgressInputs) {
  switch (metric) {
    case "homework_completed": return inputs.homeworkCompleted;
    case "average_score": return inputs.averageScore;
    case "attendance_rate": return inputs.attendanceRate;
    case "lessons_completed": return inputs.lessonsCompleted;
    case "xp_earned": return inputs.xpEarned;
  }
}

export function goalProgressPercent(currentValue: number, targetValue: number) {
  if (!Number.isFinite(targetValue) || targetValue <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((currentValue / targetValue) * 100)));
}

export const BADGE_CATALOG = [
  {
    code: "first_steps",
    title: "Khởi đầu tích cực",
    description: "Đạt ít nhất 20 XP từ hoạt động học tập.",
    icon: "sparkles",
  },
  {
    code: "on_time_5",
    title: "Đúng hạn",
    description: "Hoàn thành 5 bài tập đúng hạn.",
    icon: "clock",
  },
  {
    code: "attendance_star",
    title: "Chuyên cần",
    description: "Có mặt đầy đủ trong 5 buổi học.",
    icon: "calendar-check",
  },
  {
    code: "comeback",
    title: "Bứt phá",
    description: "Cải thiện điểm số rõ rệt so với bài trước.",
    icon: "trending-up",
  },
  {
    code: "xp_500",
    title: "Ngôi sao 500 XP",
    description: "Tích lũy 500 XP học tập.",
    icon: "star",
  },
] as const;

export function xpLevel(totalXp: number) {
  const safeXp = Math.max(0, Math.floor(totalXp));
  const level = Math.floor(safeXp / 250) + 1;
  const currentLevelXp = safeXp % 250;
  return {
    level,
    currentLevelXp,
    nextLevelXp: 250,
    progressPercent: Math.round((currentLevelXp / 250) * 100),
  };
}
