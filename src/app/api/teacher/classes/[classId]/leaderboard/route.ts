import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import {
  loadClassLeaderboard,
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
  if (!identity || (identity.role !== "teacher" && identity.role !== "admin")) {
    return NextResponse.json(
      { error: "teacher_authorization_required" },
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
    if (identity.role === "teacher" && classScope.tutor_id !== identity.teacherId) {
      return NextResponse.json(
        { error: "forbidden" },
        { status: 403, ...PRIVATE_NO_STORE },
      );
    }

    return NextResponse.json(
      await loadClassLeaderboard(classScope),
      PRIVATE_NO_STORE,
    );
  } catch {
    return NextResponse.json(
      { error: "leaderboard_unavailable" },
      { status: 500, ...PRIVATE_NO_STORE },
    );
  }
}
