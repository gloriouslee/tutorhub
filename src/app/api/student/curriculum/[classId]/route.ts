import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeStudentCurriculum } from "@/lib/student-learning-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "student" || !actor.studentId) {
    return NextResponse.json({ error: "student_authorization_required" }, { status: 403 });
  }
  const { classId } = await params;
  const admin = createAdminClient();
  const { data: enrolled, error: enrollmentError } = await admin
    .from("classes")
    .select("id")
    .eq("id", classId)
    .contains("student_ids", [actor.studentId])
    .maybeSingle();
  if (enrollmentError) {
    return NextResponse.json({ error: "curriculum_unavailable" }, { status: 500 });
  }
  if (!enrolled) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { data, error } = await admin
    .from("kv_curriculum")
    .select("value")
    .eq("id", classId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "curriculum_unavailable" }, { status: 500 });
  }

  const chapters = sanitizeStudentCurriculum(data?.value, actor.studentId);
  return NextResponse.json(chapters, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
