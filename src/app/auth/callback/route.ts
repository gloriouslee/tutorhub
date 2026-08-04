import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Email links built from `{{ .TokenHash }}` land here with ?token_hash=&type=.
// OAuth (Google) and PKCE links land here with ?code=.
const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && OTP_TYPES.has(value as EmailOtpType);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const rawType = request.nextUrl.searchParams.get("type");
  const otpType = isOtpType(rawType) ? rawType : null;
  const requestedNext = request.nextUrl.searchParams.get("next");

  // A recovery link must always end on the "choose a new password" screen.
  // Otherwise honour ?next= when it is a safe relative path, and fall back to
  // "/" so the route guard forwards the caller to their own role home (and to
  // /reset-password or /student/onboarding when those gates still apply).
  let next =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/";
  if (otpType === "recovery") next = "/update-password";

  // Password-recovery problems belong on the "forgot password" screen, where a
  // new link is one click away; every other failed link (expired confirmation,
  // replayed magic link) belongs on the login screen. GoTrue drops the `type`
  // param when it redirects a PKCE link, so fall back to the destination.
  const isRecovery =
    otpType === "recovery" || otpType === "invite" || next === "/update-password";
  const failurePath = isRecovery ? "/forgot-password" : "/login";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(
      new URL("/login?error=configuration", request.url),
    );
  }

  // Supabase's default email template routes through the GoTrue /verify
  // endpoint, which hands the session back in the URL *fragment*. A server
  // handler cannot read a fragment, so bounce those to a client page that can.
  if (!code && !tokenHash) {
    return NextResponse.redirect(
      new URL(`/auth/confirm?next=${encodeURIComponent(next)}`, request.url),
    );
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = tokenHash
    ? await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        // GoTrue accepts a missing type for confirmation links; default to the
        // signup flow, which is what an unlabelled token_hash link is.
        type: otpType ?? "email",
      })
    : await supabase.auth.exchangeCodeForSession(code as string);

  if (error) {
    const destination = new URL(failurePath, request.url);
    destination.searchParams.set("error", classifyFailure(error));
    return NextResponse.redirect(destination);
  }
  return response;
}

/**
 * Turn a GoTrue failure into a slug the login / forgot-password screens can
 * explain. The three cases need different instructions, so collapsing them into
 * one "invalid link" message leaves the user with nothing to act on.
 */
function classifyFailure(error: { code?: string; message: string }): string {
  const code = error.code ?? "";
  const message = error.message.toLowerCase();

  // A PKCE link ({{ .ConfirmationURL }}) can only be completed by the browser
  // that requested it, because the code verifier lives in that browser's cookie.
  // Opening the mail on another device lands here.
  if (
    code === "flow_state_not_found"
    || code === "flow_state_expired"
    || message.includes("flow state")
    || message.includes("code verifier")
  ) {
    return "link_wrong_browser";
  }
  if (code === "otp_expired" || message.includes("expired")) {
    return "link_expired";
  }
  return "invalid_or_expired_link";
}
