"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Bell, Send, Check, Trash2, BookOpen, CheckCircle2, AlertTriangle, Info, CreditCard } from "lucide-react";
import { useState, useEffect } from "react";
import { getNotifications, saveNotifications } from "@/lib/storage";
import { Notification } from "@/types";

// ── localStorage helpers ──────────────────────────────────────────────────────
const READ_KEY    = "tutorhub_admin_notif_read";
const DELETED_KEY = "tutorhub_admin_notif_deleted";

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
  return "info";
}

const ROLE_LABELS: Record<string, string> = {
  all:     "Tất cả vai trò",
  student: "Học viên",
  parent:  "Phụ huynh",
  teacher: "Giáo viên",
};

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds,    setReadIds]    = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [filterRole, setFilterRole] = useState<"all" | "student" | "parent" | "teacher">("all");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetRole, setTargetRole] = useState<"all" | "student" | "parent" | "teacher">("all");
  const [category, setCategory] = useState<"general" | "assignment" | "graded" | "system">("general");
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    setReadIds(getReadIds());
    setDeletedIds(getDeletedIds());
    getNotifications().then(setNotifications);
  }, []);

  const isRead = (n: Notification) => n.is_read || readIds.has(n.id);

  const visible = notifications.filter(n => !deletedIds.has(n.id));
  const unreadCount = visible.filter(n => !isRead(n)).length;

  const filtered = visible.filter(n =>
    filterRole === "all" ? true : n.target_role === filterRole
  );

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;

    const newNotification: Notification = {
      id: `n${notifications.length + 1}-${Math.floor(Math.random() * 1000)}`,
      title,
      content,
      target_role: targetRole,
      category,
      sent_by: "Quản trị viên",
      is_read: false,
      created_at: new Date().toISOString(),
    };

    const updated = [newNotification, ...notifications];
    setNotifications(updated);
    await saveNotifications(updated);

    setTitle("");
    setContent("");
    setTargetRole("all");
    setCategory("general");
    setToastMessage("Đã gửi thông báo thành công!");
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleMarkAllRead = () => {
    markAllReadIds(visible.map(n => n.id));
    setReadIds(getReadIds());
  };

  const handleMarkRead = (id: string) => {
    addReadId(id);
    setReadIds(getReadIds());
  };

  const handleDeleteNotification = async (id: string) => {
    addDeletedId(id);
    setDeletedIds(getDeletedIds());
    // Also remove globally so other portals don't see it
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    await saveNotifications(updated);
  };

  return (
    <PortalLayout role="admin" userName="Admin User" pageTitle="Thông báo">
      <div className="space-y-6">
        <SectionHeader
          title="Thông báo & Tin tức"
          subtitle="Gửi thông báo đến học viên, phụ huynh và giáo viên"
          action={
            unreadCount > 0 ? (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="flex items-center gap-1.5 font-semibold">
                <Check className="h-4 w-4 text-emerald-500" /> Đánh dấu đã đọc
              </Button>
            ) : undefined
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form tạo thông báo */}
          <Card className="lg:col-span-1 border border-border h-fit">
            <CardHeader className="border-b border-border bg-muted/10">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Send className="h-4 w-4 text-rose-500" /> Soạn thông báo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Đối tượng nhận *</label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
                    value={targetRole}
                    onChange={e => setTargetRole(e.target.value as any)}
                  >
                    <option value="all">Tất cả (Mọi vai trò)</option>
                    <option value="student">Cổng Học viên</option>
                    <option value="parent">Cổng Phụ huynh</option>
                    <option value="teacher">Cổng Giáo viên</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Loại thông báo *</label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                  >
                    <option value="general">📢 Thông tin chung</option>
                    <option value="assignment">📚 Bài tập mới</option>
                    <option value="graded">✅ Kết quả / Điểm số</option>
                    <option value="system">⚠️ Hệ thống / Bảo trì</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Tiêu đề *</label>
                  <Input
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="VD: Thông báo Nghỉ lễ Quốc khánh"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Nội dung *</label>
                  <textarea
                    required
                    className="flex min-h-[100px] w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground text-foreground"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Viết nội dung thông báo gửi đến các tài khoản..."
                  />
                </div>

                <Button type="submit" variant="gradient" className="w-full flex items-center justify-center gap-2 mt-4 font-bold">
                  <Send className="h-4 w-4" /> Gửi thông báo
                </Button>

                {toastMessage && (
                  <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center gap-2 animate-fade-in">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{toastMessage}</span>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Danh sách thông báo */}
          <Card className="lg:col-span-2 border border-border">
            <CardHeader className="pb-3 border-b border-border bg-muted/10 flex flex-row items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-sm font-bold">Lịch sử thông báo</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {(["all", "student", "parent", "teacher"] as const).map(role => (
                  <button
                    key={role}
                    onClick={() => setFilterRole(role)}
                    className={`px-3 py-1 text-[10px] font-semibold rounded-lg transition-all ${
                      filterRole === role
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <Bell className="h-8 w-8 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">Chưa có thông báo nào.</p>
                  </div>
                ) : (
                  filtered.map((n, idx) => {
                    const unread = !isRead(n);
                    const cat = categorize(n);
                    const { Icon, iconColor, badge, badgeClass } = CATEGORY_META[cat];

                    return (
                      <div
                        key={n.id}
                        onClick={() => { if (unread) handleMarkRead(n.id); }}
                        className={`p-4 flex gap-3 hover:bg-muted/10 transition-colors animate-fade-in cursor-pointer ${
                          unread ? "bg-primary/5 dark:bg-primary/10" : ""
                        }`}
                        style={{ animationDelay: `${idx * 20}ms` }}
                      >
                        {/* Icon */}
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${iconColor}`}>
                          <Icon className="h-5 w-5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <h5 className={`text-sm ${unread ? "font-bold text-foreground" : "font-medium text-foreground/80"} truncate max-w-[80%]`}>
                              {n.title}
                            </h5>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${badgeClass}`}>
                                {badge}
                              </span>
                              <span className="text-[10px] bg-muted text-muted-foreground font-semibold px-1.5 py-0.5 rounded">
                                {ROLE_LABELS[n.target_role] ?? n.target_role}
                              </span>
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                {relativeTime(n.created_at)}
                              </span>
                            </div>
                          </div>
                          <p className={`text-xs leading-relaxed whitespace-pre-wrap ${unread ? "text-foreground/90" : "text-muted-foreground"}`}>
                            {n.content}
                          </p>
                          {n.sent_by && (
                            <p className="text-[10px] text-muted-foreground/70">
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
                            onClick={e => { e.stopPropagation(); handleDeleteNotification(n.id); }}
                            className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                            title="Xóa thông báo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
