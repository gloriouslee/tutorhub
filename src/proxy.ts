import { NextResponse, type NextRequest } from "next/server";
import { getRequestIdentity, type UserRole } from "@/lib/api-auth";

const PUBLIC_ROUTES = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/enroll",
  "/auth/callback",
]);
const ROLE_HOME: Record<UserRole, string> = {
  student: "/student",
  parent: "/parent",
  teacher: "/teacher",
  admin: "/admin",
};

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.has(pathname);
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) =>
    /^sb-.+-auth-token(?:\.\d+)?$/.test(name),
  );
}

function roleForPath(pathname: string): UserRole | null {
  for (const role of Object.keys(ROLE_HOME) as UserRole[]) {
    const prefix = ROLE_HOME[role];
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return role;
  }
  return null;
}

function redirectWithCookies(
  request: NextRequest,
  destination: string,
  source: NextResponse,
) {
  const response = NextResponse.redirect(new URL(destination, request.url));
  source.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  for (const header of ["content-security-policy", "x-request-id"]) {
    const value = source.headers.get(header);
    if (value) response.headers.set(header, value);
  }
  return response;
}

function contentSecurityPolicy() {
  return [
    "default-src 'self'",
    // Next.js prerenders pages statically, so a per-request nonce cannot be
    // applied to its inline bootstrap scripts. Use a static policy that allows
    // self + inline scripts (and eval in dev) instead of nonce/strict-dynamic.
    `script-src 'self' 'unsafe-inline'${
      process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
    }`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "media-src 'self' blob: https:",
    // Video lecture / solution embeds (YouTube) + Zoom.
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://*.zoom.us",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    process.env.NODE_ENV === "production" ? "upgrade-insecure-requests" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const csp = contentSecurityPolicy();
  requestHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  response.headers.set("Content-Security-Policy", csp);

  if (pathname === "/admin/seed" || pathname.startsWith("/admin/seed/")) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: {
        "Content-Security-Policy": csp,
        "x-request-id": requestId,
      },
    });
  }

  // Route Handlers are the authorization boundary for APIs. Resolving the full
  // identity here as well would repeat the same Supabase calls in every handler.
  if (pathname.startsWith("/api/")) return response;

  // These routes never need a role lookup. The callback validates its own code,
  // while enrollment is intentionally public.
  if (
    pathname === "/signup"
    || pathname === "/forgot-password"
    || pathname === "/enroll"
    || pathname === "/auth/callback"
  ) return response;

  // No session cookie means there is nothing for Supabase to validate. Keep the
  // login page fast and redirect protected pages without a network round trip.
  if (!hasSupabaseAuthCookie(request)) {
    if (pathname === "/login") return response;
    return redirectWithCookies(request, "/login", response);
  }

  const identity = await getRequestIdentity(request, response);

  if (!identity) {
    if (isPublicRoute(pathname)) return response;
    return redirectWithCookies(request, "/login", response);
  }

  if (
    identity.mustResetPassword &&
    pathname !== "/reset-password"
  ) {
    return redirectWithCookies(request, "/reset-password", response);
  }

  if (!identity.mustResetPassword && pathname === "/reset-password") {
    return redirectWithCookies(request, ROLE_HOME[identity.role], response);
  }

  if (pathname === "/" || pathname === "/login") {
    return redirectWithCookies(request, ROLE_HOME[identity.role], response);
  }

  const requiredRole = roleForPath(pathname);
  if (requiredRole && requiredRole !== identity.role) {
    return redirectWithCookies(request, ROLE_HOME[identity.role], response);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
