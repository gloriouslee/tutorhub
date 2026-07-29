"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { resetAccountContextCache } from "@/hooks/useAccountContext";
import { createClient } from "@/lib/supabase/client";
import { isEmail, validatePassword } from "@/lib/validation";

const PASSWORD_ERRORS: Record<string, string> = {
  password_required: "Vui lòng nhập mật khẩu.",
  password_too_short: "Mật khẩu phải có ít nhất 12 ký tự.",
  password_too_long: "Mật khẩu không được vượt quá 128 ký tự.",
  password_needs_lowercase: "Mật khẩu cần ít nhất một chữ thường.",
  password_needs_uppercase: "Mật khẩu cần ít nhất một chữ hoa.",
  password_needs_number: "Mật khẩu cần ít nhất một chữ số.",
  password_needs_symbol: "Mật khẩu cần ít nhất một ký tự đặc biệt.",
};

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!fullName.trim() || fullName.trim().length > 120) {
      setError("Vui lòng nhập họ tên hợp lệ.");
      return;
    }
    if (!isEmail(email.trim())) {
      setError("Email chưa hợp lệ.");
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(PASSWORD_ERRORS[passwordError] ?? "Mật khẩu chưa hợp lệ.");
      return;
    }
    if (password !== confirmation) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/student`,
          data: {
            full_name: fullName.trim(),
            self_service_signup: true,
          },
        },
      });
      if (signupError) throw signupError;

      if (data.session) {
        resetAccountContextCache();
        router.replace("/student");
        router.refresh();
        return;
      }
      setConfirmationSent(true);
    } catch (signupError) {
      const message =
        signupError instanceof Error ? signupError.message.toLowerCase() : "";
      setError(
        message.includes("already") || message.includes("registered")
          ? "Email này đã có tài khoản. Bạn có thể đăng nhập hoặc đặt lại mật khẩu."
          : "Không thể tạo tài khoản lúc này. Vui lòng thử lại.",
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 p-4">
      <Card className="w-full max-w-lg border-white/10 shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Tạo tài khoản học sinh</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tài khoản mới bắt đầu trống. Bạn có thể xem mọi lớp và tài liệu đang mở, sau đó đăng ký lớp phù hợp.
          </p>
        </CardHeader>
        <CardContent>
          {confirmationSent ? (
            <div className="space-y-5 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <div>
                <h2 className="font-semibold">Kiểm tra email của bạn</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Nếu cần xác nhận email, Supabase đã gửi liên kết kích hoạt tới {email.trim().toLowerCase()}.
                </p>
              </div>
              <Link href="/login">
                <Button className="w-full">Đi đến đăng nhập</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Họ và tên"
                leftIcon={<User className="h-4 w-4" />}
                autoComplete="name"
                required
              />
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                leftIcon={<Mail className="h-4 w-4" />}
                autoComplete="email"
                required
              />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mật khẩu"
                leftIcon={<Lock className="h-4 w-4" />}
                rightIcon={
                  <button type="button" onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                autoComplete="new-password"
                required
              />
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="Nhập lại mật khẩu"
                leftIcon={<Lock className="h-4 w-4" />}
                autoComplete="new-password"
                required
              />
              <p className="text-xs text-muted-foreground">
                Tối thiểu 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
              </p>
              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Tạo tài khoản
              </Button>
              <div className="flex items-center justify-between text-sm">
                <Link href="/login" className="flex items-center gap-1.5 text-muted-foreground hover:text-primary">
                  <ArrowLeft className="h-4 w-4" /> Đăng nhập
                </Link>
                <Link href="/forgot-password" className="text-primary hover:underline">
                  Quên mật khẩu?
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
