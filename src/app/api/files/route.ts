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
    if (!allowed && (actor.role === "student" || actor.role === "parent")) {
      const { data: ownerTeacher } = await admin
        .from("teachers")
        .select("id")
        .eq("user_id", segments[0])
        .maybeSingle();
      if (ownerTeacher?.id && actor.role === "student" && actor.studentId) {
        const { data } = await admin
          .from("classes")
          .select("id")
          .eq("tutor_id", ownerTeacher.id)
          .contains("student_ids", [actor.studentId])
          .limit(1);
        allowed ||= Boolean(data?.length);
      } else if (ownerTeacher?.id && actor.role === "parent" && actor.parentId) {
        const { data: children } = await admin
          .from("students")
          .select("id")
          .eq("parent_id", actor.parentId);
        const childIds = (children ?? []).map(child => String(child.id));
        if (childIds.length > 0) {
          const { data } = await admin
            .from("classes")
            .select("id")
            .eq("tutor_id", ownerTeacher.id)
            .overlaps("student_ids", childIds)
            .limit(1);
          allowed ||= Boolean(data?.length);
        }
      }
    }
  } else {
    const classId = segments[0];
    // Classes live either in `classes` (admin-created) or `teacher_extra_classes`
    // (teacher-created) — check both.
    if (actor.role === "teacher" && actor.teacherId) {
      const [core, extra] = await Promise.all([
        admin.from("classes").select("id").eq("id", classId).eq("tutor_id", actor.teacherId).maybeSingle(),
        admin.from("teacher_extra_classes").select("id").eq("id", classId).eq("tutor_id", actor.teacherId).maybeSingle(),
      ]);
      allowed ||= Boolean(core.data) || Boolean(extra.data);
    } else if (actor.role === "student" && actor.studentId) {
      const [core, extra] = await Promise.all([
        admin.from("classes").select("id").eq("id", classId).contains("student_ids", [actor.studentId]).maybeSingle(),
        admin.from("teacher_extra_classes").select("id").eq("id", classId).contains("student_ids", [actor.studentId]).maybeSingle(),
      ]);
      allowed ||= Boolean(core.data) || Boolean(extra.data);
    } else if (actor.role === "parent" && actor.parentId) {
      const { data: children } = await admin
        .from("students")
        .select("id")
        .eq("parent_id", actor.parentId);
      const childIds = (children ?? []).map((child) => String(child.id));
      if (childIds.length > 0) {
        const [core, extra] = await Promise.all([
          admin.from("classes").select("id").eq("id", classId).overlaps("student_ids", childIds).maybeSingle(),
          admin.from("teacher_extra_classes").select("id").eq("id", classId).overlaps("student_ids", childIds).maybeSingle(),
        ]);
        allowed ||= Boolean(core.data) || Boolean(extra.data);
      }
    }
  }
  // Homework submissions are per-student (path: classId/submissions/<studentId>/…).
  // A student may only fetch their OWN submission files, never a classmate's.
  // Teachers/admin keep full class access via the checks above.
  if (bucket === "homework-submissions" && actor.role === "student") {
    if (segments[1] !== "submissions" || segments[2] !== actor.studentId) {
      allowed = false;
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
