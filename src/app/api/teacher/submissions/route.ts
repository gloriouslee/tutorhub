import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadTeacherClassScopes, loadTeacherSubmissionSnapshots } from "@/lib/teacher-submissions-server";

const PRIVATE_NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

function requestedClassIds(req: NextRequest): string[] {
  return [...new Set(
    (req.nextUrl.searchParams.get("class_ids") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )].slice(0, 50);
}

export async function GET(req: NextRequest) {
  const identity = await getRequestIdentity(req);
  if (!identity || (identity.role !== "teacher" && identity.role !== "admin")) {
    return NextResponse.json({ error: "authentication_required" }, { status: 403 });
  }
  const classIds = requestedClassIds(req);
  if (classIds.length === 0) return NextResponse.json({}, PRIVATE_NO_STORE);

  try {
    const admin = createAdminClient();
    const scopes = await loadTeacherClassScopes(admin, classIds);
    if (scopes.length !== classIds.length) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (identity.role === "teacher" && scopes.some((scope) => scope.tutor_id !== identity.teacherId)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      await loadTeacherSubmissionSnapshots(admin, scopes),
      PRIVATE_NO_STORE,
    );
  } catch (error) {
    console.error("[teacher/submissions] snapshot failed", {
      classCount: classIds.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "submission_snapshot_unavailable" }, { status: 500 });
  }
}

