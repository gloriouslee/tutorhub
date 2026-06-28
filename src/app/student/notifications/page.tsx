"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data";
import { Bell, Check, CheckCircle2, AlertTriangle, Info, BookOpen } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function StudentNotificationsPage() {
  const notifications = MOCK_NOTIFICATIONS.filter(
    (n) => n.target_role === "student" || n.target_role === "all"
  );

  return (
    <PortalLayout role="student" userName="Nguyễn Anh Tuấn" pageTitle="Thông báo">
      <div className="space-y-6 max-w-4xl mx-auto">
        <SectionHeader 
          title="Thông báo của bạn" 
          subtitle="Cập nhật hệ thống, bài tập mới và kết quả học tập"
          action={
            <Button size="sm" variant="outline" className="text-muted-foreground hover:text-primary">
              <Check className="h-4 w-4 mr-1.5" /> Đánh dấu đã đọc tất cả
            </Button>
          }
        />

        <div className="space-y-3">
          {notifications.map((n, i) => {
            const isUnread = !n.is_read;
            
            let Icon = Info;
            let iconColorClass = "text-blue-500 bg-blue-100 dark:bg-blue-900/30";
            
            if (n.title.includes("Hệ thống") || n.title.includes("Bảo trì")) {
              Icon = AlertTriangle;
              iconColorClass = "text-amber-500 bg-amber-100 dark:bg-amber-900/30";
            } else if (n.title.includes("chấm") || n.title.includes("Điểm")) {
              Icon = CheckCircle2;
              iconColorClass = "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30";
            } else if (n.title.includes("Bài tập")) {
              Icon = BookOpen;
              iconColorClass = "text-purple-500 bg-purple-100 dark:bg-purple-900/30";
            }

            return (
              <Card 
                key={n.id} 
                className={`transition-all duration-200 animate-fade-in ${
                  isUnread ? "border-primary/40 shadow-sm bg-primary/5 dark:bg-primary/10" : "bg-card border-border/50"
                }`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <CardContent className="p-4 sm:p-5 flex gap-4">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${iconColorClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                      <h4 className={`text-base ${isUnread ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                        {n.title}
                      </h4>
                      <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap bg-muted/50 px-2 py-0.5 rounded-md">
                        {formatDate(n.created_at)}
                      </span>
                    </div>
                    
                    <p className={`text-sm leading-relaxed ${isUnread ? "text-foreground/90" : "text-muted-foreground"}`}>
                      {n.content}
                    </p>
                    
                    <div className="mt-3 flex gap-3">
                      {n.title.includes("Bài tập") && (
                        <Button size="sm" variant="gradient" className="h-8 text-xs px-4">
                          Làm bài ngay
                        </Button>
                      )}
                      {n.title.includes("chấm") && (
                        <Button size="sm" variant="outline" className="h-8 text-xs px-4 border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/50">
                          Xem điểm
                        </Button>
                      )}
                    </div>
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
          
          {notifications.length === 0 && (
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
