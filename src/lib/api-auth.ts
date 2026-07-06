import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Kiểm tra người gọi API có phải admin không.
// Chấp nhận: (1) phiên Supabase Auth với role admin trong metadata/profiles,
// hoặc (2) cookie demo_role=admin (chế độ demo — sẽ bỏ khi tắt demo mode).
export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  if (req.cookies.get("demo_role")?.value === "admin") return true;

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll(); },
          setAll() { /* read-only trong API guard */ },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    if (user.user_metadata?.role === "admin") return true;
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    return profile?.role === "admin";
  } catch {
    return false;
  }
}
