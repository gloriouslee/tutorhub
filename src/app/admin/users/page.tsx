"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { SectionHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  KeyRound, Lock, MailPlus, RefreshCw, Search, Trash2, Unlock,
} from "lucide-react";

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: "student" | "parent" | "teacher" | "admin" | null;
  has_profile: boolean;
  must_reset_password: boolean;
  disabled: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

// Mã lỗi từ /api/admin/users. Gộp tất cả thành "thao tác thất bại" khiến admin
// không biết nên gỡ lớp, đợi hạn mức, hay đi sửa cấu hình email.
const ACTION_ERRORS: Record<string, string> = {
  cannot_disable_self: "Bạn không thể tự khóa tài khoản đang đăng nhập.",
  cannot_delete_self: "Bạn không thể tự xóa tài khoản đang đăng nhập.",
  student_has_classes: "Hãy gỡ học viên khỏi tất cả lớp trước khi xóa tài khoản.",
  teacher_has_classes: "Hãy phân công lại các lớp trước khi xóa tài khoản giáo viên.",
  account_already_exists: "Email này đã có tài khoản.",
  invite_rate_limited:
    "Đã vượt hạn mức gửi email. Vui lòng đợi ít phút rồi thử lại.",
  invite_email_failed:
    "Không gửi được email mời: hệ thống email đang lỗi. Kiểm tra cấu hình SMTP của Supabase.",
  reset_email_failed:
    "Không gửi được email đặt lại mật khẩu: hệ thống email đang lỗi. Kiểm tra cấu hình SMTP.",
  user_not_found: "Không tìm thấy tài khoản này.",
};

function describeError(code: unknown, fallback: string): string {
  const key = String(code ?? "");
  // Domain guards arrive as raw Postgres messages, e.g. "…student_has_classes…".
  const matched = Object.keys(ACTION_ERRORS).find((candidate) =>
    key.includes(candidate),
  );
  return matched ? ACTION_ERRORS[matched] : fallback;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    role: "student",
  });

  const reload = useCallback(async () => {
    const response = await fetch(`/api/admin/users?page=${page}&per_page=50`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setMessage("Không thể tải danh sách tài khoản.");
      return;
    }
    const result = await response.json();
    setUsers(result.items);
    setHasMore(result.has_more);
    setTotal(result.total);
  }, [page]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter(
      (user) =>
        !normalized ||
        user.email.toLowerCase().includes(normalized) ||
        user.full_name.toLowerCase().includes(normalized),
    );
  }, [query, users]);

  async function invite() {
    setBusy("invite");
    setMessage("");
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy("");
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setMessage(
        describeError(
          result.error,
          "Không thể gửi lời mời. Kiểm tra lại email và thử lại.",
        ),
      );
      return;
    }
    setForm({ email: "", full_name: "", role: "student" });
    setMessage("Đã gửi email mời đặt mật khẩu. Hệ thống không lưu mật khẩu tạm.");
    if (page === 1) await reload();
    else setPage(1);
  }

  async function action(user: UserRow, nextAction: "send_reset" | "disable" | "enable") {
    setBusy(user.id);
    setMessage("");
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id, action: nextAction }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy("");
    setMessage(
      response.ok
        ? nextAction === "send_reset"
          ? "Đã gửi email đặt lại mật khẩu."
          : nextAction === "disable"
            ? "Đã khóa tài khoản. Phiên đang đăng nhập bị chấm dứt ngay."
            : "Đã mở khóa tài khoản."
        : describeError(result.error, "Thao tác thất bại."),
    );
    if (response.ok) await reload();
  }

  async function remove(user: UserRow) {
    if (!confirm(`Xóa vĩnh viễn tài khoản ${user.email}?`)) return;
    setBusy(user.id);
    const response = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, {
      method: "DELETE",
    });
    const result = await response.json().catch(() => ({}));
    setBusy("");
    setMessage(
      response.ok
        ? "Đã xóa tài khoản."
        : describeError(result.error, "Không thể xóa tài khoản."),
    );
    if (response.ok) await reload();
  }

  return (
    <PortalLayout role="admin" userName="Admin" pageTitle="Tài khoản">
      <div className="mx-auto max-w-5xl space-y-6">
        <SectionHeader
          title="Quản lý tài khoản thật"
          subtitle={`${total} tài khoản Supabase Auth; không lưu mật khẩu dạng plaintext.`}
          action={
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Làm mới
            </Button>
          }
        />

        <Card>
          <CardContent className="grid gap-3 p-5 md:grid-cols-4">
            <Input
              placeholder="Họ và tên"
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
            />
            <Input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
            >
              <option value="student">Học viên</option>
              <option value="parent">Phụ huynh</option>
              <option value="teacher">Giáo viên</option>
              <option value="admin">Quản trị viên</option>
            </select>
            <Button
              onClick={() => void invite()}
              disabled={busy === "invite" || !form.email || !form.full_name}
            >
              <MailPlus className="mr-2 h-4 w-4" /> Gửi lời mời
            </Button>
          </CardContent>
        </Card>

        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Tìm theo tên hoặc email trong trang hiện tại"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="space-y-3">
          {filtered.map((user) => (
            <Card key={user.id}>
              <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{user.full_name || user.email}</p>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">{user.role ?? "chưa có vai trò"}</Badge>
                    {user.must_reset_password && <Badge variant="outline">Phải đổi mật khẩu</Badge>}
                    {user.disabled && <Badge variant="destructive">Đã khóa</Badge>}
                    {!user.has_profile && (
                      <Badge variant="destructive">Thiếu hồ sơ · không đăng nhập được</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === user.id}
                    onClick={() => void action(user, "send_reset")}
                  >
                    <KeyRound className="mr-1.5 h-4 w-4" /> Reset
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === user.id}
                    onClick={() => void action(user, user.disabled ? "enable" : "disable")}
                  >
                    {user.disabled
                      ? <Unlock className="mr-1.5 h-4 w-4" />
                      : <Lock className="mr-1.5 h-4 w-4" />}
                    {user.disabled ? "Mở khóa" : "Khóa"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy === user.id}
                    onClick={() => void remove(user)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Trang {page}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(current => Math.max(1, current - 1))}
            >
              Trang trước
            </Button>
            <Button
              variant="outline"
              disabled={!hasMore}
              onClick={() => setPage(current => current + 1)}
            >
              Trang sau
            </Button>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
