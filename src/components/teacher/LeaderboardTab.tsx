"use client";

import ClassLeaderboardTab from "@/components/student/StudentLeaderboardTab";

export default function LeaderboardTab({ classId }: { classId: string }) {
  return <ClassLeaderboardTab classId={classId} audience="teacher" />;
}
