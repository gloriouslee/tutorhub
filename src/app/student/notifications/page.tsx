"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import {
  getScheduleNotifications,
  markScheduleNotificationsRead,
  getNotifications,
  type ScheduleNotification,
} from "@/lib/storage";
import { Bell, Check, CheckCircle2, AlertTriangle, Info, BookOpen, Calendar, Trash2 } from "lucide-react";
import { Notification } from "@/types";

// ── localStorage helpers ──────────────────────────────────────────────────────
const READ_KEY    = "tutorhub_notif_read";
const DELETED_KEY = "tutorhub_notif_deleted";

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

// ── Unified type ──────────────────────────────────────────────────────────────
type UnifiedNotif =
  | ({ source: "mock" }     & Notification)
  | ({ source: "schedule" } & ScheduleNotification);

type NotifCategory = "schedule" | "assignment" | "graded" | "system" | "info";

function categorize(n: UnifiedNotif): NotifCategory {
  if (n.source === "schedule") return "schedule";
  const notif = n as Notification;
  // Use explicit category field if set by admin
  if (notif.category === "assignment") return "assignment";
  if (notif.category === "graded")     return "graded";
  if (notif.category === "system")     return "system";
  // Fallback: keyword matching (for legacy mock data)
  const title = notif.title ?? "";
  if (title.includes("chấm") || title.includes("Điểm")) return "graded";
  if (title.includes("Bài tập"))  return "assignment";
  if (title.includes("Hệ thống") || title.includes("Bảo trì")) return "system";
  return "info";
}

const CATEGORY_META: Record<NotifCategory, {
  Icon: React.ElementType;
  iconColor: string;
  badge: string;
  badgeClass: string;
}> = {
  schedule:   { Icon: Calendar,      iconColor: "text-indigo-500 bg-indigo-100 dark:bg-indigo-900/30",  badge: "Lịch học",  badgeClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  assignment: { Icon: BookOpen,      iconColor: "text-purple-500 bg-purple-100 dark:bg-purple-900/30",  badge: "Bài tập",   badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  graded:     { Icon: CheckCircle2,  iconColor: "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30", badge: "Kết quả",  badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  system:     { Icon: AlertTriangle, iconColor: "text-amber-500 bg-amber-100 dark:bg-amber-900/30",    badge: "Hệ thống",  badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  info:       { Icon: Info,          iconColor: "text-blue-500 bg-blue-100 dark:bg-blue-900/30",        badge: "Thông tin", badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
};

export default function StudentNotificationsPage() {
  const router = useRouter();
  const [scheduleNotifs, setScheduleNotifs] = useState<ScheduleNotification[]>([]);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [readIds,    setReadIds]    = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  useEffect(() => {
    setScheduleNotifs(getScheduleNotifications());
    setReadIds(getReadIds());
    setDeletedIds(getDeletedIds());
    getNotifications().then(all =>
      setNotifs(all.filter(n => n.target_role === "student" || n.target_role === "all"))
    );
  }, []);

  const mockNotifs = notifs.filter(n => !deletedIds.has(n.id));
  const scheduleFiltered = scheduleNotifs.filter(n => !deletedIds.has(n.id));

  // Bug fix 3: sort by created_at descending across both sources
  const unified: UnifiedNotif[] = [
    ...scheduleFiltered.map(n => ({ source: "schedule" as const, ...n })),
    ...mockNotifs.map(n => ({ source: "mock" as const, ...n })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const isRead = (n: UnifiedNotif) => n.is_read || readIds.has(n.id);
  const unreadCount = unified.filter(n => !isRead(n)).length;

  const displayed = unified.filter(n => {
    if (filter === "unread") return !isRead(n);
    if (filter === "read")   return  isRead(n);
    return true;
  });

  const handleMarkAllRead = () => {
    markScheduleNotificationsRead();
    setScheduleNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    markAllReadIds(unified.map(n => n.id));
    setReadIds(getReadIds());
  };

  const handleMarkRead = (id: string) => {
    setScheduleNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    addReadId(id);
    setReadIds(getReadIds());
  };

  const handleDelete = (id: string) => {
    addDeletedId(id);
    setDeletedIds(getDeletedIds());
    setScheduleNotifs(prev => prev.filter(n => n.id !== id));
  };

  return (
    <PortalLayout role="student" userName="Nguyễn Anh Tuấn" pageTitle="Thông báo">
      <div className="space-y-6 max-w-3xl mx-auto">
        <SectionHeader
          title="Thông báo của bạn"
          subtitle={
            unreadCount > 0
              ? `${unreadCount} thông báo chưa đọc`
              : "Cập nhật lịch học, bài tập mới và kết quả học tập"
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
              {/* Bug fix 4: correct empty message based on actual state */}
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
              const title = n.source === "schedule"
                ? `Thay đổi lịch học — ${(n as ScheduleNotification).class_name}`
                : (n as Notification).title;
              const content = n.source === "schedule"
                ? (n as ScheduleNotification).message
                : (n as Notification).content;

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
                    {/* Icon — rounded-full, h-10 w-10 (teacher portal pattern) */}
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${iconColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title row: title left, badge + timestamp right (admin portal pattern) */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                        <h4 className={`text-sm ${unread ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                          {title}
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
                        {content}
                      </p>

                      {/* Sender */}
                      {n.source === "mock" && (n as Notification).sent_by && (
                        <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                          Gửi bởi: <span className="font-medium text-muted-foreground">{(n as Notification).sent_by}</span>
                        </p>
                      )}

                      {/* Action buttons */}
                      {cat === "schedule" && (
                        <div className="mt-3">
                          <Button
                            size="sm" variant="outline"
                            className="h-8 text-xs px-4 border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400"
                            onClick={e => { e.stopPropagation(); router.push("/student/schedule"); }}
                          >
                            <Calendar className="h-3.5 w-3.5 mr-1.5" /> Xem lịch học
                          </Button>
                        </div>
                      )}
                      {cat === "assignment" && (
                        <div className="mt-3">
                          <Button
                            size="sm" variant="gradient" className="h-8 text-xs px-4"
                            onClick={e => { e.stopPropagation(); router.push("/student/homework"); }}
                          >
                            <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Làm bài ngay
                          </Button>
                        </div>
                      )}
                      {cat === "graded" && (
                        <div className="mt-3">
                          <Button
                            size="sm" variant="outline"
                            className="h-8 text-xs px-4 border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
                            onClick={e => { e.stopPropagation(); router.push("/student/scores"); }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Xem điểm
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Right: unread dot + mark-read + delete (teacher portal pattern for dot) */}
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
