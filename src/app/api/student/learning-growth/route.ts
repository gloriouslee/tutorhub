import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { hasValidMutationOrigin } from "@/lib/request-security";
import {
  cancelLearningGoal,
  createLearningGoal,
  loadStudentLearningGrowth,
} from "@/lib/learning-growth-server";
import type { GoalMetric } from "@/lib/learning-growth";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/rate-limit";

const PRIVATE_NO_STORE = { headers: { "Cache-Control": "private, no-store" } };
const GOAL_METRICS = new Set<GoalMetric>([
  "homework_completed",
  "average_score",
  "attendance_rate",
  "lessons_completed",
  "xp_earned",
]);

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function GET(req: NextRequest) {
  const identity = await getRequestIdentity(req);
  if (!identity?.studentId || identity.role !== "student") {
    return NextResponse.json({ error: "student_authorization_required" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  try {
    return NextResponse.json(await loadStudentLearningGrowth(identity.studentId), PRIVATE_NO_STORE);
  } catch {
    return NextResponse.json({ error: "learning_growth_unavailable" }, { status: 500, ...PRIVATE_NO_STORE });
  }
}

export async function POST(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  const identity = await getRequestIdentity(req);
  if (!identity?.studentId || identity.role !== "student") {
    return NextResponse.json({ error: "student_authorization_required" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  if (!await consumeRateLimit({
    scope: "learning-goal-create",
    key: identity.userId,
    limit: 10,
    windowSeconds: 3600,
  })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, ...PRIVATE_NO_STORE });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, ...PRIVATE_NO_STORE });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const metric = body.metric as GoalMetric;
  const targetValue = Number(body.targetValue);
  const periodStart = body.periodStart;
  const periodEnd = body.periodEnd;
  const classId = body.classId === null || body.classId === "" ? null : body.classId;
  if (
    title.length < 3 || title.length > 160
    || !GOAL_METRICS.has(metric)
    || !Number.isFinite(targetValue) || targetValue <= 0 || targetValue > 10_000
    || !validDate(periodStart) || !validDate(periodEnd)
    || new Date(periodEnd).getTime() < new Date(periodStart).getTime()
    || new Date(periodEnd).getTime() - new Date(periodStart).getTime() > 90 * 86_400_000
    || (classId !== null && (typeof classId !== "string" || classId.length > 120))
  ) {
    return NextResponse.json({ error: "invalid_learning_goal" }, { status: 400, ...PRIVATE_NO_STORE });
  }
  if (classId) {
    const { data, error } = await createAdminClient().from("classes")
      .select("id")
      .eq("id", classId)
      .contains("student_ids", [identity.studentId])
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: "class_access_denied" }, { status: 403, ...PRIVATE_NO_STORE });
    }
  }
  try {
    const goal = await createLearningGoal({
      studentId: identity.studentId,
      classId,
      title,
      metric,
      targetValue,
      periodStart,
      periodEnd,
      createdByUserId: identity.userId,
    });
    return NextResponse.json(goal, { status: 201, ...PRIVATE_NO_STORE });
  } catch {
    return NextResponse.json({ error: "learning_goal_create_failed" }, { status: 500, ...PRIVATE_NO_STORE });
  }
}

export async function DELETE(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  const identity = await getRequestIdentity(req);
  if (!identity?.studentId || identity.role !== "student") {
    return NextResponse.json({ error: "student_authorization_required" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  const goalId = req.nextUrl.searchParams.get("goalId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(goalId)) {
    return NextResponse.json({ error: "invalid_goal_id" }, { status: 400, ...PRIVATE_NO_STORE });
  }
  try {
    const cancelled = await cancelLearningGoal(identity.studentId, goalId);
    return cancelled
      ? NextResponse.json({ ok: true }, PRIVATE_NO_STORE)
      : NextResponse.json({ error: "not_found" }, { status: 404, ...PRIVATE_NO_STORE });
  } catch {
    return NextResponse.json({ error: "learning_goal_cancel_failed" }, { status: 500, ...PRIVATE_NO_STORE });
  }
}
