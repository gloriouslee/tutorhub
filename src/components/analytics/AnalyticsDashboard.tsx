"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatCard from "@/components/shared/StatCard";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
  CartesianGrid, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  Clock3,
  DollarSign,
  GraduationCap,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  computeKpis, revenueByTeacher, revenueByClass, revenueTrend, studentGrowth,
  enrollmentByClass, examPerfByClass, attendanceTrend, attendanceByClass,
  analyticsDeltas, learningModeDist, topStudents, filterByMonths,
  teacherAttentionItems, type AnalyticsData,
} from "@/lib/analytics";

const RANGES = [
  { months: 3,  label: "3 tháng" },
  { months: 6,  label: "6 tháng" },
  { months: 12, label: "12 tháng" },
];

const AXIS = { fontSize: 11, fill: "rgb(var(--muted-foreground))" };
const TOOLTIP_STYLE = { background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12 };
const trVND = (v: number) => `${(v / 1_000_000).toFixed(0)}tr`;

// Rút gọn tiền tệ cho thẻ KPI (tránh tràn thẻ): 12.500.000 → "12,5tr ₫"
function compactVND(v: number): string {
  const sign = v < 0 ? "−" : "";
  const value = Math.abs(v);
  if (value >= 1_000_000_000) return `${sign}${(value / 1_000_000_000).toFixed(1).replace(".", ",")} tỷ ₫`;
  if (value >= 1_000_000) return `${sign}${(value / 1_000_000).toFixed(1).replace(".", ",")}tr ₫`;
  if (value >= 1_000) return `${sign}${Math.round(value / 1_000)}k ₫`;
  return `${sign}${value} ₫`;
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
  return (
    <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 text-center text-xs text-muted-foreground">
      {msg}
    </div>
  );
}

