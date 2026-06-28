"use client";

import { Users, BookOpen, CheckSquare, FileText, Clock, Plus, ArrowRight } from "lucide-react";
import StatCard from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AttendanceBadge, LearningModeBadge, ProgressBar, SectionHeader } from "@/components/shared";
import { MOCK_CLASSES, MOCK_STUDENTS, MOCK_HOMEWORK, MOCK_ATTENDANCE, ATTENDANCE_CHART_DATA } from "@/lib/mock-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const teacherClasses = MOCK_CLASSES.filter((c) => c.tutor_id === "t1");

export default function TeacherDashboard() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg animate-fade-in"
        style={{ background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)" }}>
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-white/70 text-sm font-medium">Chào mừng trở lại 👩‍🏫</p>
          <h2 className="text-2xl font-bold mt-1">Tiến sĩ Sarah Mitchell</h2>
          <p className="text-white/60 text-sm mt-1">{teacherClasses.length} lớp đang dạy · {MOCK_STUDENTS.length} học viên</p>
          <div className="flex items-center gap-3 mt-4">
            <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0">Điểm danh <ArrowRight className="h-3.5 w-3.5" /></Button>
            <Button size="sm" className="bg-white/10 hover:bg-white/20 text-white border-0"><Plus className="h-3.5 w-3.5" /> Giao bài tập</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Học viên" value={MOCK_STUDENTS.length} icon={Users} iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600" delay={0} />
        <StatCard title="Lớp đang dạy" value={teacherClasses.length} icon={BookOpen} iconBg="bg-orange-100 dark:bg-orange-900/30" iconColor="text-orange-600" delay={100} />
        <StatCard title="Ca dạy hôm nay" value={2} icon={Clock} iconBg="bg-rose-100 dark:bg-rose-900/30" iconColor="text-rose-600" delay={200} />
        <StatCard title="Bài chưa chấm" value={3} icon={FileText} iconBg="bg-red-100 dark:bg-red-900/30" iconColor="text-red-600" delay={300} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4 animate-fade-in delay-100">
          <SectionHeader title="Lớp của tôi" action={<Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" /> Tạo lớp</Button>} />
          <div className="space-y-3">
            {teacherClasses.map((cls) => (
              <Card key={cls.id} className="hover:shadow-md transition-shadow cursor-pointer group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: cls.color }}>
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{cls.class_name}</p>
                          <p className="text-xs text-muted-foreground">{cls.subject}</p>
                        </div>
                        <LearningModeBadge mode={cls.learning_mode} />
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        {cls.schedule.map((s, i) => (
                          <span key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {s.day} {s.start_time}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="shrink-0 opacity-0 group-hover:opacity-100">Quản lý</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-4 animate-fade-in delay-200">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Điểm danh hôm nay</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {MOCK_STUDENTS.slice(0, 4).map((student, i) => (
                <div key={student.id} className="flex items-center gap-3 py-1">
                  <Avatar size="sm"><AvatarFallback name={student.full_name} /></Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{student.full_name}</p>
                    <p className="text-[10px] text-muted-foreground">{student.grade}</p>
                  </div>
                  <AttendanceBadge status={MOCK_ATTENDANCE[i]?.status ?? "present"} />
                </div>
              ))}
              <Button size="sm" variant="outline" className="w-full mt-2">
                <CheckSquare className="h-3.5 w-3.5" /> Điểm danh ngay
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Bài tập đã giao</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {MOCK_HOMEWORK.slice(0, 3).map((hw) => (
                <div key={hw.id} className="p-2.5 rounded-xl bg-muted/50 space-y-1">
                  <p className="text-xs font-semibold text-foreground truncate">{hw.title}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">Hạn {hw.due_date}</p>
                    <Badge variant="warning" className="text-[10px]">3 chưa nộp</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in delay-300">
        <Card>
          <CardHeader><CardTitle className="text-sm">Biểu đồ chuyên cần</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={ATTENDANCE_CHART_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Có mặt" />
                <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Vắng mặt" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Năng lực học viên</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {MOCK_STUDENTS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3">
                <Avatar size="sm"><AvatarFallback name={s.full_name} /></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{s.full_name}</p>
                  <ProgressBar value={[87, 79, 85, 94, 82][i]} size="sm" showValue className="mt-1" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
