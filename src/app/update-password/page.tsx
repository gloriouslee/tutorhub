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

export default function UpdatePasswordPage() {
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
      // Cùng endpoint với /reset-password: nó vừa đổi mật khẩu vừa gỡ cờ
      // must_reset_password. Gọi thẳng Supabase từ client chỉ đổi được mật khẩu
      // và để lại cờ, khiến người dùng bị đẩy sang /reset-password ngay sau đó.
      const response = await fetch("/api/account/change-password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(
          ERROR_MESSAGES[result.error ?? ""]
            ?? "Liên kết đã hết hạn hoặc không thể cập nhật mật khẩu. Hãy yêu cầu một liên kết mới.",
        );
        setSubmitting(false);
        return;
      }

      const identityResponse = await fetch("/api/account/me", { cache: "no-store" });
      const identity = identityResponse.ok
        ? await identityResponse.json() as { role?: string }
        : {};
      router.replace(identity.role ? `/${identity.role}` : "/login");
      router.refresh();
    } catch {
      setError("Liên kết đã hết hạn hoặc không thể cập nhật mật khẩu. Hãy yêu cầu một liên kết mới.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-background to-purple-50 p-4 dark:from-indigo-950/20 dark:to-purple-950/20">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Tạo mật khẩu mới</CardTitle>
          <p className="text-sm text-muted-foreground">
            Mật khẩu mới sẽ được cập nhật trực tiếp vào tài khoản Supabase của bạn.
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
              placeholder="Nhập lại mật khẩu mới"
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
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cập nhật mật khẩu
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
