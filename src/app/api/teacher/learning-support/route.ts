import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { hasValidMutationOrigin } from "@/lib/request-security";
import {
  generateWeeklyReportsForTeacher,
  loadTeacherLearningSupport,
  updateSupportAlertStatus,
} from "@/lib/learning-growth-server";
import { consumeRateLimit } from "@/lib/rate-limit";

const PRIVATE_NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(req: NextRequest) {
  const identity = await getRequestIdentity(req);
  if (!identity?.teacherId || identity.role !== "teacher") {
    return NextResponse.json({ error: "teacher_authorization_required" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  try {
    return NextResponse.json(await loadTeacherLearningSupport(identity.teacherId), PRIVATE_NO_STORE);
  } catch {
    return NextResponse.json({ error: "learning_support_unavailable" }, { status: 500, ...PRIVATE_NO_STORE });
  }
}

export async function POST(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  const identity = await getRequestIdentity(req);
  if (!identity?.teacherId || identity.role !== "teacher") {
    return NextResponse.json({ error: "teacher_authorization_required" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, ...PRIVATE_NO_STORE });
  }
  try {
    if (body.action === "generate_weekly_reports") {
      if (!await consumeRateLimit({
        scope: "weekly-parent-report-generation",
        key: identity.userId,
        limit: 5,
        windowSeconds: 3600,
      })) {
        return NextResponse.json({ error: "rate_limited" }, { status: 429, ...PRIVATE_NO_STORE });
      }
      const studentId = typeof body.studentId === "string" ? body.studentId.trim() : undefined;
      if (studentId && studentId.length > 120) {
        return NextResponse.json({ error: "invalid_student_id" }, { status: 400, ...PRIVATE_NO_STORE });
      }
      return NextResponse.json(
        await generateWeeklyReportsForTeacher(identity.teacherId, undefined, studentId),
        PRIVATE_NO_STORE,
      );
    }
    if (body.action === "update_alert") {
      if (!await consumeRateLimit({
        scope: "student-support-alert-update",
        key: identity.userId,
        limit: 30,
        windowSeconds: 60,
      })) {
        return NextResponse.json({ error: "rate_limited" }, { status: 429, ...PRIVATE_NO_STORE });
      }
      const alertId = typeof body.alertId === "string" ? body.alertId : "";
      const status = body.status;
      if (!/^[0-9a-f-]{36}$/i.test(alertId) || !["open", "monitoring", "resolved"].includes(String(status))) {
        return NextResponse.json({ error: "invalid_alert_update" }, { status: 400, ...PRIVATE_NO_STORE });
      }
      const updated = await updateSupportAlertStatus(
        identity.teacherId,
        alertId,
        status as "open" | "monitoring" | "resolved",
      );
      return updated
        ? NextResponse.json({ ok: true }, PRIVATE_NO_STORE)
        : NextResponse.json({ error: "not_found" }, { status: 404, ...PRIVATE_NO_STORE });
    }
    return NextResponse.json({ error: "unsupported_action" }, { status: 400, ...PRIVATE_NO_STORE });
  } catch {
    return NextResponse.json({ error: "learning_support_update_failed" }, { status: 500, ...PRIVATE_NO_STORE });
  }
}
