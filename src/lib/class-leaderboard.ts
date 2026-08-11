export interface LeaderboardStudent {
  id: string;
  fullName: string;
  avatarUrl: string;
}

export interface LeaderboardScoreSample {
  studentId: string;
  score: number;
  maxScore: number;
  recordedAt?: string | null;
}

export type LeaderboardPeriod = "all_time" | "last_7_days" | "last_30_days" | "term";
export type LeaderboardPrivacyMode = "full_name" | "abbreviated" | "anonymous";

export interface ClassLeaderboardSettings {
  enabled: boolean;
  period: LeaderboardPeriod;
  termStartDate: string | null;
  minimumAssessments: number;
  privacyMode: LeaderboardPrivacyMode;
  updatedAt: string | null;
}

export const DEFAULT_CLASS_LEADERBOARD_SETTINGS: ClassLeaderboardSettings = {
  enabled: true,
  period: "all_time",
  termStartDate: null,
  minimumAssessments: 1,
  privacyMode: "full_name",
  updatedAt: null,
};

export interface ClassLeaderboardEntry {
  studentId: string;
  displayName: string;
  avatarUrl: string;
  rank: number | null;
  averageScore: number | null;
  assessments: number;
  lastActivity: string | null;
  isCurrentStudent: boolean;
  eligibleForRanking: boolean;
}

export interface ClassLeaderboardSummary {
  entries: ClassLeaderboardEntry[];
  classAverage: number | null;
  scoredStudents: number;
  totalStudents: number;
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizedScore(sample: LeaderboardScoreSample) {
  if (
    !Number.isFinite(sample.score)
    || !Number.isFinite(sample.maxScore)
    || sample.maxScore <= 0
  ) {
    return null;
  }
  return Math.min(100, Math.max(0, (sample.score / sample.maxScore) * 100));
}

export function filterLeaderboardSamplesForPeriod(
  samples: LeaderboardScoreSample[],
  settings: ClassLeaderboardSettings,
  now = new Date(),
) {
  let startsAt: Date | null = null;
  if (settings.period === "last_7_days") {
    startsAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000);
  } else if (settings.period === "last_30_days") {
    startsAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
  } else if (settings.period === "term" && settings.termStartDate) {
    startsAt = new Date(`${settings.termStartDate}T00:00:00.000Z`);
  }

  if (!startsAt || Number.isNaN(startsAt.getTime())) return samples;
  return samples.filter((sample) => {
    if (!sample.recordedAt) return false;
    const recordedAt = new Date(sample.recordedAt);
    return !Number.isNaN(recordedAt.getTime()) && recordedAt >= startsAt;
  });
}

export function buildClassLeaderboard(
  students: LeaderboardStudent[],
  samples: LeaderboardScoreSample[],
  currentStudentId: string,
  options: { minimumAssessments?: number } = {},
): ClassLeaderboardSummary {
  const minimumAssessments = Math.max(1, Math.floor(options.minimumAssessments ?? 1));
  const samplesByStudent = new Map<string, LeaderboardScoreSample[]>();
  const studentIds = new Set(students.map((student) => student.id));

  for (const sample of samples) {
    if (!studentIds.has(sample.studentId) || normalizedScore(sample) === null) continue;
    const existing = samplesByStudent.get(sample.studentId) ?? [];
    existing.push(sample);
    samplesByStudent.set(sample.studentId, existing);
  }

  const collator = new Intl.Collator("vi", { sensitivity: "base" });
  const entries = students.map<ClassLeaderboardEntry>((student) => {
    const studentSamples = samplesByStudent.get(student.id) ?? [];
    const scoreValues = studentSamples
      .map(normalizedScore)
      .filter((score): score is number => score !== null);
    const averageScore = scoreValues.length > 0
      ? roundToOne(scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length)
      : null;
    const dates = studentSamples
      .map((sample) => sample.recordedAt)
      .filter((date): date is string => typeof date === "string" && date.length > 0)
      .sort((a, b) => b.localeCompare(a));

    return {
      studentId: student.id,
      displayName: student.fullName,
      avatarUrl: student.avatarUrl,
      rank: null,
      averageScore,
      assessments: scoreValues.length,
      lastActivity: dates[0] ?? null,
      isCurrentStudent: student.id === currentStudentId,
      eligibleForRanking: averageScore !== null && scoreValues.length >= minimumAssessments,
    };
  });

  entries.sort((a, b) => {
    if (a.eligibleForRanking !== b.eligibleForRanking) return a.eligibleForRanking ? -1 : 1;
    if (a.averageScore === null) return b.averageScore === null
      ? collator.compare(a.displayName, b.displayName)
      : 1;
    if (b.averageScore === null) return -1;
    return b.averageScore - a.averageScore
      || b.assessments - a.assessments
      || collator.compare(a.displayName, b.displayName);
  });

  let previousScore: number | null = null;
  let previousAssessments: number | null = null;
  let previousRank = 0;
  entries.forEach((entry, index) => {
    if (!entry.eligibleForRanking || entry.averageScore === null) return;
    if (
      previousScore === entry.averageScore
      && previousAssessments === entry.assessments
    ) {
      entry.rank = previousRank;
      return;
    }
    previousRank = index + 1;
    previousScore = entry.averageScore;
    previousAssessments = entry.assessments;
    entry.rank = previousRank;
  });

  const scoredEntries = entries.filter(
    (entry): entry is ClassLeaderboardEntry & { averageScore: number } =>
      entry.averageScore !== null,
  );
  const classAverage = scoredEntries.length > 0
    ? roundToOne(
        scoredEntries.reduce((sum, entry) => sum + entry.averageScore, 0)
        / scoredEntries.length,
      )
    : null;

  return {
    entries,
    classAverage,
    scoredStudents: scoredEntries.length,
    totalStudents: entries.length,
  };
}
