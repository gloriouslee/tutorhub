import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = ["/login", "/register", "/forgot-password", "/enroll"];
// Auth pages redirect logged-in users to their portal; /enroll stays accessible to everyone
const authPages = ["/login", "/register", "/forgot-password"];
const roleRoutes: Record<string, string> = {
  student: "/student",
  parent: "/parent",
  teacher: "/teacher",
  admin: "/admin",
};

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Thiếu env (VD chưa cấu hình trên Vercel) → dùng placeholder để createServerClient
  // KHÔNG ném lỗi làm middleware crash (MIDDLEWARE_INVOCATION_FAILED). Auth demo qua
  // cookie vẫn hoạt động; auth Supabase thật chỉ chạy khi có env thật.
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabase = createServerClient(
    SUPA_URL || "https://placeholder.supabase.co",
    SUPA_KEY || "placeholder-anon-key",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  const demoRole = request.cookies.get("demo_role")?.value;
  
  // Only try to get Supabase user if no demo role is present and real env is configured
  if (!demoRole && SUPA_URL && SUPA_KEY && SUPA_URL !== "https://your-project.supabase.co") {
    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch (e) {
      console.error("Supabase auth error:", e);
    }
  }

  const isAuth = !!user || !!demoRole;

  const { pathname } = request.nextUrl;

  // API routes handle their own auth; never redirect them to an HTML login page
  if (pathname.startsWith("/api")) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to login
  if (!isAuth && !publicRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from auth pages
  if (isAuth && authPages.some((r) => pathname.startsWith(r))) {
    const role = user?.user_metadata?.role ?? demoRole ?? "student";
    return NextResponse.redirect(
      new URL(roleRoutes[role] ?? "/student", request.url)
    );
  }

  // Root redirect
  if (isAuth && pathname === "/") {
    const role = user?.user_metadata?.role ?? demoRole ?? "student";
    return NextResponse.redirect(
      new URL(roleRoutes[role] ?? "/student", request.url)
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
