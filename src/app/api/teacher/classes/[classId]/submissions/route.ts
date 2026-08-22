import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadTeacherClassScopes, loadTeacherSubmissionSnapshots } from "@/lib/teacher-submissions-server";

const PRIVATE_NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const identity = await getRequestIdentity(req);
  if (!identity || (identity.role !== "teacher" && identity.role !== "admin")) {
    return NextResponse.json({ error: "authentication_required" }, { status: 403 });
  }

  const { classId } = await params;
  try {
    const admin = createAdminClient();
    const [classScope] = await loadTeacherClassScopes(admin, [classId]);
    if (!classScope) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (identity.role === "teacher" && classScope.tutor_id !== identity.teacherId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const snapshots = await loadTeacherSubmissionSnapshots(admin, [classScope]);
    return NextResponse.json(snapshots[classId], PRIVATE_NO_STORE);
  } catch (error) {
    console.error("[teacher/classes/submissions] snapshot failed", {
      classId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "submission_snapshot_unavailable" }, { status: 500 });
  }
}
