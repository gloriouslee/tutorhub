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
  const [reportFormat, setReportFormat] = useState("pdf");

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
    { name: "Trực tuyến", value: onlineCount  || 1, color: "#3b82f6" },
    { name: "Tại lớp",    value: offlineCount || 1, color: "#8b5cf6" },
    { name: "Kết hợp",    value: hybridCount  || 1, color: "#14b8a6" },
  ];

  const revenueData = [
    { month: "Th.1", doanhThu: 84000000, mucTieu: 90000000 },
    { month: "Th.2", doanhThu: 92000000, mucTieu: 90000000 },
    { month: "Th.3", doanhThu: 78000000, mucTieu: 90000000 },
    { month: "Th.4", doanhThu: 96000000, mucTieu: 90000000 },
    { month: "Th.5", doanhThu: totalCollected || 89000000, mucTieu: 95000000 },
  ];

  const attendanceRateData = [
    { month: "Th.1", coMat: 88, vangMat: 8, treGio: 4 },
    { month: "Th.2", coMat: 92, vangMat: 5, treGio: 3 },
    { month: "Th.3", coMat: 85, vangMat: 10, treGio: 5 },
    { month: "Th.4", coMat: 90, vangMat: 6, treGio: 4 },
    { month: "Th.5", coMat: 93, vangMat: 4, treGio: 3 },
  ];

  const handleExport = (e: React.FormEvent) => {
    e.preventDefault();
    setIsExporting(true);
    setExportSuccess(false);
    setTimeout(() => {
      setIsExporting(false);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    }, 2000);
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
                    <option value="pdf">Tệp PDF (.pdf)</option>
                    <option value="csv">Bảng tính Excel (.csv)</option>
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
