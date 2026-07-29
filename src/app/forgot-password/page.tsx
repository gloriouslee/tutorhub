"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
        },
      );
      if (resetError) throw resetError;
      setSent(true);
    } catch {
      setError("Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-background to-purple-50 p-4 dark:from-indigo-950/20 dark:to-purple-950/20">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Đặt lại mật khẩu</CardTitle>
          <p className="text-sm text-muted-foreground">
            Nhập email tài khoản. Chúng tôi sẽ gửi một liên kết bảo mật để bạn tạo mật khẩu mới.
          </p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
                Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi. Hãy kiểm tra cả thư mục spam.
              </div>
              <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
                <Send className="mr-2 h-4 w-4" /> Gửi lại email
              </Button>
              <Link href="/login" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                <ArrowLeft className="h-4 w-4" /> Quay lại đăng nhập
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ban@example.com"
                leftIcon={<Mail className="h-4 w-4" />}
                autoComplete="email"
                required
              />
              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gửi liên kết đặt lại mật khẩu
              </Button>
              <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary">
                <ArrowLeft className="h-4 w-4" /> Quay lại đăng nhập
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
