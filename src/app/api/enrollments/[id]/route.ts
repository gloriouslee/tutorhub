import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminRequest } from "@/lib/api-auth";

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key === "your-service-role-key-here") return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Admin authorization required" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const { action, assigned_class_id, account_username, account_password, reject_reason } = body;
  const db = anonClient();

  if (action === "approve") {
    const { data: enrollment, error: fetchErr } = await db
      .from("enrollment_requests")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr || !enrollment) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    let supabaseUserId: string | null = null;
    const admin = adminClient();

    if (admin) {
      // Service role: create user without email confirmation
      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email: enrollment.email,
        password: account_password,
        email_confirm: true,
        user_metadata: {
          role: "student",
          full_name: enrollment.full_name,
          assigned_class_id,
        },
      });
      if (authErr) {
        return NextResponse.json({ error: authErr.message }, { status: 400 });
      }
      supabaseUserId = authData.user.id;
    } else {
      // Fallback: signUp (requires "Confirm email" disabled in Supabase Dashboard)
      const { data: authData, error: authErr } = await db.auth.signUp({
        email: enrollment.email,
        password: account_password,
        options: {
          data: { role: "student", full_name: enrollment.full_name, assigned_class_id },
        },
      });
      if (authErr) {
        return NextResponse.json({ error: authErr.message }, { status: 400 });
      }
      supabaseUserId = authData.user?.id ?? null;
    }

    const { error: updateErr } = await db
      .from("enrollment_requests")
      .update({
        status: "approved",
        assigned_class_id,
        account_username,
        account_password,
        supabase_user_id: supabaseUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, supabase_user_id: supabaseUserId });
  }

  if (action === "reject") {
    const { error } = await db
      .from("enrollment_requests")
      .update({
        status: "rejected",
        reject_reason: reject_reason ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
