"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Link2, Loader2, ShieldCheck, Unlink, XCircle } from "lucide-react";
import PortalLayout from "@/components/layout/PortalLayout";
import { SectionHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { resetAccountContextCache } from "@/hooks/useAccountContext";
import { useParentContext } from "@/hooks/useParentContext";
import {
  GUARDIAN_RELATIONSHIP_LABELS,
  type GuardianLink,
} from "@/lib/guardian-types";

function invitationErrorMessage(code: string) {
  const messages: Record<string, string> = {
    invalid_origin: "Phiên làm việc không hợp lệ. Hãy tải lại trang rồi thử lại.",
    invitation_not_found: "Lời mời không còn tồn tại hoặc không thuộc tài khoản này.",
    invitation_already_processed: "Lời mời này đã được xử lý ở một phiên khác.",
    invitation_lookup_failed: "Chưa thể kiểm tra lời mời trên hệ thống. Vui lòng thử lại.",
    invitation_update_failed: "Chưa thể cập nhật lời mời trên hệ thống. Vui lòng thử lại.",
  };
  return messages[code] ?? "Không thể xử lý lời mời. Vui lòng thử lại.";
}

export default function ParentInvitationsPage() {
  const { parentName } = useParentContext();
  const [links, setLinks] = useState<GuardianLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/guardians?mine=1", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("load_failed");
      setLinks(await response.json() as GuardianLink[]);
    } catch {
      setMessage("Không thể tải danh sách liên kết. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function respond(id: string, action: "accept" | "reject") {
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/guardians/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json().catch(() => ({})) as {
        error?: string;
        alreadyProcessed?: boolean;
      };
      if (!response.ok) throw new Error(result.error ?? "update_failed");
      setLinks((current) => current.map((link) => link.id === id
        ? {
            ...link,
            status: action === "accept" ? "active" : "rejected",
          }
        : link));
      if (action === "accept") resetAccountContextCache();
      setMessage(
        result.alreadyProcessed
          ? "Lời mời này đã được xử lý trước đó. Danh sách đã được đồng bộ."
          : action === "accept"
          ? "Đã liên kết học sinh với tài khoản phụ huynh của bạn."
          : "Đã từ chối lời mời liên kết.",
      );
    } catch (error) {
      setMessage(invitationErrorMessage(error instanceof Error ? error.message : ""));
    } finally {
      setBusyId("");
    }
  }

  async function unlink(id: string) {
    if (!confirm("Ngắt liên kết với học sinh này? Bạn sẽ không còn xem được dữ liệu của em.")) return;
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/guardians/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("unlink_failed");
      resetAccountContextCache();
      await load();
      setMessage("Đã ngắt liên kết học sinh.");
    } catch {
      setMessage("Không thể ngắt liên kết. Vui lòng thử lại.");
    } finally {
      setBusyId("");
    }
  }

  const pending = links.filter((link) => link.status === "pending");
  const active = links.filter((link) => link.status === "active");

  return (
    <PortalLayout role="parent" userName={parentName} pageTitle="Liên kết học sinh">
      <div className="mx-auto max-w-4xl space-y-6">
        <SectionHeader
          title="Liên kết học sinh"
          subtitle="Chỉ chấp nhận khi bạn xác nhận đúng học sinh mình đang chăm sóc."
        />

        {message && (
          <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm" role="status">
            {message}
          </p>
        )}

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Đang tải lời mời liên kết…
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Lời mời đang chờ</h2>
                {pending.length > 0 && <Badge>{pending.length}</Badge>}
              </div>
              {pending.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Hiện không có lời mời liên kết nào đang chờ.
                  </CardContent>
                </Card>
              ) : pending.map((link) => (
                <Card key={link.id} className="border-primary/20">
                  <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Link2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{link.student?.full_name ?? link.student_id}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[link.student?.grade, link.student?.school].filter(Boolean).join(" · ") || "Học sinh TutorHub"}
                      </p>
                      <Badge variant="outline" className="mt-2">
                        {GUARDIAN_RELATIONSHIP_LABELS[link.relationship]}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="text-red-600"
                        disabled={busyId === link.id}
                        onClick={() => void respond(link.id, "reject")}
                      >
                        <XCircle className="mr-1.5 h-4 w-4" /> Từ chối
                      </Button>
                      <Button
                        disabled={busyId === link.id}
                        onClick={() => void respond(link.id, "accept")}
                      >
                        {busyId === link.id
                          ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                        Chấp nhận
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>

            <section className="space-y-3">
              <h2 className="font-semibold">Đang liên kết</h2>
              {active.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center py-12 text-center">
                    <ShieldCheck className="mb-3 h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm font-medium">Chưa liên kết học sinh</p>
                    <p className="mt-1 max-w-md text-xs text-muted-foreground">
                      Hãy yêu cầu giáo viên gửi lời mời đến đúng email tài khoản này.
                    </p>
                  </CardContent>
                </Card>
              ) : active.map((link) => (
                <Card key={link.id}>
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{link.student?.full_name ?? link.student_id}</p>
                      <p className="text-xs text-muted-foreground">
                        {GUARDIAN_RELATIONSHIP_LABELS[link.relationship]} · Đã xác nhận
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600"
                      disabled={busyId === link.id}
                      onClick={() => void unlink(link.id)}
                    >
                      <Unlink className="mr-1.5 h-4 w-4" /> Ngắt liên kết
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </section>
          </>
        )}
      </div>
    </PortalLayout>
  );
}