function DeltaLabel({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">Không đổi so với kỳ trước</span>;
  const PositiveIcon = value > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${value > 0 ? "text-emerald-600" : "text-rose-600"}`}>
      <PositiveIcon className="h-3.5 w-3.5" /> {value > 0 ? "+" : ""}{value}{suffix} so với kỳ trước
    </span>
  );
}

export default function AnalyticsDashboard({
  data,
  classIds,
  showTeacherBreakdown = true,
  months = 6,
  variant = showTeacherBreakdown ? "admin" : "teacher",
}: {
  data: AnalyticsData;
  classIds?: Set<string>;
  showTeacherBreakdown?: boolean;
  months?: number;
  variant?: "teacher" | "admin";
}) {
  // ── Bộ lọc ──
  const [range, setRange] = useState<number>(months);
  const [teacherId, setTeacherId] = useState<string>("");   // "" = tất cả GV
  const [classId, setClassId] = useState<string>("");       // "" = tất cả lớp

  // Danh sách lớp/GV trong phạm vi (view GV đã bị prop classIds giới hạn)
  const scopeClasses = useMemo(
    () => data.classes.filter(c => !classIds || classIds.has(c.id)),
    [data.classes, classIds]
  );
  const teacherClassOptions = useMemo(
    () => (teacherId ? scopeClasses.filter(c => data.teacherOf[c.id] === teacherId) : scopeClasses),
    [scopeClasses, teacherId, data.teacherOf]
  );

  // classIds hiệu lực = phạm vi prop ∩ (lọc lớp | lọc GV)
  const effectiveClassIds = useMemo<Set<string> | undefined>(() => {
    if (classId) return new Set([classId]);
    if (teacherId) {
      const t = new Set(scopeClasses.filter(c => data.teacherOf[c.id] === teacherId).map(c => c.id));
      return classIds ? new Set([...t].filter(id => classIds.has(id))) : t;
    }
    return classIds;
  }, [classId, teacherId, classIds, scopeClasses, data.teacherOf]);

  // Lọc dữ liệu theo thời gian → KPI và biểu đồ luôn nhất quán trong cùng khoảng
  const fdata = useMemo(() => filterByMonths(data, range), [data, range]);
  const cids = effectiveClassIds;

  const kpis = useMemo(() => computeKpis(fdata, cids), [fdata, cids]);
  const byTeacher = useMemo(() => revenueByTeacher(fdata, cids), [fdata, cids]);
  const byClass = useMemo(() => revenueByClass(fdata, cids), [fdata, cids]);
  const revTrend = useMemo(() => revenueTrend(fdata, range, cids), [fdata, cids, range]);
  const growth = useMemo(() => studentGrowth(fdata, range, cids), [fdata, cids, range]);
  const enroll = useMemo(() => enrollmentByClass(fdata, cids), [fdata, cids]);
  const examPerf = useMemo(() => examPerfByClass(fdata, cids), [fdata, cids]);
  const attTrend = useMemo(() => attendanceTrend(fdata, range, cids), [fdata, cids, range]);
  const attByClass = useMemo(() => attendanceByClass(fdata, cids), [fdata, cids]);
  const modeDist = useMemo(() => learningModeDist(fdata, cids), [fdata, cids]);
  const tops = useMemo(() => topStudents(fdata, 5, cids), [fdata, cids]);
  const attentionItems = useMemo(
    () => variant === "teacher" ? teacherAttentionItems(fdata, cids) : [],
    [fdata, cids, variant],
  );
  const deltas = useMemo(() => analyticsDeltas(data, range, cids), [data, range, cids]);
  const loadedAt = useMemo(
    () => new Date(data.loadedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    [data.loadedAt],
  );

  const selectCls = "h-9 px-2.5 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="space-y-6">
      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl border border-border bg-muted/20">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Bộ lọc
        </span>

        {/* Time range segmented */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {RANGES.map(r => (
            <button
              key={r.months}
              onClick={() => setRange(r.months)}
              className={`px-3 h-9 text-xs font-medium transition-colors ${range === r.months ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {showTeacherBreakdown && (
          <select
            value={teacherId}
            onChange={e => { setTeacherId(e.target.value); setClassId(""); }}
            className={selectCls}
          >
            <option value="">Tất cả giáo viên</option>
            {data.teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        )}

        <select value={classId} onChange={e => setClassId(e.target.value)} className={selectCls}>
          <option value="">Tất cả lớp</option>
          {teacherClassOptions.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
        </select>

        {(teacherId || classId || range !== months) && (
          <button
            onClick={() => { setRange(months); setTeacherId(""); setClassId(""); }}
            className="text-xs text-primary hover:underline ml-auto"
          >
            Đặt lại
          </button>
        )}
        <span className={`${teacherId || classId || range !== months ? "" : "ml-auto"} inline-flex items-center gap-1.5 text-[11px] text-muted-foreground`}>
          <Clock3 className="h-3.5 w-3.5" /> Cập nhật {loadedAt}
        </span>
      </div>

      {/* ── KPI cards ── */}
      <div className={`grid grid-cols-2 gap-4 ${variant === "admin" ? "md:grid-cols-3 xl:grid-cols-6" : "lg:grid-cols-4"}`}>
        {variant === "admin" && <StatCard title="Doanh thu" value={compactVND(kpis.totalRevenue)} subtitle={formatCurrency(kpis.totalRevenue)} icon={DollarSign} iconColor="text-rose-500" iconBg="bg-rose-50 dark:bg-rose-950/20" delay={0} />}
        <StatCard title="Học viên hiện tại" value={kpis.studentCount} icon={Users} iconColor="text-blue-500" iconBg="bg-blue-50 dark:bg-blue-950/20" delay={40} />
        <StatCard title="Lớp hiện tại" value={kpis.classCount} icon={BookOpen} iconColor="text-violet-500" iconBg="bg-violet-50 dark:bg-violet-950/20" delay={80} />
        {showTeacherBreakdown && (
          <StatCard title="Giáo viên" value={kpis.teacherCount} icon={GraduationCap} iconColor="text-amber-500" iconBg="bg-amber-50 dark:bg-amber-950/20" delay={120} />
        )}
        <StatCard title="Chuyên cần" value={`${kpis.avgAttendancePct}%`} icon={CheckSquare} iconColor="text-emerald-500" iconBg="bg-emerald-50 dark:bg-emerald-950/20" delay={160} />
        <StatCard title="Điểm TB" value={kpis.avgScore > 0 ? `${kpis.avgScore}/10` : "—"} icon={Trophy} iconColor="text-teal-500" iconBg="bg-teal-50 dark:bg-teal-950/20" delay={200} />
      </div>

      {variant === "teacher" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
          <Card className="overflow-hidden border border-border">
            <CardHeader className="border-b border-border/70 bg-rose-50/50 pb-4 dark:bg-rose-950/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-5 w-5 text-rose-500" /> Cần hỗ trợ trước
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">Sắp theo mức độ và giải thích bằng dữ liệu trong khoảng đã chọn.</p>
                </div>
                <span className="rounded-full bg-background px-3 py-1 text-xs font-bold text-foreground shadow-sm">
                  {attentionItems.length} học viên
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {attentionItems.length === 0 ? (
                <div className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Chưa phát hiện tín hiệu cần ưu tiên trong khoảng này.
                </div>
              ) : (
                <div className="divide-y divide-border/70">
                  {attentionItems.slice(0, 5).map(item => (
                    <div key={item.studentId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.severity === "high" ? "bg-rose-500" : "bg-amber-500"}`} aria-label={item.severity === "high" ? "Ưu tiên cao" : "Cần theo dõi"} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-foreground">{item.studentName}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.className} · {item.reasons.join(" · ")}</p>
                      </div>
                      <Link href={`/teacher/students/${encodeURIComponent(item.studentId)}?tab=overview`} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-primary hover:underline">
                        Xem học viên <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">So với kỳ trước</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-emerald-50/70 p-3 dark:bg-emerald-950/15">
                <p className="text-xs font-medium text-muted-foreground">Chuyên cần</p>
                <p className="mt-1 text-2xl font-black">{deltas.attendance.hasData ? `${deltas.attendance.current}%` : "—"}</p>
                {deltas.attendance.hasData && <DeltaLabel value={deltas.attendance.delta} suffix=" điểm %" />}
              </div>
              <div className="rounded-xl bg-teal-50/70 p-3 dark:bg-teal-950/15">
                <p className="text-xs font-medium text-muted-foreground">Điểm trung bình</p>
                <p className="mt-1 text-2xl font-black">{deltas.score.hasData ? `${deltas.score.current}/10` : "—"}</p>
                {deltas.score.hasData && <DeltaLabel value={deltas.score.delta} suffix=" điểm" />}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">Chỉ so sánh dữ liệu có trong hai khoảng bằng nhau; nghỉ có phép không tính vào mẫu số chuyên cần.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {variant === "admin" && (
        <Card className="border border-border">
          <CardContent className="grid gap-3 p-4 md:grid-cols-3">
            <div className="rounded-xl bg-rose-50/70 p-3 dark:bg-rose-950/15">
              <p className="text-xs font-semibold text-muted-foreground">Doanh thu trong kỳ</p>
              <p className="mt-1 text-lg font-black">{compactVND(deltas.revenue.current)}</p>
              {deltas.revenue.hasData ? (
                <p className={`text-xs font-semibold ${deltas.revenue.delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {deltas.revenue.delta >= 0 ? "+" : ""}{compactVND(deltas.revenue.delta)} so với kỳ trước
                </p>
              ) : <p className="text-xs text-muted-foreground">Chưa ghi nhận khoản thu</p>}
            </div>
            <div className="rounded-xl bg-emerald-50/70 p-3 dark:bg-emerald-950/15">
              <p className="text-xs font-semibold text-muted-foreground">Chuyên cần toàn trung tâm</p>
              <p className="mt-1 text-lg font-black">{deltas.attendance.hasData ? `${deltas.attendance.current}%` : "—"}</p>
              {deltas.attendance.hasData ? <DeltaLabel value={deltas.attendance.delta} suffix=" điểm %" /> : <p className="text-xs text-muted-foreground">Chưa đủ dữ liệu điểm danh</p>}
            </div>
            <div className="rounded-xl bg-violet-50/70 p-3 dark:bg-violet-950/15">
              <p className="text-xs font-semibold text-muted-foreground">Độ phủ dữ liệu học tập</p>
              <p className="mt-1 text-lg font-black">{examPerf.length}/{kpis.classCount} lớp có điểm</p>
              <p className="text-xs text-muted-foreground">Không quy đổi lớp chưa có điểm thành 0</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Revenue trend + learning mode ── */}
      {variant === "admin" && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Xu hướng doanh thu" span badge={<span className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-lg">Tổng {formatCurrency(kpis.totalRevenue)}</span>}>
          {revTrend.some(d => d.doanhThu > 0) ? (
            <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 220 }}>
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
            <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 220 }}>
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
      </div>}

      {/* ── Revenue by teacher / by class ── */}
      {variant === "admin" && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {showTeacherBreakdown && (
          <ChartCard title="Doanh thu theo giáo viên">
            {byTeacher.length > 0 ? (
              <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 240 }}>
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
            <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 240 }}>
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
      </div>}

      {/* ── Student growth + enrollment by class ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {variant === "teacher" ? (
          <ChartCard title="Xu hướng chuyên cần (%)" span badge={deltas.attendance.hasData ? <DeltaLabel value={deltas.attendance.delta} suffix=" điểm %" /> : undefined}>
            {attTrend.some(d => d.coMat > 0 || d.vangMat > 0) ? (
              <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 220 }}>
                <LineChart data={attTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                  <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, n: any) => [`${v}%`, n]} />
                  <Line type="monotone" dataKey="coMat" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} name="Có mặt %" />
                  <Line type="monotone" dataKey="treGio" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 3 }} name="Trễ giờ %" />
                  <Line type="monotone" dataKey="vangMat" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 3 }} name="Vắng mặt %" />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart msg="Chưa có dữ liệu điểm danh trong khoảng này." />}
          </ChartCard>
        ) : (
        <ChartCard title="Tài khoản học viên theo thời gian" span>
          {growth.some(d => d.luyKe > 0) ? (
            <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 220 }}>
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
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, n: any) => [v, n === "luyKe" ? "Luỹ kế" : "Tài khoản mới"]} />
                <Area type="monotone" dataKey="luyKe" stroke="#6366f1" strokeWidth={2.5} fill="url(#gGrowth)" name="Luỹ kế" />
                <Line type="monotone" dataKey="moi" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="HV mới" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart msg="Chưa có dữ liệu tạo tài khoản học viên." />}
        </ChartCard>
        )}

        <ChartCard title="Sĩ số theo lớp">
          {enroll.length > 0 ? (
            <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 220 }}>
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
            <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 220 }}>
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

        <ChartCard title={variant === "teacher" ? "Kết quả nổi bật" : "Top học viên"}>
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
      {variant === "admin" && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Xu hướng điểm danh (%)" span>
          {attTrend.some(d => d.coMat > 0 || d.vangMat > 0) ? (
            <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 220 }}>
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
            <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 220 }}>
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
      </div>}
    </div>
  );
}
