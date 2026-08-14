"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  BookOpenCheck,
  CalendarCheck2,
  ChevronRight,
  GraduationCap,
  Loader2,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTeacherContext } from "@/hooks/useTeacherContext";
import {
  fetchTeacherStudentDirectory,
  type StudentClassMetrics,
  type StudentRiskPriority,
  type StudentWorkspaceSummary,
} from "@/lib/teacher-student-workspace";

const RISK_META: Record<StudentRiskPriority, { label: string; className: string }> = {
  high: { label: "Ưu tiên cao", className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" },
  medium: { label: "Cần theo dõi", className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300" },
  low: { label: "Lưu ý", className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300" },
};

const PACKAGE_LABELS = { online: "Online", advanced: "Nâng cao", offline: "Offline" } as const;

type RiskFilter = "all" | "support" | "missing" | "attendance";
type SortKey = "risk" | "name" | "score_low" | "missing" | "activity";

function metricTone(value: number | null, good = 85) {
  if (value === null) return "text-muted-foreground";
  if (value >= good) return "text-emerald-600 dark:text-emerald-400";
  if (value >= good - 15) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function relativeActivity(value: string | null) {
  if (!value) return "Chưa có dữ liệu";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Chưa có dữ liệu";
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (days === 0) return "Hôm nay";
  if (days === 1) return "Hôm qua";
  if (days < 7) return `${days} ngày trước`;
  return new Date(value).toLocaleDateString("vi-VN");
}

function metricsFor(student: StudentWorkspaceSummary, classId: string): StudentClassMetrics {
  if (classId !== "all" && student.classMetrics[classId]) return student.classMetrics[classId];
  return student;
}

function detailHref(studentId: string, classId: string, tab = "overview") {
  const params = new URLSearchParams({ tab });
  if (classId !== "all") params.set("class", classId);
  return `/teacher/students/${encodeURIComponent(studentId)}?${params.toString()}`;
}

function DirectorySkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Đang tải danh sách học viên">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export default function StudentDirectory() {
  const { teacherName, myClasses } = useTeacherContext();
  const [students, setStudents] = useState<StudentWorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [sort, setSort] = useState<SortKey>("risk");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchTeacherStudentDirectory();
      setStudents(payload.students);
    } catch {
      setError("Không thể tải dữ liệu học viên. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const requestedClass = new URLSearchParams(window.location.search).get("class");
    if (requestedClass) setClassId(requestedClass);
  }, []);

  function changeClass(nextClassId: string) {
    setClassId(nextClassId);
    const params = new URLSearchParams(window.location.search);
    if (nextClassId === "all") params.delete("class");
    else params.set("class", nextClassId);
    const suffix = params.toString();
    window.history.replaceState(null, "", `/teacher/students${suffix ? `?${suffix}` : ""}`);
  }

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    const rows = students.filter((student) => {
      if (classId !== "all" && !student.classes.some((item) => item.id === classId)) return false;
      if (query && ![student.fullName, student.school, student.grade, ...student.classes.map((item) => item.name)]
        .some((value) => value.toLocaleLowerCase("vi").includes(query))) return false;
      const metrics = metricsFor(student, classId);
      if (riskFilter === "support" && !student.risk) return false;
      if (riskFilter === "missing" && metrics.missingHomework === 0) return false;
      if (riskFilter === "attendance" && (metrics.attendanceRate === null || metrics.attendanceRate >= 80)) return false;
      return true;
    });
    return [...rows].sort((a, b) => {
      const aMetrics = metricsFor(a, classId);
      const bMetrics = metricsFor(b, classId);
      if (sort === "name") return a.fullName.localeCompare(b.fullName, "vi");
      if (sort === "score_low") return (aMetrics.averageScore ?? 99) - (bMetrics.averageScore ?? 99);
      if (sort === "missing") return bMetrics.missingHomework - aMetrics.missingHomework;
      if (sort === "activity") return new Date(b.lastActivityAt ?? 0).getTime() - new Date(a.lastActivityAt ?? 0).getTime();
      return (b.risk?.priorityScore ?? 0) - (a.risk?.priorityScore ?? 0)
        || a.fullName.localeCompare(b.fullName, "vi");
    });
  }, [classId, riskFilter, search, sort, students]);

  const scopedStudents = useMemo(
    () => students.filter((student) => classId === "all" || student.classes.some((item) => item.id === classId)),
    [classId, students],
  );
  const needSupport = scopedStudents.filter((student) => student.risk).length;
  const missingWork = scopedStudents.filter((student) => metricsFor(student, classId).missingHomework > 0).length;
  const lowAttendance = scopedStudents.filter((student) => {
    const rate = metricsFor(student, classId).attendanceRate;
    return rate !== null && rate < 80;
  }).length;

  return (
    <PortalLayout role="teacher" userName={teacherName || "Giáo viên"} pageTitle="Học viên">
      <main className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Không gian học viên</h1>
            <p className="mt-1 text-sm text-muted-foreground">Ưu tiên việc cần xử lý, sau đó mở hồ sơ để xem nguyên nhân và hành động tiếp theo.</p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Làm mới dữ liệu
          </Button>
        </header>

        {loading ? <DirectorySkeleton /> : error ? (
          <Card className="border-dashed"><CardContent className="flex flex-col items-center py-14 text-center">
            <AlertTriangle className="mb-3 h-10 w-10 text-amber-500" />
            <p className="font-bold">Chưa tải được danh sách học viên</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-4" type="button" onClick={() => void load()}>Thử lại</Button>
          </CardContent></Card>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Tổng quan học viên">
              {[
                { label: "Tổng học viên", value: scopedStudents.length, Icon: Users, tone: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30", filter: "all" as RiskFilter },
                { label: "Cần hỗ trợ", value: needSupport, Icon: AlertTriangle, tone: "text-red-600 bg-red-50 dark:bg-red-950/30", filter: "support" as RiskFilter },
                { label: "Đang thiếu bài", value: missingWork, Icon: BookOpenCheck, tone: "text-amber-600 bg-amber-50 dark:bg-amber-950/30", filter: "missing" as RiskFilter },
                { label: "Chuyên cần thấp", value: lowAttendance, Icon: CalendarCheck2, tone: "text-violet-600 bg-violet-50 dark:bg-violet-950/30", filter: "attendance" as RiskFilter },
              ].map(({ label, value, Icon, tone, filter }) => (
                <button key={label} type="button" onClick={() => setRiskFilter(riskFilter === filter && filter !== "all" ? "all" : filter)}
                  className={`rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${riskFilter === filter ? "border-primary ring-2 ring-primary/10" : "border-border"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="text-2xl font-black">{value}</p><p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p></div>
                    <span className={`rounded-xl p-2.5 ${tone}`}><Icon className="h-5 w-5" /></span>
                  </div>
                </button>
              ))}
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm" aria-label="Bộ lọc học viên">
              <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_220px_180px_190px]">
                <label className="relative">
                  <span className="sr-only">Tìm học viên</span>
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, trường, khối hoặc lớp…"
                    className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
                </label>
                <select aria-label="Lọc theo lớp" value={classId} onChange={(event) => changeClass(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="all">Tất cả lớp</option>
                  {myClasses.map((item) => <option key={item.id} value={item.id}>{item.class_name}</option>)}
                </select>
                <select aria-label="Lọc theo trạng thái" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as RiskFilter)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="all">Mọi trạng thái</option><option value="support">Cần hỗ trợ</option><option value="missing">Thiếu bài</option><option value="attendance">Chuyên cần thấp</option>
                </select>
                <label className="relative">
                  <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <span className="sr-only">Sắp xếp</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm">
                    <option value="risk">Ưu tiên xử lý</option><option value="name">Tên A–Z</option><option value="score_low">Điểm thấp trước</option><option value="missing">Thiếu bài nhiều</option><option value="activity">Mới hoạt động</option>
                  </select>
                </label>
              </div>
              <p className="mt-3 text-xs text-muted-foreground" role="status">Hiển thị {visible.length}/{scopedStudents.length} học viên</p>
            </section>

            {visible.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-border py-16 text-center">
                <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="font-semibold">Không có học viên phù hợp</p><p className="mt-1 text-sm text-muted-foreground">Hãy xóa từ khóa hoặc đổi bộ lọc.</p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:block">
                  <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-muted/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground"><tr>
                      <th className="px-4 py-3 font-semibold">Học viên</th><th className="px-3 py-3 font-semibold">Lớp</th><th className="px-3 py-3 font-semibold">Cảnh báo</th><th className="px-3 py-3 text-center font-semibold">Điểm TB</th><th className="px-3 py-3 text-center font-semibold">Chuyên cần</th><th className="px-3 py-3 text-center font-semibold">BT đúng hạn</th><th className="px-3 py-3 font-semibold">Hoạt động cuối</th><th className="px-4 py-3"><span className="sr-only">Thao tác</span></th>
                    </tr></thead>
                    <tbody className="divide-y divide-border/70">
                      {visible.map((student) => {
                        const metrics = metricsFor(student, classId);
                        return <tr key={student.id} className="transition-colors hover:bg-muted/30">
                          <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar className="h-10 w-10"><AvatarFallback name={student.fullName} /></Avatar><div className="min-w-0"><Link className="font-bold hover:text-primary hover:underline" href={detailHref(student.id, classId)}>{student.fullName}</Link><p className="mt-0.5 max-w-[220px] truncate text-xs text-muted-foreground">{student.grade || "Chưa có khối"} · {student.school || "Chưa có trường"}</p></div></div></td>
                          <td className="px-3 py-3"><div className="flex max-w-[210px] flex-wrap gap-1">{student.classes.filter((item) => classId === "all" || item.id === classId).map((item) => <Badge key={item.id} variant="outline" className="max-w-[190px] gap-1 truncate text-[10px]"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />{item.name}{item.package ? ` · ${PACKAGE_LABELS[item.package]}` : ""}</Badge>)}</div></td>
                          <td className="px-3 py-3">{student.risk ? <Link href={detailHref(student.id, classId, student.risk.signals[0]?.type === "homework" ? "homework" : student.risk.signals[0]?.type === "absence" || student.risk.signals[0]?.type === "late" ? "attendance" : "scores")}><Badge variant="outline" className={RISK_META[student.risk.priority].className}>{RISK_META[student.risk.priority].label}</Badge><p className="mt-1 max-w-[160px] truncate text-[11px] text-muted-foreground">{student.risk.signals[0]?.title}</p></Link> : <Badge variant="success">Ổn định</Badge>}</td>
                          <td className={`px-3 py-3 text-center font-black ${metricTone(metrics.averageScore === null ? null : metrics.averageScore * 10, 85)}`}>{metrics.averageScore?.toFixed(1) ?? "—"}<p className="text-[10px] font-normal text-muted-foreground">{metrics.assessmentCount} bài</p></td>
                          <td className={`px-3 py-3 text-center font-bold ${metricTone(metrics.attendanceRate)}`}>{metrics.attendanceRate === null ? "—" : `${metrics.attendanceRate}%`}<p className="text-[10px] font-normal text-muted-foreground">{metrics.lates} trễ · {metrics.absences} vắng</p></td>
                          <td className={`px-3 py-3 text-center font-bold ${metricTone(metrics.homeworkOnTimeRate)}`}>{metrics.homeworkOnTimeRate === null ? "—" : `${metrics.homeworkOnTimeRate}%`}<p className="text-[10px] font-normal text-muted-foreground">{metrics.missingHomework} thiếu</p></td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">{relativeActivity(student.lastActivityAt)}</td>
                          <td className="px-4 py-3 text-right"><Button asChild size="sm" variant="ghost"><Link href={detailHref(student.id, classId)} aria-label={`Mở hồ sơ ${student.fullName}`}>Mở <ChevronRight className="ml-1 h-4 w-4" /></Link></Button></td>
                        </tr>;
                      })}
                    </tbody>
                  </table></div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
                  {visible.map((student) => {
                    const metrics = metricsFor(student, classId);
                    return <Card key={student.id} className="border-border/70"><CardContent className="space-y-4 p-4">
                      <div className="flex items-start gap-3"><Avatar className="h-11 w-11"><AvatarFallback name={student.fullName} /></Avatar><div className="min-w-0 flex-1"><Link href={detailHref(student.id, classId)} className="font-bold hover:text-primary">{student.fullName}</Link><p className="truncate text-xs text-muted-foreground">{student.grade} · {student.school}</p></div>{student.risk ? <Badge variant="outline" className={RISK_META[student.risk.priority].className}>{RISK_META[student.risk.priority].label}</Badge> : <Badge variant="success">Ổn định</Badge>}</div>
                      <div className="grid grid-cols-3 divide-x rounded-xl bg-muted/45 py-3 text-center"><div><p className={`font-black ${metricTone(metrics.averageScore === null ? null : metrics.averageScore * 10)}`}>{metrics.averageScore?.toFixed(1) ?? "—"}</p><p className="text-[10px] text-muted-foreground">Điểm TB</p></div><div><p className={`font-black ${metricTone(metrics.attendanceRate)}`}>{metrics.attendanceRate === null ? "—" : `${metrics.attendanceRate}%`}</p><p className="text-[10px] text-muted-foreground">Chuyên cần</p></div><div><p className={`font-black ${metricTone(metrics.homeworkOnTimeRate)}`}>{metrics.homeworkOnTimeRate === null ? "—" : `${metrics.homeworkOnTimeRate}%`}</p><p className="text-[10px] text-muted-foreground">BT đúng hạn</p></div></div>
                      <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{metrics.missingHomework} bài thiếu · {relativeActivity(student.lastActivityAt)}</p><Button asChild size="sm"><Link href={detailHref(student.id, classId)}>Mở hồ sơ</Link></Button></div>
                    </CardContent></Card>;
                  })}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </PortalLayout>
  );
}
