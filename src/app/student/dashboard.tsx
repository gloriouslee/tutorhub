"use client";

import {
  BookOpen, Calendar, CheckSquare, GraduationCap,
  Clock, TrendingUp, Bell, ArrowRight, FileText,
  PlayCircle, Trophy, Star, Target, Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar, AttendanceBadge, LearningModeBadge, SectionHeader } from "@/components/shared";
import {
  MOCK_CLASSES, MOCK_HOMEWORK, MOCK_NOTIFICATIONS,
  MOCK_ATTENDANCE, STUDENT_SCORE_DATA, ATTENDANCE_CHART_DATA,
} from "@/lib/mock-data";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid
} from "recharts";

const todayClasses = MOCK_CLASSES.slice(0, 3).map((c, i) => ({
  ...c,
  time: ["09:00 - 10:30", "14:00 - 15:30", "16:00 - 17:30"][i],
  status: (["upcoming", "live", "done"] as const)[i],
}));

export default function StudentDashboard() {
  const unreadNotifications = MOCK_NOTIFICATIONS.filter(
    (n) => !n.is_read && (n.target_role === "student" || n.target_role === "all")
  );
  const pendingHomework = MOCK_HOMEWORK.filter(
    (h) => new Date(h.due_date) >= new Date()
  );

  return (
    <div className="space-y-8 pb-10">
      {/* Premium Hero Banner with Glassmorphism */}
      <div className="relative overflow-hidden rounded-3xl p-8 sm:p-10 text-white shadow-2xl shadow-indigo-500/20 animate-fade-in group">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-900 transition-transform duration-700 group-hover:scale-105" />
        {/* Animated abstract shapes */}
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-gradient-to-br from-white/20 to-transparent blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-gradient-to-tr from-fuchsia-500/30 to-transparent blur-3xl" />
        <div className="absolute top-1/2 right-1/4 h-64 w-64 rounded-full bg-gradient-to-tr from-cyan-500/20 to-transparent blur-3xl animate-pulse" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-medium text-white/90">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Cập nhật Hệ thống 2.0
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-white">
              Chào buổi sáng, <br /> Nguyễn Anh Tuấn! 👋
            </h1>
            <p className="text-white/80 text-base md:text-lg font-medium max-w-md leading-relaxed">
              Hôm nay bạn có <strong className="text-white">{todayClasses.filter(c => c.status !== "done").length} lớp học</strong> và <strong className="text-white">{pendingHomework.length} bài tập</strong> đang chờ. Tiếp tục phát huy nhé!
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/student/classes">
                <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50 border-0 font-bold px-8 shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] hover:-translate-y-0.5">
                  <PlayCircle className="h-5 w-5 mr-2" /> Bắt đầu học
                </Button>
              </Link>
              <Link href="/student/schedule">
                <Button size="lg" className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md transition-all hover:-translate-y-0.5">
                  Xem thời khóa biểu
                </Button>
              </Link>
            </div>
          </div>

          <div className="hidden md:flex gap-4">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-center min-w-[120px]">
              <Trophy className="h-8 w-8 mx-auto mb-2 text-amber-300" />
              <p className="text-3xl font-bold text-white">89<span className="text-sm font-medium text-white/60">/100</span></p>
              <p className="text-xs text-white/80 mt-1 uppercase tracking-wider">Điểm TB</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-center min-w-[120px]">
              <Target className="h-8 w-8 mx-auto mb-2 text-emerald-300" />
              <p className="text-3xl font-bold text-white">95<span className="text-sm font-medium text-white/60">%</span></p>
              <p className="text-xs text-white/80 mt-1 uppercase tracking-wider">Hoàn thành</p>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { title: "Tổng số lớp", value: MOCK_CLASSES.length, icon: BookOpen, color: "from-blue-500 to-indigo-500", shadow: "shadow-blue-500/20" },
          { title: "Chuyên cần", value: "87%", icon: CheckSquare, color: "from-emerald-400 to-teal-500", shadow: "shadow-emerald-500/20" },
          { title: "Bài tập chờ", value: pendingHomework.length, icon: FileText, color: "from-amber-400 to-orange-500", shadow: "shadow-orange-500/20" },
          { title: "Mục tiêu tuần", value: "4/5", icon: Star, color: "from-fuchsia-500 to-purple-500", shadow: "shadow-fuchsia-500/20" }
        ].map((stat, i) => (
          <Card key={i} className="border-0 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
            <CardContent className="p-0 relative h-full">
              <div className="p-6 relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start mb-4">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{stat.title}</p>
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.color} ${stat.shadow} shadow-lg text-white group-hover:scale-110 transition-transform`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
                <h3 className="text-4xl font-black text-foreground tracking-tight">{stat.value}</h3>
              </div>
              {/* Decorative background blur */}
              <div className={`absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br ${stat.color} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Today's Schedule - Left Column */}
        <div className="xl:col-span-2 space-y-6 animate-fade-in delay-200">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Lịch học hôm nay</h2>
              <p className="text-sm text-muted-foreground mt-1">Thứ Tư, 7 tháng 5, 2025</p>
            </div>
            <Link href="/student/schedule">
              <Button variant="outline" className="hidden sm:flex border-primary/20 text-primary hover:bg-primary/5">
                Toàn bộ lịch <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="space-y-4">
            {todayClasses.map((cls, i) => (
              <Card key={cls.id} className={`overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-x-1 border-l-4 ${cls.status === "live" ? "border-l-red-500 ring-1 ring-red-500/20" : "border-l-transparent"}`}>
                {cls.status === "live" && <div className="absolute top-0 right-0 h-full w-32 bg-gradient-to-l from-red-500/5 to-transparent pointer-events-none" />}
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row">
                    <div className="p-5 sm:w-48 bg-muted/20 border-b sm:border-b-0 sm:border-r border-border/50 flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-2">
                      <div className="flex items-center gap-2 text-foreground font-bold">
                        <Clock className="h-4 w-4 text-primary" /> {cls.time.split(" - ")[0]}
                      </div>
                      <span className="text-xs text-muted-foreground hidden sm:block">đến {cls.time.split(" - ")[1]}</span>
                      {cls.status === "live" ? (
                        <Badge className="bg-red-500 text-white animate-pulse border-0 shadow-[0_0_10px_rgba(239,68,68,0.5)]">Đang diễn ra</Badge>
                      ) : cls.status === "done" ? (
                        <Badge variant="outline" className="text-muted-foreground border-border">Đã kết thúc</Badge>
                      ) : (
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0">Sắp tới</Badge>
                      )}
                    </div>
                    <div className="p-5 flex-1 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-foreground mb-1">{cls.class_name}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md"><BookOpen className="h-3.5 w-3.5" /> {cls.subject}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>Thầy Hùng Toán</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <LearningModeBadge mode={cls.learning_mode} />
                        {cls.status === "live" ? (
                          <Link href="/student/classes">
                            <Button className="flex-1 sm:flex-none bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg shadow-red-500/30">
                              Vào lớp ngay
                            </Button>
                          </Link>
                        ) : cls.status === "upcoming" ? (
                          <Link href="/student/materials">
                            <Button variant="outline" className="flex-1 sm:flex-none border-primary/20 text-primary">
                              Chuẩn bị
                            </Button>
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right Column - Tasks & Insights */}
        <div className="space-y-8 animate-fade-in delay-300">
          {/* Urgent Tasks */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Nhiệm vụ cần làm</h2>
            <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200/50 dark:border-amber-900/50">
              <CardContent className="p-5 space-y-4">
                {pendingHomework.slice(0, 3).map((hw, i) => {
                  const isUrgent = i === 0;
                  return (
                    <div key={hw.id} className="flex items-start gap-4 p-3 bg-white dark:bg-card rounded-xl shadow-sm border border-border/50 hover:border-amber-500/30 transition-colors">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${isUrgent ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-foreground truncate">{hw.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isUrgent ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : 'bg-muted text-muted-foreground'}`}>
                            Hạn: {formatDate(hw.due_date)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Link href="/student/homework" className="w-full block">
                  <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20">
                    Xem tất cả nhiệm vụ
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Activity Chart */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Biểu đồ học tập</h2>
            <Card className="border-0 shadow-lg overflow-hidden relative">
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Thời gian học (giờ)</p>
                    <h3 className="text-2xl font-black text-foreground">24.5<span className="text-base font-medium text-muted-foreground ml-1">giờ / tuần</span></h3>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">+12%</Badge>
                </div>
                <div className="h-[150px] -mx-6 -mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ATTENDANCE_CHART_DATA} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Tooltip 
                        contentStyle={{ background: "rgb(var(--card))", border: "none", borderRadius: "12px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                      />
                      <Area type="monotone" dataKey="present" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorPresent)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
