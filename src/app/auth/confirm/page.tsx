"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { resetAccountContextCache } from "@/hooks/useAccountContext";

/**
 * Fallback for Supabase's default email templates.
 *
 * Those links go through GoTrue's /verify endpoint, which returns the session in
 * the URL *fragment* (#access_token=…). Fragments never reach the server, so
 * /auth/callback forwards here and the browser finishes establishing the
 * session. Links built from `{{ .TokenHash }}` are verified server-side in
 * /auth/callback and never reach this page.
 */
export default function AuthConfirmPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const description = params.get("error_description");

    if (!accessToken || !refreshToken) {
      setError(
        description
          ? decodeURIComponent(description.replace(/\+/g, " "))
          : "Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.",
      );
      return;
    }

    const requested = new URLSearchParams(window.location.search).get("next");
    const safeNext =
      requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
    const destination =
      params.get("type") === "recovery" ? "/update-password" : safeNext;

    void (async () => {
      const { error: sessionError } = await createClient().auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) {
        setError("Không thể xác thực liên kết. Vui lòng thử lại.");
        return;
      }
      resetAccountContextCache();
      // Drop the tokens from the address bar before moving on.
      window.history.replaceState(null, "", window.location.pathname);
      router.replace(destination);
      router.refresh();
    })();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardContent className="space-y-5 p-8 text-center">
          {error ? (
            <>
              <ShieldAlert className="mx-auto h-12 w-12 text-red-500" />
              <p className="text-sm text-muted-foreground" role="alert">
                {error}
              </p>
              <Link href="/login">
                <Button className="w-full">Về trang đăng nhập</Button>
              </Link>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Đang xác thực tài khoản của bạn…
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
