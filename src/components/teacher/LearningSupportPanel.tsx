"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  FileClock,
  Loader2,
  RefreshCw,
  Send,
  UserRoundCheck,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/shared";

type SupportSignal = { type: string; title: string; detail: string; value: number };
type SupportAlert = {
  id: string;
  studentId: string;
  studentName: string;
  avatarUrl: string | null;
  classId: string;
  className: string;
  priority: "high" | "medium" | "low";
  priorityScore: number;
  signals: SupportSignal[];
  status: "open" | "monitoring";
};
type TopicInsight = {
  id: string;
  studentName: string;
  className: string;
  topic: string;
  masteryPercent: number;
  incorrectQuestions: number;
  totalQuestions: number;
  recommendedResources: { title?: string; lessonId?: string; type?: string }[];
};
type SupportPayload = {
  alerts: SupportAlert[];
  weakTopics: TopicInsight[];
  goals: {
    id: string;
    studentName: string;
    title: string;
    currentValue: number;
    targetValue: number;
    progressPercent: number;
    status: string;
    periodEnd: string;
  }[];
  activeGoals: number;
  reportsThisWeek: number;
};

const PRIORITY = {
  high: { label: "Ưu tiên cao", badge: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" },
  medium: { label: "Cần theo dõi", badge: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300" },
  low: { label: "Lưu ý", badge: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300" },
} as const;

export default function LearningSupportPanel() {
  const [data, setData] = useState<SupportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportMessage, setReportMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/teacher/learning-support", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("unavailable");
      setData(await response.json() as SupportPayload);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function updateAlert(alertId: string, status: "monitoring" | "resolved") {
    setWorkingId(alertId);
    try {
      const response = await fetch("/api/teacher/learning-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "update_alert", alertId, status }),
      });
      if (!response.ok) throw new Error("update_failed");
      setData((current) => current ? {
        ...current,
        alerts: status === "resolved"
          ? current.alerts.filter((alert) => alert.id !== alertId)
          : current.alerts.map((alert) => alert.id === alertId ? { ...alert, status } : alert),
      } : current);
    } finally {
      setWorkingId(null);
    }
  }

  async function generateReports() {
    setReporting(true);
    setReportMessage("");
    try {
      const response = await fetch("/api/teacher/learning-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "generate_weekly_reports" }),
      });
      if (!response.ok) throw new Error("report_failed");
      const result = await response.json() as { generated: number };
      setReportMessage(`Đã gửi ${result.generated} báo cáo vào Parent Portal.`);
      await load();
    } catch {
      setReportMessage("Không thể tạo báo cáo lúc này.");
    } finally {
      setReporting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Trung tâm hỗ trợ học tập</h2>
            {!!data?.alerts.length && <Badge variant="destructive">{data.alerts.length} cần chú ý</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Tự động kết hợp xu hướng điểm, chuyên cần, hạn bài và kết quả theo chủ đề.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Làm mới phân tích
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-64 animate-pulse rounded-2xl bg-muted lg:col-span-2" />
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : error || !data ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <AlertTriangle className="mb-3 h-9 w-9 text-muted-foreground/40" />
            <p className="font-semibold">Chưa tải được phân tích hỗ trợ</p>
            <p className="mt-1 text-sm text-muted-foreground">Hãy kiểm tra migration dữ liệu rồi thử lại.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border bg-red-50/60 dark:bg-red-950/10">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5 text-red-500" /> Học viên cần hỗ trợ
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.alerts.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" />
                  <p className="font-semibold">Chưa có tín hiệu rủi ro đáng chú ý</p>
                  <p className="mt-1 text-sm text-muted-foreground">Hệ thống sẽ tiếp tục theo dõi khi có dữ liệu mới.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {data.alerts.slice(0, 8).map((alert) => (
                    <div key={alert.id} className="p-4 md:p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start">
                        <Avatar size="md" className="shrink-0"><AvatarFallback name={alert.studentName} /></Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold">{alert.studentName}</p>
                            <Badge variant="outline" className={PRIORITY[alert.priority].badge}>{PRIORITY[alert.priority].label}</Badge>
                            {alert.status === "monitoring" && <Badge variant="secondary">Đang theo dõi</Badge>}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{alert.className}</p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {alert.signals.map((signal) => (
                              <div key={signal.type} className="rounded-xl bg-muted/45 px-3 py-2">
                                <p className="text-xs font-semibold">{signal.title}</p>
                                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{signal.detail}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={workingId === alert.id}
                            onClick={() => void updateAlert(alert.id, "monitoring")}
                          >
                            <UserRoundCheck className="mr-1.5 h-3.5 w-3.5" /> Theo dõi
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={workingId === alert.id}
                            onClick={() => void updateAlert(alert.id, "resolved")}
                          >
                            Xử lý xong
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BrainCircuit className="h-4 w-4 text-violet-600" /> Chủ đề cần củng cố
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.weakTopics.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Chưa có bài thi đủ dữ liệu phân tích.</p>
                ) : data.weakTopics.slice(0, 4).map((topic) => (
                  <div key={topic.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{topic.topic}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{topic.studentName} · {topic.className}</p>
                      </div>
                      <span className="text-sm font-black text-amber-600">{Math.round(topic.masteryPercent)}%</span>
                    </div>
                    {topic.recommendedResources[0]?.title && (
                      <p className="mt-2 text-[11px] text-violet-700 dark:text-violet-300">
                        Đề xuất: {topic.recommendedResources[0].title}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-indigo-200/70 bg-gradient-to-br from-indigo-50 to-white dark:border-indigo-900/60 dark:from-indigo-950/25 dark:to-card">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-indigo-100 p-2.5 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
                    <FileClock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">Báo cáo tuần cho phụ huynh</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Đã có {data.reportsThisWeek} báo cáo kỳ gần nhất · {data.activeGoals} mục tiêu đang được theo dõi.
                    </p>
                    <Button type="button" size="sm" className="mt-3" disabled={reporting} onClick={() => void generateReports()}>
                      {reporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Tạo và gửi báo cáo
                    </Button>
                    {reportMessage && <p className="mt-2 text-xs font-medium text-indigo-700 dark:text-indigo-300">{reportMessage}</p>}
                  </div>
                </div>
                {data.goals.length > 0 && (
                  <div className="mt-4 space-y-3 border-t border-indigo-200/70 pt-4 dark:border-indigo-900/60">
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Tiến độ mục tiêu học viên</p>
                    {data.goals.slice(0, 3).map((goal) => (
                      <div key={goal.id}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                          <p className="min-w-0 truncate"><strong>{goal.studentName}</strong> · {goal.title}</p>
                          <span className="shrink-0 font-bold text-indigo-700 dark:text-indigo-300">{goal.progressPercent}%</span>
                        </div>
                        <ProgressBar value={goal.progressPercent} size="sm" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}
