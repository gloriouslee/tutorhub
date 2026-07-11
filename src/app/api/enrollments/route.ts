import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminRequest } from "@/lib/api-auth";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Admin authorization required" }, { status: 403 });
  }
  const { data, error } = await supabase()
    .from("enrollment_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const allowedFields = [
    "full_name", "email", "dob", "school", "grade", "requested_class_id", "parent_phone", "note",
  ] as const;
  const enrollment: Record<string, string> = {};
  for (const field of allowedFields) {
    const value = body[field];
    if (typeof value === "string") enrollment[field] = value.trim();
  }
  if (!enrollment.full_name || !enrollment.email || !enrollment.dob || !enrollment.parent_phone) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(enrollment.email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const { data, error } = await supabase()
    .from("enrollment_requests")
    .insert([{ ...enrollment, status: "pending" }])
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, status: data.status, created_at: data.created_at });
}
