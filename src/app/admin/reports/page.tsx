"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { FileText, Download, Calendar, Filter, Sparkles, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { getStudents, getPayments, getAttendance, getClasses } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";

export default function AdminReportsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [reportType, setReportType] = useState("tuition");
  const [reportFormat, setReportFormat] = useState("pdf");

  useEffect(() => {
    async function loadData() {
      const [s, p, a, c] = await Promise.all([
        getStudents(),
        getPayments(),
        getAttendance(),
        getClasses(),
      ]);
      setStudents(s);
      setPayments(p);
      setAttendance(a);
      setClasses(c);
    }
    loadData();
  }, []);

  // Compute dynamic stats
  const totalCollected = payments.filter(p => p.payment_status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter(p => p.payment_status === "pending").reduce((s, p) => s + p.amount, 0);
  const totalOverdue = payments.filter(p => p.payment_status === "overdue").reduce((s, p) => s + p.amount, 0);

  // Pie chart: Student Learning Modes
  const onlineCount = students.filter(s => s.learning_type === "online").length;
  const offlineCount = students.filter(s => s.learning_type === "offline").length;
  const hybridCount = students.filter(s => s.learning_type === "hybrid").length;

  const modeData = [
    { name: "Online", value: onlineCount || 1, color: "#3b82f6" },
    { name: "Offline", value: offlineCount || 1, color: "#8b5cf6" },
    { name: "Hybrid", value: hybridCount || 1, color: "#14b8a6" },
  ];

  // Bar Chart: Revenue vs Target
  const revenueData = [
    { month: "Jan", revenue: 84000000, target: 90000000 },
    { month: "Feb", revenue: 92000000, target: 90000000 },
    { month: "Mar", revenue: 78000000, target: 90000000 },
    { month: "Apr", revenue: 96000000, target: 90000000 },
    { month: "May", revenue: totalCollected || 89000000, target: 95000000 },
  ];

  // Line Chart: Attendance Rates
  const attendanceRateData = [
    { month: "Jan", present: 88, absent: 8, late: 4 },
    { month: "Feb", present: 92, absent: 5, late: 3 },
    { month: "Mar", present: 85, absent: 10, late: 5 },
    { month: "Apr", present: 90, absent: 6, late: 4 },
    { month: "May", present: 93, absent: 4, late: 3 },
  ];

  const handleExport = (e: React.FormEvent) => {
    e.preventDefault();
    setIsExporting(true);
    setExportSuccess(false);

    // Simulate exporting process
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
          title="Reports & Analytics Dashboard"
          subtitle="Real-time statistical overviews and generated financial analysis reports"
        />

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue vs Target Chart */}
          <Card className="lg:col-span-2 border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Revenue vs Target Comparison</span>
                <span className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-lg">
                  {formatCurrency(totalCollected)} Collected
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueData} barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12 }} formatter={(v: any) => formatCurrency(v)} cursor={{ fill: "rgb(var(--muted))" }} />
                  <Bar dataKey="revenue" fill="#e11d48" radius={[6, 6, 0, 0]} name="Actual Revenue" />
                  <Bar dataKey="target" fill="rgb(var(--muted))" radius={[6, 6, 0, 0]} name="Target Goal" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Learning Mode Distribution */}
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Students by Learning Mode</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center min-h-[220px]">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={modeData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={4} dataKey="value">
                    {modeData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} formatter={(val) => <span style={{ fontSize: 11, color: "rgb(var(--muted-foreground))" }}>{val}</span>} />
                  <Tooltip contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs font-semibold">
                <span className="text-blue-500">Online: {onlineCount}</span>
                <span className="text-violet-500">Offline: {offlineCount}</span>
                <span className="text-teal-500">Hybrid: {hybridCount}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Attendance Trends */}
          <Card className="lg:col-span-2 border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Attendance Rate Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={attendanceRateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12 }} />
                  <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} name="Present %" />
                  <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 3 }} name="Late %" />
                  <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 3 }} name="Absent %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Report Builder tool */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-rose-500" /> Export custom report
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleExport} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Report Category</label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
                    value={reportType}
                    onChange={e => setReportType(e.target.value)}
                  >
                    <option value="tuition">Financial: Tuition Revenue</option>
                    <option value="attendance">Classroom: Attendance Records</option>
                    <option value="enrollment">Student Registry: Enrollments</option>
                    <option value="teachers">Performance: Tutor Allocations</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Export Format</label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
                    value={reportFormat}
                    onChange={e => setReportFormat(e.target.value)}
                  >
                    <option value="pdf">Acrobat PDF Document (.pdf)</option>
                    <option value="csv">Microsoft Excel Sheet (.csv)</option>
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
                        Building Report...
                      </span>
                    ) : (
                      <>
                        <Download className="h-4 w-4" /> Export Report File
                      </>
                    )}
                  </Button>
                </div>

                {exportSuccess && (
                  <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-start gap-2.5 animate-fade-in">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Report successfully generated!</p>
                      <p className="text-muted-foreground font-normal mt-0.5">Your download has completed successfully.</p>
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
