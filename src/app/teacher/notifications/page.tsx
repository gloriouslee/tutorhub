import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data";
import { Check, CheckCircle2, AlertTriangle, Info, MessageSquare } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getCurrentUserName } from "@/lib/auth";

export default async function TeacherNotificationsPage() {
  const userName = await getCurrentUserName();
  const notifications = MOCK_NOTIFICATIONS.filter(
    (n) => n.target_role === "teacher" || n.target_role === "all"
  );

  return (
    <PortalLayout role="teacher" userName={userName} pageTitle="Thông báo hệ thống">
      <div className="space-y-6 max-w-4xl mx-auto">
        <SectionHeader 
          title="Tất cả thông báo" 
          subtitle="Cập nhật hệ thống, lời nhắc lịch dạy và tương tác học viên"
          action={
            <Button size="sm" variant="outline" className="text-muted-foreground">
              <Check className="h-4 w-4 mr-1.5" /> Đánh dấu đã đọc tất cả
            </Button>
          }
        />

        <div className="space-y-3">
          {notifications.map((n, i) => {
            const isUnread = !n.is_read;
            // Map types to icons and colors
            let Icon = Info;
            let iconColorClass = "text-blue-500 bg-blue-100 dark:bg-blue-900/30";
            
            if (n.target_role === "admin") {
              Icon = AlertTriangle;
              iconColorClass = "text-amber-500 bg-amber-100 dark:bg-amber-900/30";
            } else if (n.target_role === "student") {
              Icon = CheckCircle2;
              iconColorClass = "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30";
            } else if (n.target_role === "parent") {
              Icon = MessageSquare;
              iconColorClass = "text-purple-500 bg-purple-100 dark:bg-purple-900/30";
            }

            return (
              <Card 
                key={n.id} 
                className={`transition-all duration-200 animate-fade-in ${
                  isUnread ? "border-primary/30 shadow-md bg-primary/5" : "bg-card"
                }`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <CardContent className="p-4 sm:p-5 flex gap-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${iconColorClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <h4 className={`text-sm ${isUnread ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                        {n.title}
                      </h4>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatDate(n.created_at)}
                      </span>
                    </div>
                    <p className={`text-sm leading-relaxed ${isUnread ? "text-foreground/90" : "text-muted-foreground"}`}>
                      {n.content}
                    </p>
                    
                  </div>
                  
                  {isUnread && (
                    <div className="shrink-0 flex items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </PortalLayout>
  );
}
