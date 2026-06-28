"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Bell, Send, Users, Check, Trash2, ShieldAlert } from "lucide-react";
import { useState, useEffect } from "react";
import { getNotifications, saveNotifications } from "@/lib/storage";
import { Notification } from "@/types";
import { formatDate } from "@/lib/utils";

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filterRole, setFilterRole] = useState<"all" | "student" | "parent" | "teacher">("all");

  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetRole, setTargetRole] = useState<"all" | "student" | "parent" | "teacher">("all");
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      setNotifications(await getNotifications());
    }
    loadData();
  }, []);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;

    const newNotification: Notification = {
      id: `n${notifications.length + 1}-${Math.floor(Math.random() * 1000)}`,
      title,
      content,
      target_role: targetRole,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    const updated = [newNotification, ...notifications];
    setNotifications(updated);
    await saveNotifications(updated);

    // Reset form
    setTitle("");
    setContent("");
    setTargetRole("all");

    // Success toast
    setToastMessage("Announcement broadcasted successfully!");
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleMarkAllRead = async () => {
    const updated = notifications.map(n => ({ ...n, is_read: true }));
    setNotifications(updated);
    await saveNotifications(updated);
  };

  const handleDeleteNotification = async (id: string) => {
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    await saveNotifications(updated);
  };

  const filtered = notifications.filter(n => {
    if (filterRole === "all") return true;
    return n.target_role === filterRole;
  });

  return (
    <PortalLayout role="admin" userName="Admin User" pageTitle="Thông báo">
      <div className="space-y-6">
        <SectionHeader
          title="Announcements & Alerts"
          subtitle="Broadcast news to teachers, students, and parent portals"
          action={
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="flex items-center gap-1.5 font-semibold">
              <Check className="h-4 w-4 text-emerald-500" /> Mark All Read
            </Button>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel: Create Form */}
          <Card className="lg:col-span-1 border border-border h-fit">
            <CardHeader className="border-b border-border bg-muted/10">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Send className="h-4 w-4 text-rose-500" /> Dispatch Announcement
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Target Audience *</label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
                    value={targetRole}
                    onChange={e => setTargetRole(e.target.value as any)}
                  >
                    <option value="all">Everyone (All Roles)</option>
                    <option value="student">Students Portal</option>
                    <option value="parent">Parents Portal</option>
                    <option value="teacher">Teachers Portal</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Title *</label>
                  <Input
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="VD: Thông báo Nghỉ lễ Quốc khánh"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Announcement Body *</label>
                  <textarea
                    required
                    className="flex min-h-[100px] w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground text-foreground"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Viết nội dung thông báo gửi đến các tài khoản..."
                  />
                </div>

                <Button type="submit" variant="gradient" className="w-full flex items-center justify-center gap-2 mt-4 font-bold">
                  <Send className="h-4 w-4" /> Broadcast Announcement
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

          {/* Right Panel: Feed */}
          <Card className="lg:col-span-2 border border-border">
            <CardHeader className="pb-3 border-b border-border bg-muted/10 flex flex-row items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-sm font-bold">Historical Broadcast Feed</CardTitle>
              <div className="flex items-center gap-2">
                {(["all", "student", "parent", "teacher"] as const).map(role => (
                  <button
                    key={role}
                    onClick={() => setFilterRole(role)}
                    className={`px-3 py-1 text-[10px] font-semibold rounded-lg capitalize transition-all ${
                      filterRole === role
                        ? "bg-rose-500 text-white shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground text-sm">
                    No announcements in feed.
                  </div>
                ) : (
                  filtered.map((n, idx) => (
                    <div key={n.id} className={`p-4 flex gap-3 hover:bg-muted/10 transition-colors animate-fade-in ${!n.is_read ? "bg-rose-500/5" : ""}`} style={{ animationDelay: `${idx * 20}ms` }}>
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                        !n.is_read ? "bg-rose-100 text-rose-500 dark:bg-rose-950/20" : "bg-muted text-muted-foreground"
                      }`}>
                        {n.target_role === "all" ? <Users className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between flex-wrap gap-2">
                          <h5 className="text-sm font-bold text-foreground truncate max-w-[80%]">
                            {n.title}
                          </h5>
                          <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {n.target_role}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {n.content}
                        </p>
                        <p className="text-[10px] text-muted-foreground pt-1.5 flex items-center gap-1.5">
                          <span>{formatDate(n.created_at)}</span>
                          {!n.is_read && (
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                          )}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDeleteNotification(n.id)}
                        className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all self-start"
                        title="Delete announcement"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
