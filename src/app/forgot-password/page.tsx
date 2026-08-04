"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

// Lý do /auth/callback không dùng được liên kết trong email. Mỗi trường hợp cần
// một hướng xử lý khác nhau, nên không gộp thành một thông báo chung.
const LINK_ERRORS: Record<string, string> = {
  invalid_or_expired_link:
    "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới.",
  link_expired:
    "Liên kết đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu liên kết mới và bấm vào trong vòng 1 giờ.",
  link_wrong_browser:
    "Liên kết chỉ dùng được trên đúng trình duyệt đã gửi yêu cầu. Hãy yêu cầu liên kết mới ngay tại đây rồi mở email trên chính trình duyệt này.",
  configuration:
    "Hệ thống xác thực chưa được cấu hình đầy đủ. Vui lòng liên hệ quản trị viên.",
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("error");
    if (reason && reason in LINK_ERRORS) setError(LINK_ERRORS[reason]);
  }, []);

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
    } catch (caught) {
      // Supabase trả 429 khi vượt hạn mức gửi, và 5xx khi SMTP lỗi. Phân biệt
      // hai trường hợp để người dùng biết nên đợi hay báo quản trị viên, thay vì
      // nhận một thông báo chung không hành động được.
      const status =
        caught && typeof caught === "object" && "status" in caught
          ? Number((caught as { status?: unknown }).status)
          : 0;
      const message =
        caught instanceof Error ? caught.message.toLowerCase() : "";
      if (status === 429 || message.includes("rate limit")) {
        setError(
          "Bạn đã yêu cầu quá nhiều lần. Vui lòng đợi khoảng 15 phút rồi thử lại.",
        );
      } else if (status >= 500 || message.includes("error sending")) {
        setError(
          "Hệ thống gửi email đang gặp sự cố nên chưa gửi được liên kết. Vui lòng liên hệ quản trị viên.",
        );
      } else {
        setError("Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.");
      }
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
