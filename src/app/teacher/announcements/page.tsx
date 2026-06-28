"use client";

import { useState, useEffect } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Send, BookOpen, CheckCircle2, AlertTriangle, Info, Calendar,
  Users, School, Trash2, Bell,
} from "lucide-react";
import { getNotifications, saveNotifications } from "@/lib/storage";
import { Notification, NotificationCategory } from "@/types";
import { formatDate } from "@/lib/utils";
import { MOCK_CLASSES } from "@/lib/mock-data";

const TEACHER_ID   = "t1";
const TEACHER_NAME = "Tiến sĩ Sarah Mitchell";
const TEACHER_INITIALS = "SM";

// Classes this teacher teaches
const MY_CLASSES = MOCK_CLASSES.filter(c => c.tutor_id === TEACHER_ID);

const CATEGORY_OPTIONS: { value: NotificationCategory; label: string; Icon: React.ElementType; color: string }[] = [
  { value: "general",    label: "Thông tin chung",   Icon: Info,          color: "text-blue-500" },
  { value: "assignment", label: "Bài tập mới",       Icon: BookOpen,      color: "text-purple-500" },
  { value: "graded",     label: "Kết quả / Điểm số", Icon: CheckCircle2,  color: "text-emerald-500" },
  { value: "system",     label: "Nhắc nhở lịch học", Icon: Calendar,      color: "text-indigo-500" },
];

const TARGET_OPTIONS = [
  { value: "all-students", label: "Tất cả học viên của tôi", Icon: Users },
  ...MY_CLASSES.map(c => ({ value: c.id, label: c.class_name, Icon: School })),
];

export default function TeacherAnnouncementsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filterClass, setFilterClass] = useState<string>("all");
  const [title,    setTitle]    = useState("");
  const [content,  setContent]  = useState("");
  const [category, setCategory] = useState<NotificationCategory>("general");
  const [target,   setTarget]   = useState("all-students");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const all = await getNotifications();
    setNotifications(
      all.filter(n => n.sent_by === TEACHER_NAME)
         .sort((a, b) => b.created_at.localeCompare(a.created_at))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);

    const targetClass = MY_CLASSES.find(c => c.id === target);
    const all = await getNotifications();
    const newNotif: Notification = {
      id: `notif-${Date.now()}`,
      title:   title.trim(),
      content: content.trim(),
      target_role: "student",
      category,
      sent_by: TEACHER_NAME,
      target_class_id:   targetClass?.id,
      target_class_name: targetClass?.class_name,
      is_read:    false,
      created_at: new Date().toISOString(),
    };
    await saveNotifications([newNotif, ...all]);
    setTitle(""); setContent(""); setCategory("general"); setTarget("all-students");
    setSubmitting(false);
    await load();
  }

  async function handleDelete(id: string) {
    const all = await getNotifications();
    await saveNotifications(all.filter(n => n.id !== id));
    await load();
  }

  const displayed = notifications.filter(n =>
    filterClass === "all" ? true : n.target_class_id === filterClass || (!n.target_class_id && filterClass === "all")
  );

  const catMap = Object.fromEntries(CATEGORY_OPTIONS.map(o => [o.value, o]));

  return (
    <PortalLayout role="teacher" userName={TEACHER_NAME} pageTitle="Thông báo lớp học">
      <div className="space-y-6">
        <SectionHeader
          title="Thông báo lớp học"
          subtitle="Gửi cập nhật và thông tin quan trọng đến học viên"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ── Composer ────────────────────────────────────── */}
          <Card className="lg:col-span-1 border border-border">
            <CardHeader className="border-b border-border bg-muted/10 px-5 py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" /> Soạn thông báo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Gửi đến */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Gửi đến *
                  </label>
                  <div className="space-y-1.5">
                    {TARGET_OPTIONS.map(opt => {
                      const Icon = opt.Icon;
                      const selected = target === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setTarget(opt.value)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                            selected
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/40"
                          }`}
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="truncate">{opt.label}</span>
                          {selected && <div className="ml-auto h-2 w-2 rounded-full bg-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Loại thông báo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Loại thông báo *
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CATEGORY_OPTIONS.map(opt => {
                      const selected = category === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setCategory(opt.value)}
                          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold transition-all ${
                            selected
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/40"
                          }`}
                        >
                          <opt.Icon className={`h-3.5 w-3.5 ${selected ? "text-primary" : opt.color}`} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tiêu đề */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tiêu đề *</label>
                  <Input
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="VD: Bài tập tuần này đã có rồi nhé!"
                  />
                </div>

                {/* Nội dung */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nội dung *</label>
                  <textarea
                    required
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    className="flex min-h-[110px] w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none"
                    placeholder="Viết nội dung thông báo gửi đến học viên..."
                  />
                </div>

                <Button type="submit" variant="gradient" className="w-full font-bold" disabled={submitting}>
                  <Send className="h-4 w-4 mr-2" />
                  {submitting ? "Đang gửi..." : "Gửi thông báo"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* ── Feed ─────────────────────────────────────────── */}
          <Card className="lg:col-span-2 border border-border">
            <CardHeader className="border-b border-border bg-muted/10 px-5 py-4 flex flex-row items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-sm font-bold">Thông báo đã gửi</CardTitle>
              {/* Filter by class */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setFilterClass("all")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                    filterClass === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  Tất cả
                </button>
                {MY_CLASSES.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setFilterClass(c.id)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                      filterClass === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {c.class_name}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {displayed.length === 0 ? (
                <div className="py-16 flex flex-col items-center text-center text-muted-foreground">
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Bell className="h-6 w-6 opacity-30" />
                  </div>
                  <p className="font-medium text-sm">Chưa có thông báo nào.</p>
                  <p className="text-xs mt-1">Soạn thông báo bên trái để gửi đến học viên.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {displayed.map((n, i) => {
                    const cat = catMap[n.category ?? "general"] ?? catMap.general;
                    return (
                      <div
                        key={n.id}
                        className="p-4 sm:p-5 flex gap-3 hover:bg-muted/10 transition-colors animate-fade-in"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        {/* Avatar */}
                        <Avatar className="h-9 w-9 border border-border shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {TEACHER_INITIALS}
                          </AvatarFallback>
                        </Avatar>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1">
                          {/* Row 1: name + target badge + time */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-foreground">{TEACHER_NAME}</span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              n.target_class_id
                                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                                : "bg-muted text-muted-foreground"
                            }`}>
                              {n.target_class_id ? <School className="h-2.5 w-2.5" /> : <Users className="h-2.5 w-2.5" />}
                              {n.target_class_name ?? "Tất cả học viên"}
                            </span>
                            <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                              {formatDate(n.created_at)}
                            </span>
                          </div>

                          {/* Row 2: category icon + title */}
                          <div className="flex items-center gap-1.5">
                            <cat.Icon className={`h-3.5 w-3.5 shrink-0 ${cat.color}`} />
                            <h5 className="text-sm font-semibold text-foreground">{n.title}</h5>
                          </div>

                          {/* Row 3: content */}
                          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {n.content}
                          </p>
                        </div>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(n.id)}
                          title="Xóa thông báo"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all self-start shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
