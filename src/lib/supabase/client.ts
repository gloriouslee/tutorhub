import { createBrowserClient } from "@supabase/ssr";

// Dùng placeholder khi thiếu env (VD lúc build/prerender trên CI chưa cấu hình
// biến môi trường) để createBrowserClient KHÔNG ném lỗi làm hỏng build. Mọi truy
// vấn tới placeholder sẽ fail và được storage layer bắt lại → fallback localStorage.
// PRODUCTION: phải đặt NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
  );
}
