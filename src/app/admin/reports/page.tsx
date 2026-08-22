"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { AlertCircle, Download, Sparkles, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import type { AnalyticsData } from "@/lib/analytics";

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

export default function AdminReportsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [reportType, setReportType] = useState("revenue_class");
  const [reportFormat, setReportFormat] = useState("csv");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (force = false) => {
    setLoadError(null);
    if (force) setRefreshing(true);
    try {
      const { loadAnalyticsData } = await import("@/lib/analytics");
      setData(await loadAnalyticsData({ force }));
    } catch (error) {
      console.error("Admin analytics:", error);
      setLoadError("Không thể tải dữ liệu báo cáo. Vui lòng thử lại.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const csvEscape = (v: any) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const buildReportRows = async (): Promise<(string | number)[][]> => {
    if (!data) return [];
    const { revenueByClass, revenueByTeacher } = await import("@/lib/analytics");
    const teacherName = (id?: string) => data.teachers.find(t => t.id === id)?.full_name ?? id ?? "—";
    switch (reportType) {
      case "revenue_class":
        return [
          ["Lớp", "Giáo viên", "Doanh thu (VND)"],
          ...revenueByClass(data).map(r => {
            const cls = data.classes.find(c => c.class_name === r.name);
            return [r.name, teacherName(cls ? data.teacherOf[cls.id] : undefined), r.value];
          }),
        ];
      case "revenue_teacher":
        return [
          ["Giáo viên", "Doanh thu (VND)"],
          ...revenueByTeacher(data).map(r => [r.name, r.value]),
        ];
      case "students":
        return [
          ["Họ tên", "Khối lớp", "Trường", "Hình thức học", "Ngày tạo"],
          ...data.students.map(s => [s.full_name, s.grade, s.school, s.learning_type, s.created_at?.slice(0, 10) ?? ""]),
        ];
      case "attendance":
        return [
          ["Ngày", "Lớp", "Học viên", "Trạng thái"],
          ...data.attendance.map(a => {
            const cls = data.classes.find(c => c.id === a.class_id);
            const st = data.students.find(s => s.id === a.student_id);
            return [a.attendance_date, cls?.class_name ?? a.class_id, st?.full_name ?? a.student_id, a.status];
          }),
        ];
      case "exam":
        return [
          ["Ngày thi", "Lớp", "Học viên", "Bài thi", "Điểm", "Thang điểm"],
          ...data.examScores.map(e => {
            const cls = data.classes.find(c => c.id === e.class_id);
            const st = data.students.find(s => s.id === e.student_id);
            return [e.exam_date, cls?.class_name ?? e.class_id, st?.full_name ?? e.student_id, e.exam_name, e.score, e.max_score];
          }),
        ];
      case "classes":
      default:
        return [
          ["Lớp", "Môn học", "Hình thức", "Giáo viên", "Số học viên"],
          ...data.classes.map(c => [c.class_name, c.subject, c.learning_mode, teacherName(data.teacherOf[c.id]), (c.student_ids ?? []).length]),
        ];
    }
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExporting(true);
    setExportSuccess(false);
    try {
      const rows = await buildReportRows();
      const dateKey = new Date().toISOString().split("T")[0];
      const fileName = `tutorhub_baocao_${reportType}_${dateKey}`;
      let blob: Blob;
      let ext: string;
      if (reportFormat === "json") {
        const [header, ...body] = rows;
        const objects = body.map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
        blob = new Blob([JSON.stringify(objects, null, 2)], { type: "application/json;charset=utf-8" });
        ext = "json";
      } else {
        const csv = "﻿" + rows.map(r => r.map(csvEscape).join(",")).join("\n");
        blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        ext = "csv";
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.setAttribute("href", url);
      a.setAttribute("download", `${fileName}.${ext}`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PortalLayout role="admin" userName="Admin User" pageTitle="Báo cáo & Thống kê">
      <div className="space-y-6">
        <SectionHeader
          title="Báo cáo & Phân tích"
          subtitle="Doanh thu theo giáo viên & lớp, tăng trưởng học viên, chuyên cần và kết quả học tập"
          action={data ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void loadData(true)} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Đang cập nhật" : "Cập nhật"}
            </Button>
          ) : undefined}
        />

        {loadError && !data ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/50 py-16 text-center dark:border-rose-900 dark:bg-rose-950/10">
            <AlertCircle className="h-8 w-8 text-rose-500" />
            <p className="mt-3 text-sm font-semibold text-foreground">{loadError}</p>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void loadData(true)}>Thử lại</Button>
          </div>
        ) : !data ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground mt-3">Đang tổng hợp dữ liệu…</p>
          </div>
        ) : (
          <>
            {loadError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
                Không thể lấy dữ liệu mới. Đang hiển thị bản cập nhật gần nhất.
              </div>
            )}
            <AnalyticsDashboard data={data} showTeacherBreakdown variant="admin" />

            {/* Export panel */}
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-rose-500" /> Xuất báo cáo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleExport} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Loại báo cáo</label>
                    <select
                      className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
                      value={reportType}
                      onChange={e => setReportType(e.target.value)}
                    >
                      <option value="revenue_class">Doanh thu theo lớp</option>
                      <option value="revenue_teacher">Doanh thu theo giáo viên</option>
                      <option value="students">Danh sách học viên</option>
                      <option value="attendance">Điểm danh chi tiết</option>
                      <option value="exam">Kết quả thi</option>
                      <option value="classes">Danh sách lớp học</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Định dạng</label>
                    <select
                      className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
                      value={reportFormat}
                      onChange={e => setReportFormat(e.target.value)}
                    >
                      <option value="csv">Bảng tính CSV (.csv)</option>
                      <option value="json">Tệp JSON (.json)</option>
                    </select>
                  </div>

                  <Button type="submit" variant="gradient" className="flex justify-center items-center gap-2" disabled={isExporting}>
                    {isExporting ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo…</> : <><Download className="h-4 w-4" /> Xuất báo cáo</>}
                  </Button>
                </form>

                {exportSuccess && (
                  <div className="mt-4 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-start gap-2.5 animate-fade-in">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Xuất báo cáo thành công!</p>
                      <p className="text-muted-foreground font-normal mt-0.5">Tệp đã được tải xuống.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PortalLayout>
  );
}
