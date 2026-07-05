"use client";

import { useState, useEffect } from "react";
import {
  BookOpen, Calendar, CheckSquare, GraduationCap,
  Clock, Bell, ArrowRight, FileText,
  PlayCircle, Trophy, Star, Target, Sparkles, AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LearningModeBadge, SectionHeader } from "@/components/shared";
import {
  MOCK_CLASSES, MOCK_HOMEWORK, MOCK_ATTENDANCE,
  MOCK_EXAM_SCORES, MOCK_TEACHERS, ATTENDANCE_CHART_DATA,
} from "@/lib/mock-data";
import { getNotifications, getEnrollments } from "@/lib/storage";
import { getSubmissionsByStudent } from "@/lib/supabase/submissions";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { AreaChart, Area, Tooltip, ResponsiveContainer } from "recharts";

const DOW_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DOW_VI: Record<string, string> = {
  Monday: "Thứ Hai", Tuesday: "Thứ Ba", Wednesday: "Thứ Tư",
  Thursday: "Thứ Năm", Friday: "Thứ Sáu", Saturday: "Thứ Bảy", Sunday: "Chủ Nhật",
};

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function buildWeekSessions(classes: typeof MOCK_CLASSES) {
  const now      = new Date();
  const todayIdx = now.getDay();
  const curHour  = now.getHours() + now.getMinutes() / 60;

  return classes
    .flatMap(cls => {
      const tutor = MOCK_TEACHERS.find(t => t.id === cls.tutor_id);
      return cls.schedule.map(s => {
        const dayIdx = DOW_EN.indexOf(s.day);
        let status: "live" | "done" | "upcoming";
        if (dayIdx < todayIdx)      status = "done";
        else if (dayIdx > todayIdx) status = "upcoming";
        else {
          const [sh, sm] = s.start_time.split(":").map(Number);
          const [eh, em] = s.end_time.split(":").map(Number);
          const start = sh + sm / 60;
          const end   = eh + em / 60;
          status = curHour >= start && curHour < end ? "live"
                 : curHour >= end ? "done"
                 : "upcoming";
        }
        return {
          cls, tutorName: tutor?.full_name ?? "Giáo viên",
          day: s.day, dayVi: DOW_VI[s.day] ?? s.day,
          start_time: s.start_time, end_time: s.end_time, status,
        };
      });
    })
    .sort((a, b) => DOW_EN.indexOf(a.day) - DOW_EN.indexOf(b.day));
}

