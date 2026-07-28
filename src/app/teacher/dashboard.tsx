"use client";

import { useState, useEffect, useMemo } from "react";
import { Users, BookOpen, CheckSquare, FileText, Clock, Plus, ArrowRight, CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import StatCard from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LearningModeBadge, ProgressBar, SectionHeader } from "@/components/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { getTeacherHomework, getAllTeacherAttendance, getStudents, type TeacherAttendanceRecord } from "@/lib/storage";
import { useTeacherContext } from "@/hooks/useTeacherContext";
import type { Class, Student } from "@/types";

// Days that have class today (computed from schedule)
function getTodaySessions(classes: Class[]) {
  const today = new Date();
  const dayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  const todayLabel = dayNames[today.getDay()];
  const englishDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayEnglish = englishDays[today.getDay()];

  const sessions: { cls: Class; schedule: { day: string; start_time: string; end_time: string } }[] = [];
  for (const cls of classes) {
    for (const s of cls.schedule) {
      if (s.day === todayLabel || s.day === todayEnglish) {
        sessions.push({ cls, schedule: s });
      }
    }
  }
  return sessions;
}

async function loadHomework(classIds: string[]) {
  try {
    return await getTeacherHomework<any>(classIds);
  } catch {}
  return [];
}

function attendanceChart(records: TeacherAttendanceRecord[]) {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const rows = records.filter((record) => record.date.startsWith(key));
    return {
      month: `T${date.getMonth() + 1}`,
      present: rows.filter((record) => record.status === "present" || record.status === "late").length,
      absent: rows.filter((record) => record.status === "absent").length,
    };
  });
}

function studentAttendanceRate(
  studentId: string,
  records: TeacherAttendanceRecord[],
) {
  const rows = records.filter(
    (record) => record.student_id === studentId && record.status !== "excused",
  );
  if (rows.length === 0) return 0;
  const attended = rows.filter(
    (record) => record.status === "present" || record.status === "late",
  ).length;
  return Math.round((attended / rows.length) * 100);
}

