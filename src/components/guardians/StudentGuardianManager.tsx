"use client";

import { useCallback, useState } from "react";
import { CheckCircle2, Loader2, Mail, Unlink, UserRoundPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GUARDIAN_RELATIONSHIP_LABELS,
  type GuardianLink,
  type GuardianRelationship,
} from "@/lib/guardian-types";

function errorMessage(code: string) {
  const messages: Record<string, string> = {
    email_used_by_another_role: "Email này đang thuộc một tài khoản không phải phụ huynh.",
    guardian_already_linked: "Phụ huynh này đã được liên kết với học sinh.",
    account_already_exists_without_profile: "Email đã có tài khoản nhưng hồ sơ chưa hoàn chỉnh. Vui lòng nhờ admin kiểm tra.",
    invite_rate_limited: "Đã gửi quá nhiều lời mời. Vui lòng thử lại sau.",
    guardian_invite_email_failed: "Không thể gửi email mời lúc này.",
  };
  return messages[code] ?? "Không thể xử lý lời mời. Vui lòng thử lại.";
}

export function StudentGuardianManager({
  studentId,
  studentName,
  compact = false,
}: {
  studentId: string;
  studentName: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<GuardianLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState<GuardianRelationship>("mother");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/guardians?student_id=${encodeURIComponent(studentId)}`,
        { cache: "no-store", credentials: "same-origin" },
      );
      if (!response.ok) throw new Error("load_failed");
      setLinks(await response.json() as GuardianLink[]);
    } catch {
      setMessage("Không thể tải danh sách phụ huynh của học sinh.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  function show() {
    setOpen(true);
    setMessage("");
    void load();
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/guardians", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          full_name: fullName,
          email,
          relationship,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(result.error ?? "invite_failed"));
      setFullName("");
      setEmail("");
      await load();
      setMessage(
        result.warning === "email_not_sent"
          ? "Đã tạo lời mời nhưng email chưa gửi được. Phụ huynh vẫn thấy lời mời khi đăng nhập."
          : "Đã gửi lời mời. Phụ huynh cần đăng nhập và chấp nhận liên kết.",
      );
    } catch (error) {
      setMessage(errorMessage(error instanceof Error ? error.message : ""));
    } finally {
      setSaving(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Thu hồi liên kết hoặc lời mời này?")) return;
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/guardians/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("revoke_failed");
      await load();
      setMessage("Đã thu hồi liên kết.");
    } catch {
      setMessage("Không thể thu hồi liên kết. Vui lòng thử lại.");
    } finally {
      setBusyId("");
    }
  }

  const visibleLinks = links.filter((link) =>
    link.status === "pending" || link.status === "active",
  );

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={compact ? "h-8 text-xs" : undefined}
        onClick={show}
      >
        <UserRoundPlus className="mr-1.5 h-3.5 w-3.5" /> Phụ huynh
      </Button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-card p-5">
              <div>
                <h2 className="font-bold">Phụ huynh của {studentName}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Phụ huynh chỉ xem được dữ liệu sau khi tự chấp nhận lời mời.
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 p-5">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Liên kết hiện tại</h3>
                {loading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
                  </div>
                ) : visibleLinks.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Học sinh chưa có phụ huynh được liên kết.
                  </p>
                ) : visibleLinks.map((link) => (
                  <div key={link.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                      link.status === "active"
                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                        : "bg-amber-100 text-amber-600 dark:bg-amber-900/30"
                    }`}>
                      {link.status === "active"
                        ? <CheckCircle2 className="h-4 w-4" />
                        : <Mail className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {link.parent?.full_name ?? link.invited_email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {link.parent?.email ?? link.invited_email}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={link.status === "active" ? "success" : "warning"}>
                        {link.status === "active" ? "Đã xác nhận" : "Chờ xác nhận"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {GUARDIAN_RELATIONSHIP_LABELS[link.relationship]}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="Thu hồi"
                      className="h-8 w-8 text-red-600"
                      disabled={busyId === link.id}
                      onClick={() => void revoke(link.id)}
                    >
                      {busyId === link.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Unlink className="h-4 w-4" />}
                    </Button>
                  </div>
                ))}
              </section>

              <form onSubmit={invite} className="space-y-4 border-t border-border pt-5">
                <div>
                  <h3 className="text-sm font-semibold">Gửi lời mời mới</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tài khoản mới sẽ nhận email đặt mật khẩu; tài khoản đã có sẽ nhận liên kết đăng nhập.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    required
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Họ tên phụ huynh"
                  />
                  <Input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Email phụ huynh"
                  />
                </div>
                <select
                  value={relationship}
                  onChange={(event) => setRelationship(event.target.value as GuardianRelationship)}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  {(Object.entries(GUARDIAN_RELATIONSHIP_LABELS) as [GuardianRelationship, string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
                <div className="flex justify-end">
                  <Button type="submit" disabled={saving || !fullName.trim() || !email.trim()}>
                    {saving
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <Mail className="mr-2 h-4 w-4" />}
                    Gửi lời mời
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
