import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import {
  loadClassLeaderboard,
  loadClassLeaderboardSettings,
  loadLeaderboardClassScope,
  saveClassLeaderboardSettings,
} from "@/lib/class-leaderboard-server";
import type {
  ClassLeaderboardSettings,
  LeaderboardPeriod,
  LeaderboardPrivacyMode,
} from "@/lib/class-leaderboard";
import { hasValidMutationOrigin } from "@/lib/request-security";

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

    const settings = await loadClassLeaderboardSettings(classId);
    return NextResponse.json(
      await loadClassLeaderboard(classScope, {}, settings),
      PRIVATE_NO_STORE,
    );
  } catch {
    return NextResponse.json(
      { error: "leaderboard_unavailable" },
      { status: 500, ...PRIVATE_NO_STORE },
    );
  }
}

const PERIODS = new Set<LeaderboardPeriod>(["all_time", "last_7_days", "last_30_days", "term"]);
const PRIVACY_MODES = new Set<LeaderboardPrivacyMode>(["full_name", "abbreviated", "anonymous"]);

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json(
      { error: "invalid_origin" },
      { status: 403, ...PRIVATE_NO_STORE },
    );
  }
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

  let body: Partial<ClassLeaderboardSettings>;
  try {
    body = await req.json() as Partial<ClassLeaderboardSettings>;
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400, ...PRIVATE_NO_STORE },
    );
  }
  const period = body.period as LeaderboardPeriod;
  const privacyMode = body.privacyMode as LeaderboardPrivacyMode;
  const termStartDate = body.termStartDate === null ? null : body.termStartDate;
  if (
    typeof body.enabled !== "boolean"
    || !PERIODS.has(period)
    || !PRIVACY_MODES.has(privacyMode)
    || !Number.isInteger(body.minimumAssessments)
    || (body.minimumAssessments ?? 0) < 1
    || (body.minimumAssessments ?? 0) > 20
    || (termStartDate !== null && (typeof termStartDate !== "string" || !validDate(termStartDate)))
    || (period === "term" && termStartDate === null)
  ) {
    return NextResponse.json(
      { error: "invalid_leaderboard_settings" },
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

    const settings = await saveClassLeaderboardSettings(classId, {
      enabled: body.enabled,
      period,
      termStartDate: period === "term" ? termStartDate : null,
      minimumAssessments: body.minimumAssessments!,
      privacyMode,
    }, identity.userId);
    return NextResponse.json(settings, PRIVATE_NO_STORE);
  } catch {
    return NextResponse.json(
      { error: "leaderboard_settings_save_failed" },
      { status: 500, ...PRIVATE_NO_STORE },
    );
  }
}
