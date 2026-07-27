import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKETS = new Set(["class-materials", "homework-submissions", "avatars"]);

export async function GET(req: NextRequest) {
  const actor = await getRequestIdentity(req);
  if (!actor) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }
  const bucket = req.nextUrl.searchParams.get("bucket") ?? "";
  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (
    !BUCKETS.has(bucket) ||
    !path ||
    path.length > 1_000 ||
    path.includes("..") ||
    path.startsWith("/")
  ) {
    return NextResponse.json({ error: "invalid_file" }, { status: 400 });
  }

  const segments = path.split("/");
  let allowed = actor.role === "admin";
  const admin = createAdminClient();
  if (bucket === "avatars") {
    allowed ||= segments[0] === actor.userId;
  } else {
    const classId = segments[0];
    if (actor.role === "teacher" && actor.teacherId) {
      const { data } = await admin
        .from("classes")
        .select("id")
        .eq("id", classId)
        .eq("tutor_id", actor.teacherId)
        .maybeSingle();
      allowed ||= Boolean(data);
    } else if (actor.role === "student" && actor.studentId) {
      const { data } = await admin
        .from("classes")
        .select("id")
        .eq("id", classId)
        .contains("student_ids", [actor.studentId])
        .maybeSingle();
      allowed ||= Boolean(data);
    } else if (actor.role === "parent" && actor.parentId) {
      const { data: children } = await admin
        .from("students")
        .select("id")
        .eq("parent_id", actor.parentId);
      const childIds = (children ?? []).map((child) => String(child.id));
      if (childIds.length > 0) {
        const { data } = await admin
          .from("classes")
          .select("id")
          .eq("id", classId)
          .overlaps("student_ids", childIds)
          .maybeSingle();
        allowed ||= Boolean(data);
      }
    }
  }
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "file_not_found" }, { status: 404 });
  }
  return NextResponse.redirect(data.signedUrl, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
