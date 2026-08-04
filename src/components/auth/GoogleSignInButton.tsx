"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const REMEMBER_MAX_AGE = 60 * 60 * 24 * 365;

function GoogleMark() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.8-6.8C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.5 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.6c0-1.6-.1-2.8-.4-4.1H24v8.4h12.5c-.3 2.1-1.6 5.2-4.6 7.3l7.7 6c4.5-4.2 6.5-10.2 6.5-17.6z"
      />
      <path
        fill="#FBBC05"
        d="M10.5 28.6A14.6 14.6 0 0 1 9.7 24c0-1.6.3-3.2.8-4.6l-7.9-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.2z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.6-5.8l-7.7-6c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.6-4-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

/**
 * Starts Supabase's Google OAuth flow. The browser client stores the PKCE code
 * verifier in a cookie, so /auth/callback can exchange the returned code for a
 * session server-side.
 */
export function GoogleSignInButton({
  next = "/",
  remember = true,
  label = "Tiếp tục với Google",
}: {
  next?: string;
  remember?: boolean;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setError("");
    setLoading(true);
    try {
      // Match the password flow: record the "remember me" preference before the
      // client is created so the auth cookies get the right lifetime.
      document.cookie = `th_remember=${remember ? "1" : "0"}; path=/; max-age=${REMEMBER_MAX_AGE}; samesite=lax`;
      const { error: oauthError } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          // Always let the user pick which Google account to use.
          queryParams: { prompt: "select_account" },
        },
      });
      if (oauthError) {
        setError("Không thể mở đăng nhập Google. Vui lòng thử lại.");
        setLoading(false);
      }
      // On success the browser navigates to Google, so keep the spinner on.
    } catch {
      setError("Không thể kết nối Google. Vui lòng thử lại.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full h-12 gap-3 text-base font-medium"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleMark />}
        {label}
      </Button>
      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
