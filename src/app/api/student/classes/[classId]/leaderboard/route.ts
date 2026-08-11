import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import {
  applyStudentLeaderboardPrivacy,
  leaderboardStudentIds,
  loadClassLeaderboard,
  loadClassLeaderboardSettings,
  loadLeaderboardClassScope,
} from "@/lib/class-leaderboard-server";

const PRIVATE_NO_STORE = {
  headers: { "Cache-Control": "private, no-store" },
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const identity = await getRequestIdentity(req);
  if (identity?.role !== "student" || !identity.studentId) {
    return NextResponse.json(
      { error: "student_authorization_required" },
      { status: 403, ...PRIVATE_NO_STORE },
    );
  }

  const { classId } = await params;
  if (!classId || classId.length > 120) {
    return NextResponse.json(
      { error: "invalid_class_id" },
      { status: 400, ...PRIVATE_NO_STORE },
    );
  }

  try {
    const classScope = await loadLeaderboardClassScope(classId);
    if (!classScope) {
      return NextResponse.json(
        { error: "not_found" },
        { status: 404, ...PRIVATE_NO_STORE },
      );
    }
    if (!leaderboardStudentIds(classScope).includes(identity.studentId)) {
      return NextResponse.json(
        { error: "forbidden" },
        { status: 403, ...PRIVATE_NO_STORE },
      );
    }

    const settings = await loadClassLeaderboardSettings(classId);
    if (!settings.enabled) {
      return NextResponse.json({
        classId,
        generatedAt: new Date().toISOString(),
        settings,
        entries: [],
        classAverage: null,
        scoredStudents: 0,
        totalStudents: 0,
      }, PRIVATE_NO_STORE);
    }
    const leaderboard = await loadClassLeaderboard(classScope, {
        studentId: identity.studentId,
        displayName: identity.displayName,
      }, settings);
    return NextResponse.json(
      applyStudentLeaderboardPrivacy(leaderboard, identity.studentId),
      PRIVATE_NO_STORE,
    );
  } catch {
    return NextResponse.json(
      { error: "leaderboard_unavailable" },
      { status: 500, ...PRIVATE_NO_STORE },
    );
  }
}
