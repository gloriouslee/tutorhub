"use client";

import { useState, useEffect } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { Bell, Check, Trash2, BookOpen, CheckCircle2, AlertTriangle, Info, CreditCard } from "lucide-react";
import { getNotifications } from "@/lib/storage";
import { Notification } from "@/types";
import { useParentContext } from "@/hooks/useParentContext";
import { loadParentEventNotifications } from "@/lib/parent-data";

// ── localStorage helpers ──────────────────────────────────────────────────────
const READ_KEY    = "tutorhub_parent_notif_read";
const DELETED_KEY = "tutorhub_parent_notif_deleted";

function getReadIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? "[]")); } catch { return new Set(); }
}
function addReadId(id: string) {
  const s = getReadIds(); s.add(id);
  localStorage.setItem(READ_KEY, JSON.stringify([...s]));
}
function markAllReadIds(ids: string[]) {
  const s = getReadIds(); ids.forEach(id => s.add(id));
  localStorage.setItem(READ_KEY, JSON.stringify([...s]));
}
function getDeletedIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DELETED_KEY) ?? "[]")); } catch { return new Set(); }
}
function addDeletedId(id: string) {
  const s = getDeletedIds(); s.add(id);
  localStorage.setItem(DELETED_KEY, JSON.stringify([...s]));
}

