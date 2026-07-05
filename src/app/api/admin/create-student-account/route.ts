import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Tạo tài khoản Supabase Auth thật cho học viên khi admin duyệt đơn.
// Chạy server-side với service role key (không bao giờ lộ ra client).
export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!serviceKey.startsWith("ey") && !serviceKey.startsWith("sb_secret")) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY chưa được cấu hình" },
      { status: 501 }
    );
  }

  const { email, password, full_name, enrollment_id, assigned_class_id } = await req.json();
  if (!email || !password || !enrollment_id) {
    return NextResponse.json({ error: "Thiếu email/password/enrollment_id" }, { status: 400 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: "student",
      full_name,
      enrollment_id,
      assigned_class_id,
    },
  });

  if (error) {
    // Tài khoản đã tồn tại → cập nhật mật khẩu + metadata thay vì fail
    if (error.message.toLowerCase().includes("already")) {
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (existing) {
        const { error: updError } = await admin.auth.admin.updateUserById(existing.id, {
          password,
          user_metadata: { role: "student", full_name, enrollment_id, assigned_class_id },
        });
        if (updError) return NextResponse.json({ error: updError.message }, { status: 500 });
        return NextResponse.json({ user_id: existing.id, updated: true });
      }
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user_id: data.user.id });
}
