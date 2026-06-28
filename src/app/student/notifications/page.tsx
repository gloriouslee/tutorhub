"use client";

import { useState, useEffect } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data";
import {
  getScheduleNotifications,
  markScheduleNotificationsRead,
  type ScheduleNotification,
} from "@/lib/storage";
import { Bell, Check, CheckCircle2, AlertTriangle, Info, BookOpen, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Notification } from "@/types";

type UnifiedNotif =
  | ({ source: "mock" } & Notification)
  | ({ source: "schedule" } & ScheduleNotification);

function getIcon(n: UnifiedNotif) {
  if (n.source === "schedule") {
    return { Icon: Calendar, color: "text-indigo-500 bg-indigo-100 dark:bg-indigo-900/30" };
  }
  const title = (n as Notification).title ?? "";
  if (title.includes("Hệ thống") || title.includes("Bảo trì"))
    return { Icon: AlertTriangle, color: "text-amber-500 bg-amber-100 dark:bg-amber-900/30" };
  if (title.includes("chấm") || title.includes("Điểm"))
    return { Icon: CheckCircle2, color: "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30" };
  if (title.includes("Bài tập"))
    return { Icon: BookOpen, color: "text-purple-500 bg-purple-100 dark:bg-purple-900/30" };
  return { Icon: Info, color: "text-blue-500 bg-blue-100 dark:bg-blue-900/30" };
}

export default function StudentNotificationsPage() {
  const [scheduleNotifs, setScheduleNotifs] = useState<ScheduleNotification[]>([]);

  useEffect(() => {
    setScheduleNotifs(getScheduleNotifications());
  }, []);

  const mockNotifs = MOCK_NOTIFICATIONS.filter(
    n => n.target_role === "student" || n.target_role === "all"
  );

  // Merge: schedule notifications come first (newest), then mock
  const unified: UnifiedNotif[] = [
    ...scheduleNotifs.map(n => ({ source: "schedule" as const, ...n })),
    ...mockNotifs.map(n => ({ source: "mock" as const, ...n })),
  ];

  const unreadCount = scheduleNotifs.filter(n => !n.is_read).length + mockNotifs.filter(n => !n.is_read).length;

  const handleMarkAllRead = () => {
    markScheduleNotificationsRead();
    setScheduleNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  return (
    <PortalLayout role="student" userName="Nguyễn Anh Tuấn" pageTitle="Thông báo">
      <div className="space-y-6 max-w-4xl mx-auto">
        <SectionHeader
          title="Thông báo của bạn"
          subtitle={`${unreadCount > 0 ? `${unreadCount} chưa đọc · ` : ""}Cập nhật lịch học, bài tập mới và kết quả học tập`}
          action={
            <Button size="sm" variant="outline" className="text-muted-foreground hover:text-primary" onClick={handleMarkAllRead}>
              <Check className="h-4 w-4 mr-1.5" /> Đánh dấu đã đọc tất cả
            </Button>
          }
        />

        <div className="space-y-3">
          {unified.map((n, i) => {
            const isUnread = !n.is_read;
            const { Icon, color } = getIcon(n);

            const title = n.source === "schedule"
              ? `Thay đổi lịch học — ${(n as ScheduleNotification).class_name}`
              : (n as Notification).title;

            const content = n.source === "schedule"
              ? (n as ScheduleNotification).message
              : (n as Notification).content;

            const createdAt = n.created_at;

            return (
              <Card
                key={n.id}
                className={`transition-all duration-200 animate-fade-in ${
                  isUnread ? "border-primary/40 shadow-sm bg-primary/5 dark:bg-primary/10" : "bg-card border-border/50"
                }`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <CardContent className="p-4 sm:p-5 flex gap-4">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                      <h4 className={`text-base ${isUnread ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                        {title}
                      </h4>
                      <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap bg-muted/50 px-2 py-0.5 rounded-md">
                        {formatDate(createdAt)}
                      </span>
                    </div>

                    <p className={`text-sm leading-relaxed ${isUnread ? "text-foreground/90" : "text-muted-foreground"}`}>
                      {content}
                    </p>

                    {n.source === "schedule" && (
                      <div className="mt-3">
                        <Button size="sm" variant="outline" className="h-8 text-xs px-4 border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400">
                          Xem lịch học
                        </Button>
                      </div>
                    )}

                    {n.source === "mock" && (n as Notification).title.includes("Bài tập") && (
                      <div className="mt-3">
                        <Button size="sm" variant="gradient" className="h-8 text-xs px-4">Làm bài ngay</Button>
                      </div>
                    )}
                    {n.source === "mock" && (n as Notification).title.includes("chấm") && (
                      <div className="mt-3">
                        <Button size="sm" variant="outline" className="h-8 text-xs px-4 border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400">
                          Xem điểm
                        </Button>
                      </div>
                    )}
                  </div>

                  {isUnread && (
                    <div className="shrink-0 flex items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {unified.length === 0 && (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border/50 rounded-xl">
              <Bell className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p>Bạn không có thông báo nào mới.</p>
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
