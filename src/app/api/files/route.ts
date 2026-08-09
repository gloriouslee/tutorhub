import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKETS = new Set([
  "class-materials",
  "homework-submissions",
  "avatars",
  "payment-receipts",
]);

const PRIVATE_FILE_TTL_SECONDS = 60;
const PROFILE_ASSET_TTL_SECONDS = 600;
const PROFILE_ASSET_BROWSER_TTL_SECONDS = 300;

function containsFilePath(value: unknown, expectedUrl: string): boolean {
  if (typeof value === "string") return value === expectedUrl;
  if (Array.isArray(value)) {
    return value.some((item) => containsFilePath(item, expectedUrl));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => containsFilePath(item, expectedUrl));
  }
  return false;
}

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
  } else if (bucket === "payment-receipts") {
    const studentId = segments[0];
    if (actor.role === "student") {
      allowed ||= actor.studentId === studentId;
    } else if (actor.role === "parent" && actor.parentId) {
      const { data } = await admin
        .from("students")
        .select("id")
        .eq("id", studentId)
        .eq("parent_id", actor.parentId)
        .maybeSingle();
      allowed ||= Boolean(data);
    } else if (actor.role === "teacher" && actor.teacherId) {
      const { data } = await admin
        .from("classes")
        .select("id")
        .eq("tutor_id", actor.teacherId)
        .contains("student_ids", [studentId])
        .limit(1);
      allowed ||= Boolean(data?.length);
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
      if (bucket === "class-materials") {
        const expectedUrl =
          `/api/files?bucket=class-materials&path=${encodeURIComponent(path)}`;
        const { data: classMaterial } = await admin
          .from("class_materials")
          .select("class_id,packages")
          .eq("file_url", expectedUrl)
          .maybeSingle();
        let entitled = false;
        if (classMaterial) {
          const { data: enrolled } = await admin
            .from("classes")
            .select("id")
            .eq("id", classMaterial.class_id)
            .contains("student_ids", [actor.studentId])
            .maybeSingle();
          const packages = Array.isArray(classMaterial.packages)
            ? classMaterial.packages.map(String)
            : [];
          entitled = Boolean(enrolled);
          if (entitled && packages.length > 0) {
            const { data: packageRow } = await admin
              .from("kv_student_packages")
              .select("value")
              .eq("id", classMaterial.class_id)
              .maybeSingle();
            const selected =
              packageRow?.value
              && typeof packageRow.value === "object"
              && !Array.isArray(packageRow.value)
                ? String((packageRow.value as Record<string, unknown>)[actor.studentId] ?? "")
                : "";
            entitled = packages.includes(selected);
          }
        } else {
          const { data: catalogRows } = await admin
            .from("teacher_materials")
            .select("id,class_id,data")
            .eq("published", true);
          const { data: purchases } = await admin
            .from("purchase_transactions")
            .select("pkg_id")
            .eq("student_id", actor.studentId)
            .eq("status", "approved");
          const granted = new Set((purchases ?? []).map((item) => String(item.pkg_id)));
          for (const row of catalogRows ?? []) {
            if (!containsFilePath(row.data, expectedUrl)) continue;
            const course = row.data as Record<string, unknown>;
            if (course.type === "paid_package") {
              entitled = granted.has(String(row.id))
                || containsFilePath(
                  Array.isArray(course.chapters)
                    ? course.chapters.map((chapter) => {
                        const item = chapter as Record<string, unknown>;
                        return {
                          ...item,
                          lessons: Array.isArray(item.lessons)
                            ? item.lessons.filter((lesson) =>
                                (lesson as Record<string, unknown>).isPreview === true)
                            : [],
                        };
                      })
                    : [],
                  expectedUrl,
                );
            } else if (course.type === "class" && row.class_id) {
              const { data: enrolled } = await admin
                .from("classes")
                .select("id")
                .eq("id", row.class_id)
                .contains("student_ids", [actor.studentId])
                .maybeSingle();
              entitled = Boolean(enrolled);
              const allowedPackages = Array.isArray(course.packages)
                ? course.packages.map(String)
                : [];
              if (entitled && allowedPackages.length > 0) {
                const { data: packageRow } = await admin
                  .from("kv_student_packages")
                  .select("value")
                  .eq("id", row.class_id)
                  .maybeSingle();
                const selected =
                  packageRow?.value
                  && typeof packageRow.value === "object"
                  && !Array.isArray(packageRow.value)
                    ? String((packageRow.value as Record<string, unknown>)[actor.studentId] ?? "")
                    : "";
                entitled = allowedPackages.includes(selected);
              }
            }
            break;
          }
        }
        allowed = entitled;
      }
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
  if (bucket === "homework-submissions" && actor.role === "parent") {
    const submissionStudentId = segments[2] ?? "";
    const { data: child } = actor.parentId
      ? await admin
          .from("students")
          .select("id")
          .eq("id", submissionStudentId)
          .eq("parent_id", actor.parentId)
          .maybeSingle()
      : { data: null };
    if (segments[1] !== "submissions" || !child) allowed = false;
  }
  // Parent portal does not expose class material files. This also prevents a
  // copied URL from bypassing a student's package entitlement.
  if (bucket === "class-materials" && actor.role === "parent") {
    allowed = false;
  }
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const isVersionedProfileAsset = bucket === "avatars";
  const signedUrlTtl = isVersionedProfileAsset
    ? PROFILE_ASSET_TTL_SECONDS
    : PRIVATE_FILE_TTL_SECONDS;
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, signedUrlTtl);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "file_not_found" }, { status: 404 });
  }
  return NextResponse.redirect(data.signedUrl, {
    headers: {
      "Cache-Control": isVersionedProfileAsset
        ? `private, max-age=${PROFILE_ASSET_BROWSER_TTL_SECONDS}, immutable`
        : "private, no-store",
    },
  });
}