// ── Relative time ─────────────────────────────────────────────────────────────
function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  const weeks = Math.floor(days / 7);
  if (mins  <  1) return "Vừa xong";
  if (mins  < 60) return `${mins} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days  <  7) return `${days} ngày trước`;
  if (weeks <  5) return `${weeks} tuần trước`;
  return new Date(isoString).toLocaleDateString("vi-VN");
}

// ── Category ──────────────────────────────────────────────────────────────────
type NotifCategory = "assignment" | "graded" | "system" | "info" | "payment";

const CATEGORY_META: Record<NotifCategory, { Icon: React.ElementType; iconColor: string; badge: string; badgeClass: string }> = {
  assignment: { Icon: BookOpen,      iconColor: "text-purple-500 bg-purple-100 dark:bg-purple-900/30",    badge: "Bài tập",   badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  graded:     { Icon: CheckCircle2,  iconColor: "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30", badge: "Kết quả",   badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  system:     { Icon: AlertTriangle, iconColor: "text-amber-500 bg-amber-100 dark:bg-amber-900/30",       badge: "Hệ thống",  badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  payment:    { Icon: CreditCard,    iconColor: "text-teal-500 bg-teal-100 dark:bg-teal-900/30",          badge: "Học phí",   badgeClass: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
  info:       { Icon: Info,          iconColor: "text-blue-500 bg-blue-100 dark:bg-blue-900/30",          badge: "Thông tin", badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
};

function categorize(n: Notification): NotifCategory {
  const c = (n as any).category;
  if (c === "assignment") return "assignment";
  if (c === "graded")     return "graded";
  if (c === "system")     return "system";
  if (c === "payment")    return "payment";
  const text = `${n.title ?? ""} ${n.content ?? ""}`.toLowerCase();
  if (text.includes("học phí") || text.includes("thanh toán") || text.includes("nhắc nhở học phí")) return "payment";
  if (text.includes("điểm") || text.includes("chấm")) return "graded";
  if (text.includes("hệ thống") || text.includes("bảo trì")) return "system";
  return "info";
}

export default function ParentNotificationsPage() {
  const { parentName, children, ready } = useParentContext();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [readIds,    setReadIds]    = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  useEffect(() => {
    if (!ready) return;
    setReadIds(getReadIds());
    setDeletedIds(getDeletedIds());
    (async () => {
      // Broadcast (trung tâm gửi) + sự kiện sinh từ dữ liệu thật của các con
      const [broadcasts, events] = await Promise.all([
        getNotifications(),
        loadParentEventNotifications(children),
      ]);
      const merged: Notification[] = [
        ...broadcasts.filter(n => n.target_role === "parent" || n.target_role === "all"),
        ...(events as unknown as Notification[]),
      ];
      setNotifs(merged.sort((a, b) => b.created_at.localeCompare(a.created_at)));
    })();
  }, [ready, children]);

  const visible = notifs.filter(n => !deletedIds.has(n.id));
  const isRead = (n: Notification) => n.is_read || readIds.has(n.id);
  const unreadCount = visible.filter(n => !isRead(n)).length;

  const displayed = visible.filter(n => {
    if (filter === "unread") return !isRead(n);
    if (filter === "read")   return  isRead(n);
    return true;
  });

  const handleMarkAllRead = () => {
    markAllReadIds(visible.map(n => n.id));
    setReadIds(getReadIds());
  };

  const handleMarkRead = (id: string) => {
    addReadId(id);
    setReadIds(getReadIds());
  };

  const handleDelete = (id: string) => {
    addDeletedId(id);
    setDeletedIds(getDeletedIds());
  };

  return (
    <PortalLayout role="parent" userName={parentName} pageTitle="Thông báo">
      <div className="space-y-6 max-w-3xl mx-auto">
        <SectionHeader
          title="Thông báo"
          subtitle={
            unreadCount > 0
              ? `${unreadCount} thông báo chưa đọc`
              : "Cập nhật từ trung tâm gửi đến phụ huynh"
          }
          action={
            unreadCount > 0 ? (
              <Button size="sm" variant="outline" className="text-muted-foreground hover:text-primary" onClick={handleMarkAllRead}>
                <Check className="h-4 w-4 mr-1.5" /> Đánh dấu tất cả đã đọc
              </Button>
            ) : undefined
          }
        />

        {/* Filter tabs */}
        <div className="flex items-center gap-2">
          {(["all", "unread", "read"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                filter === f
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {{ all: "Tất cả", unread: "Chưa đọc", read: "Đã đọc" }[f]}
              {f === "unread" && unreadCount > 0 && (
                <span className="ml-1.5 bg-primary-foreground/20 text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-2.5">
          {displayed.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground border-2 border-dashed border-border/50 rounded-xl">
              <Bell className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p className="font-medium">
                {filter === "unread" && unreadCount === 0
                  ? "Bạn đã đọc hết thông báo."
                  : "Không có thông báo nào."}
              </p>
            </div>
          ) : (
            displayed.map((n, i) => {
              const unread = !isRead(n);
              const cat = categorize(n);
              const { Icon, iconColor, badge, badgeClass } = CATEGORY_META[cat];

              return (
                <Card
                  key={n.id}
                  onClick={() => { if (unread) handleMarkRead(n.id); }}
                  className={`transition-all duration-200 animate-fade-in cursor-pointer ${
                    unread
                      ? "border-primary/30 shadow-md bg-primary/5 dark:bg-primary/10"
                      : "bg-card"
                  }`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <CardContent className="p-4 sm:p-5 flex gap-4">
                    {/* Icon */}
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${iconColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                        <h4 className={`text-sm ${unread ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                          {n.title}
                        </h4>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${badgeClass}`}>
                            {badge}
                          </span>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {relativeTime(n.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Body */}
                      <p className={`text-sm leading-relaxed ${unread ? "text-foreground/90" : "text-muted-foreground"}`}>
                        {n.content}
                      </p>

                      {/* Sender */}
                      {n.sent_by && (
                        <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                          Gửi bởi: <span className="font-medium text-muted-foreground">{n.sent_by}</span>
                        </p>
                      )}
                    </div>

                    {/* Right: unread dot + mark-read + delete */}
                    <div className="shrink-0 flex flex-col items-center gap-1.5 pt-0.5">
                      {unread && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                      {unread && (
                        <button
                          title="Đánh dấu đã đọc"
                          onClick={e => { e.stopPropagation(); handleMarkRead(n.id); }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        title="Xóa thông báo"
                        onClick={e => { e.stopPropagation(); handleDelete(n.id); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
