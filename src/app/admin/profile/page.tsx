"use client";

import { useEffect, useState } from "react";
import { CalendarDays, KeyRound, Loader2, Mail, Phone, Save, Shield, User } from "lucide-react";
import PortalLayout from "@/components/layout/PortalLayout";
import { SectionHeader } from "@/components/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { resetAccountContextCache } from "@/hooks/useAccountContext";

type AdminProfile = {
  full_name: string;
  email: string;
  phone: string;
  role: "admin";
  created_at: string | null;
  last_sign_in_at: string | null;
};

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [form, setForm] = useState({ full_name: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/profile", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("profile_load_failed");
        return response.json() as Promise<AdminProfile>;
      })
      .then(data => {
        if (cancelled) return;
        setProfile(data);
        setForm({ full_name: data.full_name, phone: data.phone });
      })
      .catch(() => {
        if (!cancelled) {
          setMessage({ ok: false, text: "Không thể tải hồ sơ quản trị viên." });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage({
          ok: false,
          text:
            result.error === "invalid_phone"
              ? "Số điện thoại không hợp lệ."
              : "Không thể cập nhật hồ sơ.",
        });
        return;
      }
      setProfile(current => current ? { ...current, ...result } : current);
      resetAccountContextCache();
      setMessage({ ok: true, text: "Đã cập nhật hồ sơ quản trị viên." });
    } catch {
      setMessage({ ok: false, text: "Không thể kết nối máy chủ." });
    } finally {
      setSaving(false);
    }
  }

  async function sendPasswordReset() {
    if (!profile) return;
    setResetting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/profile", { method: "POST" });
      setMessage(
        response.ok
          ? { ok: true, text: `Đã gửi liên kết đặt lại mật khẩu tới ${profile.email}.` }
          : { ok: false, text: "Không thể gửi email đặt lại mật khẩu." },
      );
    } catch {
      setMessage({ ok: false, text: "Không thể gửi email đặt lại mật khẩu." });
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <PortalLayout role="admin" userName="Admin" pageTitle="Hồ sơ quản trị">
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout
      role="admin"
      userName={profile?.full_name || "Admin"}
      pageTitle="Hồ sơ quản trị"
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <SectionHeader
          title="Hồ sơ quản trị viên"
          subtitle="Quản lý thông tin hiển thị và bảo mật của tài khoản đang đăng nhập."
        />

        {message && (
          <div
            className={`rounded-xl border p-3 text-sm ${
              message.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {profile && (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardContent className="flex flex-col items-center p-6 text-center">
                <Avatar className="h-24 w-24">
                  <AvatarFallback name={profile.full_name} className="text-2xl" />
                </Avatar>
                <h2 className="mt-4 text-lg font-bold">{profile.full_name}</h2>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                <Badge className="mt-3" variant="secondary">
                  <Shield className="mr-1 h-3.5 w-3.5" />
                  Quản trị viên
                </Badge>
                <div className="mt-6 w-full space-y-3 text-left text-sm">
                  <div className="flex gap-2 text-muted-foreground">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    Tạo ngày {profile.created_at ? new Date(profile.created_at).toLocaleDateString("vi-VN") : "—"}
                  </div>
                  <div className="flex gap-2 text-muted-foreground">
                    <KeyRound className="h-4 w-4 shrink-0" />
                    Đăng nhập gần nhất: {profile.last_sign_in_at ? new Date(profile.last_sign_in_at).toLocaleString("vi-VN") : "—"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-4 w-4 text-primary" />
                    Thông tin cá nhân
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={saveProfile}>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase text-muted-foreground">
                        Họ và tên
                      </label>
                      <Input
                        required
                        maxLength={120}
                        value={form.full_name}
                        onChange={event => setForm({ ...form, full_name: event.target.value })}
                        leftIcon={<User className="h-4 w-4" />}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase text-muted-foreground">
                        Email đăng nhập
                      </label>
                      <Input
                        value={profile.email}
                        disabled
                        leftIcon={<Mail className="h-4 w-4" />}
                      />
                      <p className="text-xs text-muted-foreground">
                        Email đăng nhập không đổi trực tiếp tại đây để tránh khóa nhầm tài khoản admin.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase text-muted-foreground">
                        Số điện thoại
                      </label>
                      <Input
                        value={form.phone}
                        onChange={event => setForm({ ...form, phone: event.target.value })}
                        placeholder="+84901234567"
                        leftIcon={<Phone className="h-4 w-4" />}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={saving || !form.full_name.trim()}>
                        {saving
                          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          : <Save className="mr-2 h-4 w-4" />}
                        Lưu hồ sơ
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <KeyRound className="h-4 w-4 text-primary" />
                    Bảo mật tài khoản
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Nhận liên kết bảo mật qua email để đặt mật khẩu mới.
                  </p>
                  <Button variant="outline" onClick={sendPasswordReset} disabled={resetting}>
                    {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Gửi email đặt lại mật khẩu
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
