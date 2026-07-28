"use client";

import { useState, useEffect, useMemo } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { SectionHeader } from "@/components/shared";
import dynamic from "next/dynamic";
import type { AnalyticsData } from "@/lib/analytics";
import { Loader2 } from "lucide-react";
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

  useEffect(() => {
    let cancelled = false;
    import("@/lib/analytics")
      .then(({ loadAnalyticsData }) => loadAnalyticsData())
      .then((result) => {
        if (!cancelled) setData(result);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Chỉ các lớp do giáo viên này phụ trách (đã tính cả override phân công)
  const myClassIds = useMemo(() => {
    if (!data) return undefined;
    return new Set(data.classes.filter(c => data.teacherOf[c.id] === teacherId).map(c => c.id));
  }, [data, teacherId]);

  return (
    <PortalLayout role="teacher" userName={teacherName || "Giáo viên"} pageTitle="Xu hướng & Thống kê">
      <div className="space-y-6">
        <SectionHeader
          title="Xu hướng của tôi"
          subtitle="Doanh thu, sĩ số, chuyên cần và kết quả học tập theo từng lớp bạn phụ trách"
        />

        {!data || !myClassIds ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground mt-3">Đang tổng hợp dữ liệu…</p>
          </div>
        ) : myClassIds.size === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-border/50 rounded-2xl">
            <p className="text-sm text-muted-foreground">Bạn chưa phụ trách lớp nào để thống kê.</p>
          </div>
        ) : (
          <AnalyticsDashboard data={data} classIds={myClassIds} showTeacherBreakdown={false} />
        )}
      </div>
    </PortalLayout>
  );
}
