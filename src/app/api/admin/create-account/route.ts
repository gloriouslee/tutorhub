import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_ROLES = ["student", "teacher", "parent"] as const;

// Tạo tài khoản Supabase Auth khi admin khởi tạo học viên/giáo viên thủ công.
// Chạy server-side với service role key.
export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!serviceKey.startsWith("ey") && !serviceKey.startsWith("sb_secret")) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY chưa được cấu hình" },
      { status: 501 }
    );
  }

  const { email, password, full_name, role, record_id } = await req.json();
  if (!email || !password || !role) {
    return NextResponse.json({ error: "Thiếu email/password/role" }, { status: 400 });
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: `Role không hợp lệ: ${role}` }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Mật khẩu tối thiểu 6 ký tự" }, { status: 400 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const metadata = {
    role,
    full_name,
    ...(role === "student" ? { student_id: record_id } : {}),
    ...(role === "teacher" ? { teacher_id: record_id } : {}),
  };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return NextResponse.json({ error: "Email này đã có tài khoản." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user_id: data.user.id });
}
