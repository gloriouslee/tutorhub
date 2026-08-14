import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createLearningGoal } from "@/lib/learning-growth-server";
import { teacherClassForStudent } from "@/lib/student-notes-server";
import {
  loadTeacherStudentDirectory,
  loadTeacherStudentProfile,
} from "@/lib/learning-growth-server";
import type { GoalMetric } from "@/lib/learning-growth";

const PRIVATE_NO_STORE = {
  headers: { "Cache-Control": "private, no-store" },
};

export async function GET(req: NextRequest) {
  const identity = await getRequestIdentity(req);
  if (!identity?.teacherId || identity.role !== "teacher") {
    return NextResponse.json(
      { error: "teacher_authorization_required" },
      { status: 403, ...PRIVATE_NO_STORE },
    );
  }

  const studentId = req.nextUrl.searchParams.get("student_id")?.trim() ?? "";
  if (studentId.length > 120) {
    return NextResponse.json(
      { error: "invalid_student_id" },
      { status: 400, ...PRIVATE_NO_STORE },
    );
  }

  try {
    if (studentId) {
      const profile = await loadTeacherStudentProfile(identity.teacherId, studentId);
      return profile
        ? NextResponse.json(profile, PRIVATE_NO_STORE)
        : NextResponse.json(
            { error: "student_not_found" },
            { status: 404, ...PRIVATE_NO_STORE },
          );
    }
    return NextResponse.json(
      await loadTeacherStudentDirectory(identity.teacherId),
      PRIVATE_NO_STORE,
    );
  } catch {
    return NextResponse.json(
      { error: "teacher_student_workspace_unavailable" },
      { status: 500, ...PRIVATE_NO_STORE },
    );
  }
}

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

export async function POST(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  const identity = await getRequestIdentity(req);
  if (!identity?.teacherId || identity.role !== "teacher") {
    return NextResponse.json({ error: "teacher_authorization_required" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  if (!await consumeRateLimit({ scope: "teacher-learning-goal", key: identity.userId, limit: 15, windowSeconds: 3600 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, ...PRIVATE_NO_STORE });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, ...PRIVATE_NO_STORE });
  }
  if (body.action !== "save_goal") {
    return NextResponse.json({ error: "unsupported_action" }, { status: 400, ...PRIVATE_NO_STORE });
  }
  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
  const classId = typeof body.classId === "string" && body.classId.trim() ? body.classId.trim() : null;
  const goalId = typeof body.goalId === "string" && body.goalId.trim() ? body.goalId.trim() : null;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const metric = body.metric as GoalMetric;
  const targetValue = Number(body.targetValue);
  const periodStart = body.periodStart;
  const periodEnd = body.periodEnd;
  if (
    !studentId || studentId.length > 120 || title.length < 3 || title.length > 160
    || !GOAL_METRICS.has(metric) || !Number.isFinite(targetValue) || targetValue <= 0 || targetValue > 10_000
    || !validDate(periodStart) || !validDate(periodEnd)
    || new Date(periodEnd).getTime() < new Date(periodStart).getTime()
    || new Date(periodEnd).getTime() - new Date(periodStart).getTime() > 90 * 86_400_000
  ) {
    return NextResponse.json({ error: "invalid_learning_goal" }, { status: 400, ...PRIVATE_NO_STORE });
  }
  const authorizedClassId = await teacherClassForStudent(identity, studentId, classId);
  if (!authorizedClassId) {
    return NextResponse.json({ error: "student_access_denied" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  try {
    if (!goalId) {
      const goal = await createLearningGoal({
        studentId,
        classId: authorizedClassId,
        title,
        metric,
        targetValue,
        periodStart,
        periodEnd,
        createdByUserId: identity.userId,
      });
      return NextResponse.json(goal, { status: 201, ...PRIVATE_NO_STORE });
    }
    const admin = createAdminClient();
    const { data: existing, error: lookupError } = await admin.from("learning_goals")
      .select("id,student_id")
      .eq("id", goalId)
      .eq("student_id", studentId)
      .maybeSingle();
    if (lookupError || !existing) {
      return NextResponse.json({ error: "learning_goal_not_found" }, { status: 404, ...PRIVATE_NO_STORE });
    }
    const { data, error } = await admin.from("learning_goals").update({
      class_id: authorizedClassId,
      title,
      metric,
      target_value: targetValue,
      period_start: periodStart,
      period_end: periodEnd,
      status: "active",
      completed_at: null,
      updated_at: new Date().toISOString(),
    }).eq("id", goalId).select("*").single();
    if (error) throw error;
    return NextResponse.json(data, PRIVATE_NO_STORE);
  } catch {
    return NextResponse.json({ error: "learning_goal_save_failed" }, { status: 500, ...PRIVATE_NO_STORE });
  }
}
