"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { validatePassword } from "@/lib/validation";

const ERROR_MESSAGES: Record<string, string> = {
  password_required: "Vui lòng nhập mật khẩu mới.",
  password_too_short: "Mật khẩu phải có ít nhất 12 ký tự.",
  password_too_long: "Mật khẩu không được vượt quá 128 ký tự.",
  password_needs_lowercase: "Mật khẩu cần ít nhất một chữ thường.",
  password_needs_uppercase: "Mật khẩu cần ít nhất một chữ hoa.",
  password_needs_number: "Mật khẩu cần ít nhất một chữ số.",
  password_needs_symbol: "Mật khẩu cần ít nhất một ký tự đặc biệt.",
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const validationError = validatePassword(password);
    if (validationError) {
      setError(ERROR_MESSAGES[validationError] ?? "Mật khẩu chưa hợp lệ.");
      return;
    }
    if (password !== confirmation) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(
          ERROR_MESSAGES[result.error ?? ""] ??
            "Không thể cập nhật mật khẩu. Vui lòng thử lại.",
        );
        return;
      }

      const identityResponse = await fetch("/api/account/me", {
        cache: "no-store",
      });
      const identity = (await identityResponse.json()) as { role?: string };
      const requestedNext = new URLSearchParams(window.location.search).get("next");
      const roleHome = identity.role ? `/${identity.role}` : "/login";
      const safeNext =
        requestedNext?.startsWith(`${roleHome}/`)
        && !requestedNext.startsWith("//")
          ? requestedNext
          : roleHome;
      router.push(safeNext);
      router.refresh();
    } catch {
      setError("Không thể kết nối hệ thống. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Thiết lập mật khẩu mới</CardTitle>
          <p className="text-sm text-muted-foreground">
            Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng TutorHub.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mật khẩu mới"
              leftIcon={<KeyRound className="h-4 w-4" />}
              autoComplete="new-password"
              required
            />
            <Input
              type={showPassword ? "text" : "password"}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Nhập lại mật khẩu"
              leftIcon={<KeyRound className="h-4 w-4" />}
              autoComplete="new-password"
              required
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(event) => setShowPassword(event.target.checked)}
              />
              Hiện mật khẩu
            </label>
            <p className="text-xs text-muted-foreground">
              Tối thiểu 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
            </p>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cập nhật mật khẩu
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
