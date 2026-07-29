import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasValidMutationOrigin } from "@/lib/request-security";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "student" || !actor.studentId) {
    return NextResponse.json({ error: "student_authorization_required" }, { status: 403 });
  }
  const { id } = await params;
  const admin = createAdminClient();
  const { data: material, error } = await admin
    .from("class_materials")
    .select("id,class_id,packages")
    .eq("id", id)
    .maybeSingle();
  if (error || !material) {
    return NextResponse.json({ error: "material_not_found" }, { status: 404 });
  }
  const { data: enrolled } = await admin
    .from("classes")
    .select("id")
    .eq("id", material.class_id)
    .contains("student_ids", [actor.studentId])
    .maybeSingle();
  if (!enrolled) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const packages = Array.isArray(material.packages)
    ? material.packages.map(String)
    : [];
  if (packages.length > 0) {
    const { data: packageRow } = await admin
      .from("kv_student_packages")
      .select("value")
      .eq("id", material.class_id)
      .maybeSingle();
    const selected =
      packageRow?.value
      && typeof packageRow.value === "object"
      && !Array.isArray(packageRow.value)
        ? String((packageRow.value as Record<string, unknown>)[actor.studentId] ?? "")
        : "";
    if (!packages.includes(selected)) {
      return NextResponse.json({ error: "package_required" }, { status: 403 });
    }
  }
  const { error: updateError } = await admin.rpc(
    "increment_class_material_download_secure",
    { p_material_id: id },
  );
  if (updateError) {
    return NextResponse.json({ error: "download_count_failed" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
