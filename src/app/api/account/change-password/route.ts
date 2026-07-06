import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Đổi mật khẩu học viên (tài khoản từ đơn đăng ký): xác thực mật khẩu hiện tại
// server-side, cập nhật đồng bộ CẢ enrollment_requests LẪN Supabase Auth —
// tránh tình trạng hai mật khẩu song song (cũ vẫn đăng nhập được).
export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!serviceKey.startsWith("ey") && !serviceKey.startsWith("sb_secret")) {
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }

  const { enrollment_id, current_password, new_password } = await req.json();
  if (!enrollment_id || !current_password || !new_password) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (new_password.length < 6) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: enr, error: enrError } = await admin
    .from("enrollment_requests")
    .select("id, status, account_password, supabase_user_id")
    .eq("id", enrollment_id)
    .maybeSingle();
  if (enrError || !enr || enr.status !== "approved") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (enr.account_password !== current_password) {
    return NextResponse.json({ error: "wrong_password" }, { status: 403 });
  }

  // Cập nhật Supabase Auth trước (nếu tài khoản auth tồn tại)
  if (enr.supabase_user_id) {
    const { error: authError } = await admin.auth.admin.updateUserById(
      enr.supabase_user_id,
      { password: new_password }
    );
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }
  }

  const { error: updError } = await admin
    .from("enrollment_requests")
    .update({ account_password: new_password })
    .eq("id", enrollment_id);
  if (updError) {
    return NextResponse.json({ error: updError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
