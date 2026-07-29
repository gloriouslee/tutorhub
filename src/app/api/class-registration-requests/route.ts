import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { isNonEmptyString } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function hydrateRequests(
  admin: ReturnType<typeof createAdminClient>,
  rows: Record<string, unknown>[],
) {
  const studentIds = [...new Set(rows.map((row) => String(row.student_id)))];
  const classIds = [
    ...new Set(
      rows.flatMap((row) => [
        String(row.requested_class_id ?? ""),
        String(row.assigned_class_id ?? ""),
      ]).filter(Boolean),
    ),
  ];
  const [studentsResult, classesResult] = await Promise.all([
    studentIds.length
      ? admin
          .from("students")
          .select("id,full_name,email,school,grade")
          .in("id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    classIds.length
      ? admin.from("classes").select("id,class_name,subject").in("id", classIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (studentsResult.error || classesResult.error) {
    throw studentsResult.error ?? classesResult.error;
  }
  const students = new Map(
    (studentsResult.data ?? []).map((item) => [String(item.id), item]),
  );
  const classes = new Map(
    (classesResult.data ?? []).map((item) => [String(item.id), item]),
  );
  return rows.map((row) => ({
    ...row,
    student: students.get(String(row.student_id)),
    requested_class: classes.get(String(row.requested_class_id)),
    assigned_class: row.assigned_class_id
      ? classes.get(String(row.assigned_class_id)) ?? null
      : null,
  }));
}

export async function GET(req: NextRequest) {
  const actor = await getRequestIdentity(req);
  if (!actor) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }
  const admin = createAdminClient();
  let query = admin
    .from("class_registration_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (actor.role === "student" && actor.studentId) {
    query = query.eq("student_id", actor.studentId);
  } else if (actor.role === "teacher" && actor.teacherId) {
    const { data: classes, error } = await admin
      .from("classes")
      .select("id")
      .eq("tutor_id", actor.teacherId);
    if (error) {
      return NextResponse.json({ error: "registration_list_failed" }, { status: 500 });
    }
    const classIds = (classes ?? []).map((item) => String(item.id));
    if (classIds.length === 0) return NextResponse.json([]);
    query = query.in("requested_class_id", classIds);
  } else {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const classId = req.nextUrl.searchParams.get("class_id");
  const status = req.nextUrl.searchParams.get("status");
  if (classId) query = query.eq("requested_class_id", classId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "registration_list_failed" }, { status: 500 });
  }
  try {
    return NextResponse.json(
      await hydrateRequests(admin, (data ?? []) as Record<string, unknown>[]),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "registration_list_failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "student" || !actor.studentId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isNonEmptyString(body.class_id, 100)) {
    return NextResponse.json({ error: "invalid_class_id" }, { status: 400 });
  }
  const source = body.source === "material" ? "material" : "class";
  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, 1000) : null;
  const resourceId =
    typeof body.resource_id === "string"
      ? body.resource_id.trim().slice(0, 100)
      : null;

  const admin = createAdminClient();
  const { data: classRecord, error: classError } = await admin
    .from("classes")
    .select("id,student_ids")
    .eq("id", body.class_id)
    .maybeSingle();
  if (classError || !classRecord) {
    return NextResponse.json({ error: "class_not_found" }, { status: 404 });
  }
  if (
    Array.isArray(classRecord.student_ids)
    && classRecord.student_ids.map(String).includes(actor.studentId)
  ) {
    return NextResponse.json({ error: "already_enrolled" }, { status: 409 });
  }
  if (source === "material") {
    if (!resourceId) {
      return NextResponse.json({ error: "invalid_material_id" }, { status: 400 });
    }
    const { data: material } = await admin
      .from("teacher_materials")
      .select("id")
      .eq("id", resourceId)
      .eq("class_id", body.class_id)
      .eq("published", true)
      .maybeSingle();
    if (!material) {
      return NextResponse.json({ error: "material_not_found" }, { status: 404 });
    }
  }

  const { data: existing } = await admin
    .from("class_registration_requests")
    .select("id,status")
    .eq("student_id", actor.studentId)
    .eq("requested_class_id", body.class_id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) {
    return NextResponse.json(existing, { status: 200 });
  }

  const { data, error } = await admin
    .from("class_registration_requests")
    .insert({
      student_id: actor.studentId,
      requested_class_id: body.class_id,
      source,
      resource_id: resourceId,
      student_note: note,
    })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: "registration_create_failed" }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
