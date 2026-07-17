"use client";

import { useState, useEffect, useMemo } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { SectionHeader } from "@/components/shared";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";
import { loadAnalyticsData, type AnalyticsData } from "@/lib/analytics";
import { Loader2 } from "lucide-react";

const TEACHER_ID = "t1";
const TEACHER_NAME = "Thầy Hùng Toán";

export default function TeacherAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => { loadAnalyticsData().then(setData); }, []);

  // Chỉ các lớp do giáo viên này phụ trách (đã tính cả override phân công)
  const myClassIds = useMemo(() => {
    if (!data) return undefined;
    return new Set(data.classes.filter(c => data.teacherOf[c.id] === TEACHER_ID).map(c => c.id));
  }, [data]);

  return (
    <PortalLayout role="teacher" userName={TEACHER_NAME} pageTitle="Xu hướng & Thống kê">
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
