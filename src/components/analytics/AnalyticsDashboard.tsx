"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatCard from "@/components/shared/StatCard";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
  CartesianGrid, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { DollarSign, Users, GraduationCap, BookOpen, CheckSquare, Trophy } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  computeKpis, revenueByTeacher, revenueByClass, revenueTrend, studentGrowth,
  enrollmentByClass, examPerfByClass, attendanceTrend, attendanceByClass,
  learningModeDist, topStudents, type AnalyticsData,
} from "@/lib/analytics";

const AXIS = { fontSize: 11, fill: "rgb(var(--muted-foreground))" };
const TOOLTIP_STYLE = { background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12 };
const trVND = (v: number) => `${(v / 1_000_000).toFixed(0)}tr`;

// Rút gọn tiền tệ cho thẻ KPI (tránh tràn thẻ): 12.500.000 → "12,5tr ₫"
function compactVND(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1).replace(".", ",")} tỷ ₫`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")}tr ₫`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k ₫`;
  return `${v} ₫`;
}

function ChartCard({ title, badge, span, children }: { title: string; badge?: React.ReactNode; span?: boolean; children: React.ReactNode }) {
  return (
    <Card className={`border border-border ${span ? "lg:col-span-2" : ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex items-center justify-between gap-2">
          <span>{title}</span>
          {badge}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyChart({ msg }: { msg: string }) {
  return <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground text-center px-4">{msg}</div>;
}

export default function AnalyticsDashboard({
  data,
  classIds,
  showTeacherBreakdown = true,
  months = 6,
}: {
  data: AnalyticsData;
  classIds?: Set<string>;
  showTeacherBreakdown?: boolean;
  months?: number;
}) {
  const kpis = useMemo(() => computeKpis(data, classIds), [data, classIds]);
  const byTeacher = useMemo(() => revenueByTeacher(data, classIds), [data, classIds]);
  const byClass = useMemo(() => revenueByClass(data, classIds), [data, classIds]);
  const revTrend = useMemo(() => revenueTrend(data, months, classIds), [data, classIds, months]);
  const growth = useMemo(() => studentGrowth(data, months, classIds), [data, classIds, months]);
  const enroll = useMemo(() => enrollmentByClass(data, classIds), [data, classIds]);
  const examPerf = useMemo(() => examPerfByClass(data, classIds), [data, classIds]);
  const attTrend = useMemo(() => attendanceTrend(data, months, classIds), [data, classIds, months]);
  const attByClass = useMemo(() => attendanceByClass(data, classIds), [data, classIds]);
  const modeDist = useMemo(() => learningModeDist(data, classIds), [data, classIds]);
  const tops = useMemo(() => topStudents(data, 5, classIds), [data, classIds]);

  return (
    <div className="space-y-6">
      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Doanh thu" value={compactVND(kpis.totalRevenue)} subtitle={formatCurrency(kpis.totalRevenue)} icon={DollarSign} iconColor="text-rose-500" iconBg="bg-rose-50 dark:bg-rose-950/20" delay={0} />
        <StatCard title="Học viên" value={kpis.studentCount} icon={Users} iconColor="text-blue-500" iconBg="bg-blue-50 dark:bg-blue-950/20" delay={40} />
        <StatCard title="Lớp học" value={kpis.classCount} icon={BookOpen} iconColor="text-violet-500" iconBg="bg-violet-50 dark:bg-violet-950/20" delay={80} />
        {showTeacherBreakdown && (
          <StatCard title="Giáo viên" value={kpis.teacherCount} icon={GraduationCap} iconColor="text-amber-500" iconBg="bg-amber-50 dark:bg-amber-950/20" delay={120} />
        )}
        <StatCard title="Chuyên cần" value={`${kpis.avgAttendancePct}%`} icon={CheckSquare} iconColor="text-emerald-500" iconBg="bg-emerald-50 dark:bg-emerald-950/20" delay={160} />
        <StatCard title="Điểm TB" value={kpis.avgScore > 0 ? `${kpis.avgScore}/10` : "—"} icon={Trophy} iconColor="text-teal-500" iconBg="bg-teal-50 dark:bg-teal-950/20" delay={200} />
      </div>

      {/* ── Revenue trend + learning mode ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Xu hướng doanh thu" span badge={<span className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-lg">Tổng {formatCurrency(kpis.totalRevenue)}</span>}>
          {revTrend.some(d => d.doanhThu > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revTrend} barSize={26}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={trVND} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [formatCurrency(v), "Doanh thu"]} cursor={{ fill: "rgb(var(--muted))" }} />
                <Bar dataKey="doanhThu" fill="#e11d48" radius={[6, 6, 0, 0]} name="Doanh thu" />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart msg="Chưa có dữ liệu doanh thu trong khoảng thời gian này." />}
        </ChartCard>

        <ChartCard title="Học viên theo hình thức">
          {modeDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={modeDist} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                  {modeDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} formatter={val => <span style={{ fontSize: 11, color: "rgb(var(--muted-foreground))" }}>{val}</span>} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart msg="Chưa có học viên." />}
        </ChartCard>
      </div>

      {/* ── Revenue by teacher / by class ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {showTeacherBreakdown && (
          <ChartCard title="Doanh thu theo giáo viên">
            {byTeacher.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byTeacher} layout="vertical" barSize={18} margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={trVND} />
                  <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={110} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [formatCurrency(v), "Doanh thu"]} cursor={{ fill: "rgb(var(--muted))" }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Doanh thu">
                    {byTeacher.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart msg="Chưa ghi nhận doanh thu theo giáo viên." />}
          </ChartCard>
        )}

        <ChartCard title="Doanh thu theo lớp">
          {byClass.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byClass} layout="vertical" barSize={18} margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" horizontal={false} />
                <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={trVND} />
                <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={130} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [formatCurrency(v), "Doanh thu"]} cursor={{ fill: "rgb(var(--muted))" }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Doanh thu">
                  {byClass.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart msg="Chưa ghi nhận doanh thu theo lớp." />}
        </ChartCard>
      </div>

      {/* ── Student growth + enrollment by class ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Tăng trưởng học viên" span>
          {growth.some(d => d.luyKe > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={growth}>
                <defs>
                  <linearGradient id="gGrowth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, n: any) => [v, n === "luyKe" ? "Luỹ kế" : "HV mới"]} />
                <Area type="monotone" dataKey="luyKe" stroke="#6366f1" strokeWidth={2.5} fill="url(#gGrowth)" name="Luỹ kế" />
                <Line type="monotone" dataKey="moi" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="HV mới" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart msg="Chưa có dữ liệu tăng trưởng học viên." />}
        </ChartCard>

        <ChartCard title="Sĩ số theo lớp">
          {enroll.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={enroll} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ ...AXIS, fontSize: 9 }} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={50} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v} HV`, "Sĩ số"]} cursor={{ fill: "rgb(var(--muted))" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Sĩ số">
                  {enroll.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart msg="Chưa có lớp." />}
        </ChartCard>
      </div>

      {/* ── Exam performance + top students ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Điểm trung bình theo lớp" span>
          {examPerf.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={examPerf} barSize={26}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ ...AXIS, fontSize: 9 }} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={50} />
                <YAxis domain={[0, 10]} tick={AXIS} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v}/10`, "Điểm TB"]} cursor={{ fill: "rgb(var(--muted))" }} />
                <Bar dataKey="diem" radius={[6, 6, 0, 0]} name="Điểm TB">
                  {examPerf.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart msg="Chưa có dữ liệu điểm thi." />}
        </ChartCard>

        <ChartCard title="Top học viên">
          {tops.length > 0 ? (
            <div className="space-y-2.5 py-1">
              {tops.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${i === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground">{s.soBai} bài</p>
                  </div>
                  <span className="text-sm font-bold text-teal-600 dark:text-teal-400">{s.diem}/10</span>
                </div>
              ))}
            </div>
          ) : <EmptyChart msg="Chưa có dữ liệu điểm." />}
        </ChartCard>
      </div>

      {/* ── Attendance trend + by class ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Xu hướng điểm danh (%)" span>
          {attTrend.some(d => d.coMat > 0 || d.vangMat > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={attTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, n: any) => [`${v}%`, n]} />
                <Line type="monotone" dataKey="coMat" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} name="Có mặt %" />
                <Line type="monotone" dataKey="treGio" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 3 }} name="Trễ giờ %" />
                <Line type="monotone" dataKey="vangMat" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 3 }} name="Vắng mặt %" />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart msg="Chưa có dữ liệu điểm danh." />}
        </ChartCard>

        <ChartCard title="Chuyên cần theo lớp (%)">
          {attByClass.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={attByClass} layout="vertical" barSize={16} margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={AXIS} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ ...AXIS, fontSize: 9 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v}%`, "Chuyên cần"]} cursor={{ fill: "rgb(var(--muted))" }} />
                <Bar dataKey="rate" radius={[0, 6, 6, 0]} name="Chuyên cần">
                  {attByClass.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart msg="Chưa có dữ liệu điểm danh." />}
        </ChartCard>
      </div>
    </div>
  );
}