export default function StudentDashboard() {
  const [studentId,   setStudentId]   = useState("s1");
  const [studentName, setStudentName] = useState("Nguyễn Anh Tuấn");
  const [myClasses,   setMyClasses]   = useState(() =>
    MOCK_CLASSES.filter(c => c.student_ids?.includes("s1"))
  );
  const [avgScore,       setAvgScore]       = useState<string | null>(null);
  const [attendanceRate, setAttendanceRate] = useState(100);
  const [unreadCount,    setUnreadCount]    = useState(0);
  const [submittedCount, setSubmittedCount] = useState(0);

  useEffect(() => {
    // Determine if enrolled student or demo
    const enrolledId   = getCookie("enrolled_student_id");   // e.g. "enr_<uuid>"
    const enrolledName = getCookie("enrolled_student_name");
    const enrolledClass = getCookie("enrolled_student_class");

    let sid = "s1";
    let sname = "Nguyễn Anh Tuấn";
    let classes = MOCK_CLASSES.filter(c => c.student_ids?.includes("s1"));

    if (enrolledId && enrolledName) {
      sid   = enrolledId;
      sname = enrolledName;
      // Try to find their assigned class in MOCK_CLASSES
      const assignedClass = enrolledClass
        ? MOCK_CLASSES.filter(c => c.id === enrolledClass)
        : [];
      classes = assignedClass;
    }

    setStudentId(sid);
    setStudentName(sname);
    setMyClasses(classes);

    // Scores
    const exams = MOCK_EXAM_SCORES.filter(e => e.student_id === sid);
    setAvgScore(exams.length > 0
      ? (exams.reduce((acc, e) => acc + (e.score / e.max_score) * 10, 0) / exams.length).toFixed(1)
      : null
    );

    // Attendance
    const att = MOCK_ATTENDANCE.filter(a => a.student_id === sid);
    setAttendanceRate(att.length > 0
      ? Math.round((att.filter(a => a.status === "present" || a.status === "late").length / att.length) * 100)
      : 100
    );

    // Notifications
    getNotifications().then(all => {
      setUnreadCount(all.filter(n =>
        (n.target_role === "student" || n.target_role === "all") && !n.is_read
      ).length);
    });

    // Submissions
    getSubmissionsByStudent(sid).then(subs => {
      const classIds = classes.map(c => c.id);
      const hw = MOCK_HOMEWORK.filter(h => classIds.includes(h.class_id));
      setSubmittedCount(subs.filter(s =>
        hw.find(h => h.id === s.homework_id)
      ).length);
    });
  }, []);

  const now             = new Date();
  const todayStr        = now.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const greetingHour    = now.getHours();
  const greeting        = greetingHour < 12 ? "Chào buổi sáng" : greetingHour < 18 ? "Chào buổi chiều" : "Chào buổi tối";

  const myClassIds        = myClasses.map(c => c.id);
  const myHomework        = MOCK_HOMEWORK.filter(h => myClassIds.includes(h.class_id));
  const pendingHomework   = myHomework.filter(h => new Date(h.due_date) >= now);
  const homeworkTotal     = myHomework.length;
  const completionPct     = homeworkTotal > 0 ? Math.round((submittedCount / homeworkTotal) * 100) : 0;
  const weekSessions      = buildWeekSessions(myClasses);
  const todaySessions     = weekSessions.filter(s => DOW_EN[now.getDay()] === s.day);
  const displaySessions   = todaySessions.length > 0 ? todaySessions : weekSessions;
  const scheduleTitle     = todaySessions.length > 0 ? "Lịch học hôm nay" : "Lịch học tuần này";

  return (
    <div className="space-y-8 pb-10">

      {/* ── Hero banner ─────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl p-8 sm:p-10 text-white shadow-2xl shadow-indigo-500/20 animate-fade-in group">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-900 transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-gradient-to-br from-white/20 to-transparent blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-gradient-to-tr from-fuchsia-500/30 to-transparent blur-3xl" />
        <div className="absolute top-1/2 right-1/4 h-64 w-64 rounded-full bg-gradient-to-tr from-cyan-500/20 to-transparent blur-3xl animate-pulse" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-medium text-white/90">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" /> TutorHub Học viên
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-white">
              {greeting}, <br />{studentName}! 👋
            </h1>
            <p className="text-white/80 text-base md:text-lg font-medium max-w-md leading-relaxed">
              {myClasses.length === 0
                ? <>Chào mừng đến với TutorHub! Tài khoản của bạn đang được cấu hình lớp học.</>
                : pendingHomework.length > 0
                  ? <>Bạn có <strong className="text-white">{pendingHomework.length} bài tập</strong> đang chờ và <strong className="text-white">{myClasses.length} lớp học</strong> đang theo học.</>
                  : <>Tuyệt vời! Bạn đã hoàn thành tất cả bài tập. Tiếp tục duy trì phong độ nhé!</>
              }
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
              <p className="text-3xl font-bold text-white">
                {avgScore ?? "—"}<span className="text-sm font-medium text-white/60">/10</span>
              </p>
              <p className="text-xs text-white/80 mt-1 uppercase tracking-wider">Điểm TB</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-center min-w-[120px]">
              <Target className="h-8 w-8 mx-auto mb-2 text-emerald-300" />
              <p className="text-3xl font-bold text-white">
                {completionPct}<span className="text-sm font-medium text-white/60">%</span>
              </p>
              <p className="text-xs text-white/80 mt-1 uppercase tracking-wider">Hoàn thành</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { title: "Lớp đang học",   value: myClasses.length,      icon: BookOpen,    color: "from-blue-500 to-indigo-500",   shadow: "shadow-blue-500/20" },
          { title: "Chuyên cần",     value: `${attendanceRate}%`,  icon: CheckSquare, color: "from-emerald-400 to-teal-500",  shadow: "shadow-emerald-500/20" },
          { title: "Bài tập chờ",   value: pendingHomework.length, icon: FileText,    color: "from-amber-400 to-orange-500",  shadow: "shadow-orange-500/20" },
          { title: "Thông báo mới", value: unreadCount,            icon: Bell,        color: "from-fuchsia-500 to-purple-500",shadow: "shadow-fuchsia-500/20" },
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
              <div className={`absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br ${stat.color} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* ── Schedule ─────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-6 animate-fade-in delay-200">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">{scheduleTitle}</h2>
              <p className="text-sm text-muted-foreground mt-1 capitalize">{todayStr}</p>
            </div>
            <Link href="/student/schedule">
              <Button variant="outline" className="hidden sm:flex border-primary/20 text-primary hover:bg-primary/5">
                Toàn bộ lịch <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {displaySessions.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="p-10 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-semibold">
                  {myClasses.length === 0 ? "Bạn chưa được phân lớp học." : "Không có lớp học tuần này."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {displaySessions.map((session, i) => (
                <Card
                  key={`${session.cls.id}-${session.day}-${i}`}
                  className={`overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-x-1 border-l-4 ${
                    session.status === "live"
                      ? "border-l-red-500 ring-1 ring-red-500/20"
                      : "border-l-transparent"
                  }`}
                >
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row">
                      <div className="p-5 sm:w-48 bg-muted/20 border-b sm:border-b-0 sm:border-r border-border/50 flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-2">
                        <div>
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{session.dayVi}</p>
                          <div className="flex items-center gap-1.5 text-foreground font-bold mt-0.5">
                            <Clock className="h-4 w-4 text-primary" /> {session.start_time}
                          </div>
                          <p className="text-xs text-muted-foreground hidden sm:block mt-0.5">đến {session.end_time}</p>
                        </div>
                        {session.status === "live" ? (
                          <Badge className="bg-red-500 text-white animate-pulse border-0 shadow-[0_0_10px_rgba(239,68,68,0.5)]">Đang diễn ra</Badge>
                        ) : session.status === "done" ? (
                          <Badge variant="outline" className="text-muted-foreground border-border">Đã kết thúc</Badge>
                        ) : (
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0">Sắp tới</Badge>
                        )}
                      </div>
                      <div className="p-5 flex-1 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <h3 className="text-lg font-bold text-foreground mb-1">{session.cls.class_name}</h3>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md">
                              <BookOpen className="h-3.5 w-3.5" /> {session.cls.subject}
                            </span>
                            <span className="hidden sm:inline">·</span>
                            <span>{session.tutorName}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <LearningModeBadge mode={session.cls.learning_mode} />
                          {session.status === "live" ? (
                            <Link href="/student/classes">
                              <Button className="flex-1 sm:flex-none bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg shadow-red-500/30">
                                Vào lớp ngay
                              </Button>
                            </Link>
                          ) : session.status === "upcoming" ? (
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
          )}
        </div>

        {/* ── Right column ──────────────────────────────── */}
        <div className="space-y-8 animate-fade-in delay-300">

          {/* Pending homework */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Bài tập cần nộp</h2>
              <Link href="/student/homework">
                <Button variant="ghost" size="sm" className="text-primary text-xs">
                  Xem tất cả <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </div>

            {pendingHomework.length === 0 ? (
              <Card className="bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40">
                <CardContent className="p-5 text-center">
                  <CheckSquare className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    {myClasses.length === 0 ? "Chưa có lớp học nào." : "Không có bài tập nào đang chờ!"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200/50 dark:border-amber-900/50">
                <CardContent className="p-5 space-y-3">
                  {pendingHomework.slice(0, 3).map((hw, i) => {
                    const days = Math.ceil((new Date(hw.due_date).getTime() - Date.now()) / 86400000);
                    const urgent = days <= 2;
                    return (
                      <div key={hw.id} className="flex items-start gap-3 p-3 bg-white dark:bg-card rounded-xl shadow-sm border border-border/50 hover:border-amber-500/30 transition-colors">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${urgent ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                          {urgent ? <AlertCircle className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{hw.title}</p>
                          <p className={`text-[11px] font-semibold mt-0.5 ${urgent ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                            {days <= 0 ? "Hết hạn hôm nay!" : days === 1 ? "Còn 1 ngày" : `Còn ${days} ngày · ${formatDate(hw.due_date)}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <Link href="/student/homework" className="w-full block">
                    <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20">
                      Xem tất cả {pendingHomework.length} bài tập
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Activity chart */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Biểu đồ học tập</h2>
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Chuyên cần</p>
                    <h3 className="text-2xl font-black text-foreground">
                      {attendanceRate}<span className="text-base font-medium text-muted-foreground ml-1">%</span>
                    </h3>
                  </div>
                  <Badge className={`border-0 ${attendanceRate >= 90 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                    {attendanceRate >= 90 ? "Xuất sắc" : attendanceRate >= 75 ? "Khá" : "Cần cải thiện"}
                  </Badge>
                </div>
                <div className="h-[140px] -mx-6 -mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ATTENDANCE_CHART_DATA} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Tooltip contentStyle={{ background: "rgb(var(--card))", border: "none", borderRadius: "12px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }} />
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
