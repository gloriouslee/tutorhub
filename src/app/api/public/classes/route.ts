import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Public, unauthenticated: minimal class list for the enrollment page's class
// picker. RLS on `classes` denies anonymous reads, so anon visitors cannot use
// the browser client here — this endpoint exposes only non-sensitive fields
// (name/subject/grade) via the service role.
export async function GET() {
  try {
    const { data, error } = await createAdminClient()
      .from("classes")
      .select("id, class_name, subject, grade")
      .order("grade", { ascending: true });
    if (error) throw error;
    return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json([], { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
