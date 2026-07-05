import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  const studentRef = req.nextUrl.searchParams.get("student_ref");
  if (!studentRef) {
    return NextResponse.json({ error: "student_ref required" }, { status: 400 });
  }
  const { data, error } = await supabase()
    .from("app_exam_scores")
    .select("*")
    .eq("student_ref", studentRef)
    .order("exam_date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabase()
    .from("app_exam_scores")
    .insert([body])
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
