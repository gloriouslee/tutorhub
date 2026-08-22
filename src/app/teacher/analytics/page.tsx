"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { SectionHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import type { AnalyticsData } from "@/lib/analytics";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useTeacherContext } from "@/hooks/useTeacherContext";

const AnalyticsDashboard = dynamic(
  () => import("@/components/analytics/AnalyticsDashboard"),
  {
    loading: () => (
      <div className="space-y-4" aria-label="Đang tải biểu đồ">
        <div className="h-28 animate-pulse rounded-2xl bg-muted/60" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-2xl bg-muted/60" />
          <div className="h-64 animate-pulse rounded-2xl bg-muted/40" />
        </div>
      </div>
    ),
  },
);

export default function TeacherAnalyticsPage() {
  const { teacherId, teacherName } = useTeacherContext();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (force = false) => {
    setError(null);
    if (force) setRefreshing(true);
    try {
      const { loadAnalyticsData } = await import("@/lib/analytics");
      setData(await loadAnalyticsData({ force }));
    } catch (loadError) {
      console.error("Teacher analytics:", loadError);
      setError("Không thể tải dữ liệu phân tích. Vui lòng thử lại.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Chỉ các lớp do giáo viên này phụ trách (đã tính cả override phân công)
  const myClassIds = useMemo(() => {
    if (!data) return undefined;
    return new Set(data.classes.filter(c => data.teacherOf[c.id] === teacherId).map(c => c.id));
  }, [data, teacherId]);

  return (
    <PortalLayout role="teacher" userName={teacherName || "Giáo viên"} pageTitle="Xu hướng & Thống kê">
      <div className="space-y-6">
        <SectionHeader
          title="Phân tích lớp học"
          subtitle="Ưu tiên học viên cần hỗ trợ, theo dõi chuyên cần và kết quả theo từng lớp"
          action={data ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void loadData(true)} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Đang cập nhật" : "Cập nhật"}
            </Button>
          ) : undefined}
        />

        {error && !data ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/50 py-16 text-center dark:border-rose-900 dark:bg-rose-950/10">
            <AlertCircle className="h-8 w-8 text-rose-500" />
            <p className="mt-3 text-sm font-semibold text-foreground">{error}</p>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void loadData(true)}>Thử lại</Button>
          </div>
        ) : !data || !myClassIds ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground mt-3">Đang tổng hợp dữ liệu…</p>
          </div>
        ) : myClassIds.size === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-border/50 rounded-2xl">
            <p className="text-sm text-muted-foreground">Bạn chưa phụ trách lớp nào để thống kê.</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
                Không thể lấy dữ liệu mới. Đang hiển thị bản cập nhật gần nhất.
              </div>
            )}
            <AnalyticsDashboard data={data} classIds={myClassIds} showTeacherBreakdown={false} variant="teacher" />
          </>
        )}
      </div>
    </PortalLayout>
  );
}