export default function TeacherDashboard() {
  const router = useRouter();
  const { teacherName, myClasses } = useTeacherContext();
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<TeacherAttendanceRecord[]>([]);

  const allClasses = myClasses;
  const classIds = useMemo(() => allClasses.map(c => c.id), [allClasses]);

  useEffect(() => {
    if (classIds.length === 0) return;
    loadHomework(classIds).then(setHomeworks);
    Promise.all([
      getStudents(),
      getAllTeacherAttendance({ classIds }),
    ]).then(([studentRows, attendanceRows]) => {
      setStudents(studentRows);
      setAttendanceRecords(attendanceRows);
    });
  }, [classIds]);

  // All unique student IDs across teacher's classes
  const allStudentIds = [...new Set(allClasses.flatMap(c => c.student_ids ?? []))];
  const myStudents = students.filter(s => allStudentIds.includes(s.id));

  const todaySessions = getTodaySessions(allClasses);

  // Homework stats
  const openHw = homeworks.filter(h => new Date(h.due_date) >= new Date());
  const attendanceChartData = attendanceChart(attendanceRecords);

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg animate-fade-in"
        style={{ background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)" }}>
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-white/70 text-sm font-medium">Chào mừng trở lại 👨‍🏫</p>
          <h2 className="text-2xl font-bold mt-1">{teacherName || "Giáo viên"}</h2>
          <p className="text-white/60 text-sm mt-1">
            {allClasses.length} lớp đang dạy · {allStudentIds.length} học viên
          </p>
          <div className="flex items-center gap-3 mt-4">
            <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0"
              onClick={() => router.push("/teacher/classes")}>
              <CalendarDays className="h-3.5 w-3.5 mr-1.5" />Buổi học &amp; điểm danh <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
            <Button size="sm" className="bg-white/10 hover:bg-white/20 text-white border-0"
              onClick={() => router.push("/teacher/classes")}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Giao bài tập
            </Button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Học viên" value={allStudentIds.length} icon={Users} iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600" delay={0} />
        <StatCard title="Lớp đang dạy" value={allClasses.length} icon={BookOpen} iconBg="bg-orange-100 dark:bg-orange-900/30" iconColor="text-orange-600" delay={100} />
        <StatCard title="Ca dạy hôm nay" value={todaySessions.length} icon={Clock} iconBg="bg-rose-100 dark:bg-rose-900/30" iconColor="text-rose-600" delay={200} />
        <StatCard title="Bài tập đang mở" value={openHw.length} icon={FileText} iconBg="bg-red-100 dark:bg-red-900/30" iconColor="text-red-600" delay={300} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My classes */}
        <div className="lg:col-span-2 space-y-4 animate-fade-in delay-100">
          <SectionHeader
            title="Lớp của tôi"
            action={
              <Button size="sm" variant="outline" onClick={() => router.push("/teacher/classes")}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Tạo lớp
              </Button>
            }
          />
          <div className="space-y-3">
            {allClasses.length === 0 && (
              <p className="text-sm text-muted-foreground">Chưa có lớp nào.</p>
            )}
            {allClasses.map(cls => (
              <Card key={cls.id} className="hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => router.push(`/teacher/classes/${cls.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white shrink-0"
                      style={{ background: cls.color ?? "#f59e0b" }}>
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{cls.class_name}</p>
                          <p className="text-xs text-muted-foreground">{cls.subject}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {(cls as any).isNew && (
                            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-100 text-emerald-700 border-0">Mới</Badge>
                          )}
                          <LearningModeBadge mode={cls.learning_mode} />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        {(cls.schedule ?? []).map((s: any, i: number) => (
                          <span key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {s.day} {s.start_time}
                          </span>
                        ))}
                        <span className="text-xs text-muted-foreground">
                          {(cls.student_ids ?? []).length} học viên
                        </span>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="shrink-0 opacity-0 group-hover:opacity-100"
                      onClick={e => { e.stopPropagation(); router.push(`/teacher/classes/${cls.id}`); }}>
                      Quản lý
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4 animate-fade-in delay-200">
          {/* Today's sessions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Ca dạy hôm nay
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {todaySessions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Hôm nay không có ca dạy.</p>
              ) : (
                todaySessions.map(({ cls, schedule }, i) => (
                  <div key={`${cls.id}_${i}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 cursor-pointer transition-colors"
                    onClick={() => router.push(`/teacher/classes/${cls.id}`)}>
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0 text-xs font-bold"
                      style={{ background: cls.color ?? "#f59e0b" }}>
                      {cls.class_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{cls.class_name}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />{schedule.start_time} – {schedule.end_time}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <Button size="sm" variant="outline" className="w-full mt-1"
                onClick={() => router.push("/teacher/classes")}>
                <CheckSquare className="h-3.5 w-3.5 mr-1.5" /> Vào lớp &amp; điểm danh
              </Button>
            </CardContent>
          </Card>

          {/* Recent homework */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Bài tập đã giao</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {homeworks.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Chưa có bài tập nào.</p>
              )}
              {homeworks.slice(0, 3).map(hw => {
                const isOver = new Date(hw.due_date) < new Date();
                return (
                  <div key={hw.id} className="p-2.5 rounded-xl bg-muted/50 space-y-1">
                    <p className="text-xs font-semibold text-foreground truncate">{hw.title}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-muted-foreground">
                        Hạn {new Date(hw.due_date).toLocaleDateString("vi-VN")}
                      </p>
                      <Badge variant={isOver ? "destructive" : "warning"} className="text-[10px]">
                        {isOver ? "Hết hạn" : "Đang mở"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in delay-300">
        <Card>
          <CardHeader><CardTitle className="text-sm">Biểu đồ chuyên cần</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180} minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 180 }}>
              <LineChart data={attendanceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Có mặt" />
                <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Vắng mặt" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Chuyên cần học viên</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {myStudents.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Chưa có học viên.</p>
            )}
            {myStudents.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <Avatar size="sm"><AvatarFallback name={s.full_name} /></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{s.full_name}</p>
                  <ProgressBar value={studentAttendanceRate(s.id, attendanceRecords)} size="sm" showValue className="mt-1" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
