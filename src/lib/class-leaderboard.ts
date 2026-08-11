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

export interface ClassLeaderboardEntry {
  studentId: string;
  displayName: string;
  avatarUrl: string;
  rank: number | null;
  averageScore: number | null;
  assessments: number;
  lastActivity: string | null;
  isCurrentStudent: boolean;
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

export function buildClassLeaderboard(
  students: LeaderboardStudent[],
  samples: LeaderboardScoreSample[],
  currentStudentId: string,
): ClassLeaderboardSummary {
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
    };
  });

  entries.sort((a, b) => {
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
    if (entry.averageScore === null) return;
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
