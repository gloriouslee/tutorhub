import { createBrowserClient } from "@supabase/ssr";

// "Remember me" preference lives in a small, non-sensitive cookie (`th_remember`)
// so both this browser client and the server cookie-writers agree on how long
// the Supabase auth cookies should live.
//   present & "0"  → session cookies (cleared when the browser closes)
//   absent or "1"  → persistent cookies (stay logged in) — the default
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 365; // ~1 year

function rememberEnabled(): boolean {
  if (typeof document === "undefined") return true;
  return !/(?:^|;\s*)th_remember=0(?:;|$)/.test(document.cookie);
}

// Dùng placeholder khi thiếu env (VD lúc build/prerender trên CI chưa cấu hình
// biến môi trường) để createBrowserClient KHÔNG ném lỗi làm hỏng build. Mọi truy
// vấn tới placeholder sẽ fail và được storage layer bắt lại → fallback localStorage.
// PRODUCTION: phải đặt NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
    {
      cookieOptions: {
        // maxAge omitted ⇒ session cookie (dropped on browser close).
        maxAge: rememberEnabled() ? REMEMBER_MAX_AGE : undefined,
      },
    },
  );
}
