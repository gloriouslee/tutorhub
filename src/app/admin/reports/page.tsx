"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { Download, Sparkles, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { getStudents, getPayments, getAttendance, getClasses } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";

export default function AdminReportsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [reportType, setReportType] = useState("tuition");
  const [reportFormat, setReportFormat] = useState("csv");

  useEffect(() => {
    async function loadData() {
      const [s, p, a, c] = await Promise.all([
        getStudents(), getPayments(), getAttendance(), getClasses(),
      ]);
      setStudents(s); setPayments(p); setAttendance(a); setClasses(c);
    }
    loadData();
  }, []);

  const totalCollected = payments.filter(p => p.payment_status === "paid").reduce((s, p) => s + p.amount, 0);

  const onlineCount  = students.filter(s => s.learning_type === "online").length;
  const offlineCount = students.filter(s => s.learning_type === "offline").length;
  const hybridCount  = students.filter(s => s.learning_type === "hybrid").length;

  const modeData = [
    { name: "Trực tuyến", value: onlineCount,  color: "#3b82f6" },
    { name: "Tại lớp",    value: offlineCount, color: "#8b5cf6" },
    { name: "Kết hợp",    value: hybridCount,  color: "#14b8a6" },
  ];

  // Last 5 months (including current), computed from real data
  const MONTHS = ["Th.1", "Th.2", "Th.3", "Th.4", "Th.5", "Th.6", "Th.7", "Th.8", "Th.9", "Th.10", "Th.11", "Th.12"];
  const now = new Date();
  const lastMonths = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (4 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const revenueData = lastMonths.map(({ year, month }) => {
    const doanhThu = payments
      .filter(p => {
        if (p.payment_status !== "paid") return false;
        const d = new Date(p.paid_date || p.due_date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((s, p) => s + p.amount, 0);
    return { month: MONTHS[month], doanhThu, mucTieu: 90000000 };
  });

  const attendanceRateData = lastMonths.map(({ year, month }) => {
    const recs = attendance.filter(a => {
      const d = new Date(a.attendance_date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    const pct = (n: number) => (recs.length > 0 ? Math.round((n / recs.length) * 100) : 0);
    return {
      month: MONTHS[month],
      coMat:   pct(recs.filter(a => a.status === "present").length),
      treGio:  pct(recs.filter(a => a.status === "late").length),
      vangMat: pct(recs.filter(a => a.status === "absent").length),
    };
  });

  const csvEscape = (v: any) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const buildReportRows = (): string[][] => {
    switch (reportType) {
      case "tuition":
        return [
          ["Học viên", "Mô tả", "Số tiền", "Hạn nộp", "Ngày nộp", "Trạng thái"],
          ...payments.map(p => {
            const st = students.find(s => s.id === p.student_id);
            return [st?.full_name ?? p.student_id, p.description, p.amount, p.due_date, p.paid_date ?? "", p.payment_status];
          }),
        ];
      case "attendance":
        return [
          ["Ngày", "Lớp", "Học viên", "Trạng thái"],
          ...attendance.map(a => {
            const cls = classes.find(c => c.id === a.class_id);
            const st = students.find(s => s.id === a.student_id);
            return [a.attendance_date, cls?.class_name ?? a.class_id, st?.full_name ?? a.student_id, a.status];
          }),
        ];
      case "enrollment":
        return [
          ["Họ tên", "Khối lớp", "Trường", "Hình thức học"],
          ...students.map(s => [s.full_name, s.grade, s.school, s.learning_type]),
        ];
      case "teachers":
      default:
        return [
          ["Lớp", "Môn học", "Hình thức", "Giáo viên (ID)", "Số học viên"],
          ...classes.map(c => [c.class_name, c.subject, c.learning_mode, c.tutor_id, (c.student_ids ?? []).length]),
        ];
    }
  };

  const handleExport = (e: React.FormEvent) => {
    e.preventDefault();
    setIsExporting(true);
    setExportSuccess(false);
    try {
      const rows = buildReportRows();
      const dateKey = new Date().toISOString().split("T")[0];
      const fileName = `tutorhub_baocao_${reportType}_${dateKey}`;
      let blob: Blob;
      let ext: string;
      if (reportFormat === "json") {
        const [header, ...data] = rows;
        const objects = data.map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
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
          subtitle="Tổng quan thống kê thời gian thực và báo cáo tài chính"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue vs Target */}
          <Card className="lg:col-span-2 border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Doanh thu vs Mục tiêu</span>
                <span className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-lg">
                  Đã thu {formatCurrency(totalCollected)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueData} barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${(v / 1000000).toFixed(0)}tr`} />
                  <Tooltip
                    contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: any) => [formatCurrency(v)]}
                    cursor={{ fill: "rgb(var(--muted))" }}
                  />
                  <Bar dataKey="doanhThu" fill="#e11d48" radius={[6, 6, 0, 0]} name="Doanh thu" />
                  <Bar dataKey="mucTieu"  fill="rgb(var(--muted))" radius={[6, 6, 0, 0]} name="Mục tiêu" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Learning Mode Pie */}
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Học viên theo hình thức</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center min-h-[220px]">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={modeData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={4} dataKey="value">
                    {modeData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                  </Pie>
                  <Legend iconType="circle" iconSize={8}
                    formatter={val => <span style={{ fontSize: 11, color: "rgb(var(--muted-foreground))" }}>{val}</span>} />
                  <Tooltip contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs font-semibold">
                <span className="text-blue-500">Trực tuyến: {onlineCount}</span>
                <span className="text-violet-500">Tại lớp: {offlineCount}</span>
                <span className="text-teal-500">Kết hợp: {hybridCount}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Attendance Line Chart */}
          <Card className="lg:col-span-2 border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Xu hướng Điểm danh (%)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={attendanceRateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: any, name: any) => [`${v}%`, name]}
                  />
                  <Line type="monotone" dataKey="coMat"   stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} name="Có mặt %" />
                  <Line type="monotone" dataKey="treGio"  stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 3 }} name="Trễ giờ %" />
                  <Line type="monotone" dataKey="vangMat" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 3 }} name="Vắng mặt %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Export Panel */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-rose-500" /> Xuất báo cáo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleExport} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Loại báo cáo</label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
                    value={reportType}
                    onChange={e => setReportType(e.target.value)}
                  >
                    <option value="tuition">Tài chính: Doanh thu Học phí</option>
                    <option value="attendance">Lớp học: Điểm danh</option>
                    <option value="enrollment">Học viên: Danh sách Đăng ký</option>
                    <option value="teachers">Hiệu suất: Phân công Giáo viên</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Định dạng xuất</label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
                    value={reportFormat}
                    onChange={e => setReportFormat(e.target.value)}
                  >
                    <option value="csv">Bảng tính CSV (.csv)</option>
                    <option value="json">Tệp JSON (.json)</option>
                  </select>
                </div>

                <div className="pt-2">
                  <Button type="submit" variant="gradient" className="w-full flex justify-center items-center gap-2" disabled={isExporting}>
                    {isExporting ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Đang tạo báo cáo...
                      </span>
                    ) : (
                      <>
                        <Download className="h-4 w-4" /> Xuất báo cáo
                      </>
                    )}
                  </Button>
                </div>

                {exportSuccess && (
                  <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-start gap-2.5 animate-fade-in">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Xuất báo cáo thành công!</p>
                      <p className="text-muted-foreground font-normal mt-0.5">Tệp đã được tải xuống.</p>
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
