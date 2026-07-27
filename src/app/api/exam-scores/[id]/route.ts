import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasValidMutationOrigin } from "@/lib/request-security";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (!actor || !["teacher", "admin"].includes(actor.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  if (!id || id.length > 100) {
    return NextResponse.json({ error: "invalid_score_id" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: score, error: lookupError } = await admin
    .from("app_exam_scores")
    .select("id,class_id")
    .eq("id", id)
    .maybeSingle();
  if (lookupError || !score) {
    return NextResponse.json({ error: "score_not_found" }, { status: 404 });
  }
  if (actor.role === "teacher") {
    const { data: ownedClass } = await admin
      .from("classes")
      .select("id")
      .eq("id", score.class_id)
      .eq("tutor_id", actor.teacherId ?? "")
      .maybeSingle();
    if (!ownedClass) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { error } = await admin.from("app_exam_scores").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "score_delete_failed" }, { status: 500 });
  return NextResponse.json({ success: true });
}
