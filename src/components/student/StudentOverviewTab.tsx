"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "@/components/shared";
import type { StudentPackage } from "@/lib/storage";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock,
  FileText,
  GraduationCap,
  MapPin,
  NotebookPen,
  PlayCircle,
  Sparkles,
  Target,
  UserRound,
  Video,
} from "lucide-react";

export type StudentOverviewTask = {
  id: string;
  title: string;
  dueDate: string;
  kind: "file" | "exam";
};

export type StudentOverviewLecture = {
  id: string;
  title: string;
  duration?: string;
  videoUrl: string | null;
  watched: boolean;
};

export type StudentOverviewNote = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};

export type StudentOverviewSession = {
  date: string;
  startTime: string;
  endTime: string;
  title?: string;
  contentCount?: number;
};

type Props = {
  description: string;
  tutorName: string;
  subject: string;
  classroom?: string;
  onlineLink?: string;
  packageType: StudentPackage | null;
  nextSession: StudentOverviewSession | null;
  tasks: StudentOverviewTask[];
  recentLectures: StudentOverviewLecture[];
  notes: StudentOverviewNote[];
  completionPct: number;
  watchedCount: number;
  totalLectures: number;
  attendanceRate: number | null;
  avgScore: string | null;
  onOpenCurriculum: () => void;
  onOpenHomework: () => void;
  onOpenSessions: () => void;
  onOpenLectures: () => void;
  onOpenNotes: () => void;
  onWatchLecture: (lectureId: string, videoUrl: string | null) => void;
};

const PACKAGE_META: Record<StudentPackage, { label: string; className: string }> = {
  online: {
    label: "Gói Online",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  advanced: {
    label: "Gói Nâng cao",
    className: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
  offline: {
    label: "Gói Offline",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
};

function localDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

function formatSessionDate(date: string) {
  return localDate(date).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

function dueMeta(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = localDate(date);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) {
    return {
      label: `Quá hạn ${Math.abs(days)} ngày`,
      className: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
      urgent: true,
    };
  }
  if (days === 0) {
    return {
      label: "Hạn hôm nay",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      urgent: true,
    };
  }
  if (days <= 3) {
    return {
      label: `Còn ${days} ngày`,
      className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
      urgent: true,
    };
  }
  return {
    label: localDate(date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
    className: "bg-muted text-muted-foreground",
    urgent: false,
  };
}

export default function StudentOverviewTab({
  description,
  tutorName,
  subject,
  classroom,
  onlineLink,
  packageType,
  nextSession,
  tasks,
  recentLectures,
  notes,
  completionPct,
  watchedCount,
  totalLectures,
  attendanceRate,
  avgScore,
  onOpenCurriculum,
  onOpenHomework,
  onOpenSessions,
  onOpenLectures,
  onOpenNotes,
  onWatchLecture,
}: Props) {
  const nextTask = tasks[0];
  const nextLecture = recentLectures.find((lecture) => !lecture.watched);
  const taskIsUrgent = nextTask ? dueMeta(nextTask.dueDate).urgent : false;
  const primaryIsTask = Boolean(nextTask && (taskIsUrgent || !nextLecture));

  const primaryTitle = primaryIsTask
    ? nextTask.title
    : nextLecture?.title ?? "Xem lộ trình học tập";
  const primaryDescription = primaryIsTask
    ? `${nextTask.kind === "exam" ? "Bài kiểm tra" : "Bài tập"} · ${dueMeta(nextTask.dueDate).label}`
    : nextLecture
      ? "Tiếp tục bài giảng chưa hoàn thành"
      : "Xem nội dung và chuẩn bị cho buổi học tiếp theo";
  const primaryLabel = primaryIsTask
    ? nextTask.kind === "exam" ? "Làm bài ngay" : "Xem bài tập"
    : nextLecture ? "Tiếp tục học" : "Mở lộ trình";

  const handlePrimaryAction = () => {
    if (primaryIsTask) {
      onOpenHomework();
      return;
    }
    if (nextLecture) {
      onWatchLecture(nextLecture.id, nextLecture.videoUrl);
      return;
    }
    onOpenCurriculum();
  };

  const metrics = [
    {
      label: "Tiến độ bài giảng",
      value: `${completionPct}%`,
      detail: `${watchedCount}/${totalLectures} đã xem`,
      icon: Target,
      color: "text-primary",
      onClick: onOpenLectures,
    },
    {
      label: "Chuyên cần",
      value: attendanceRate == null ? "—" : `${attendanceRate}%`,
      detail: attendanceRate == null ? "Chưa có dữ liệu" : "Tỷ lệ tham gia",
      icon: CheckCircle2,
      color: "text-emerald-600",
      onClick: onOpenSessions,
    },
    {
      label: "Điểm trung bình",
      value: avgScore == null ? "—" : avgScore,
      detail: avgScore == null ? "Chưa có điểm" : "Thang điểm 10",
      icon: GraduationCap,
      color: "text-violet-600",
      onClick: onOpenHomework,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.1] via-card to-card p-5 shadow-sm md:p-6">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex h-full flex-col justify-between gap-6">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                <Sparkles className="h-4 w-4" /> Học tiếp theo
              </div>
              <h2 className="max-w-3xl text-xl font-bold leading-snug text-foreground md:text-2xl">{primaryTitle}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{primaryDescription}</p>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/75 p-3.5 backdrop-blur">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Tiến độ bài giảng</span>
                <span className="font-bold text-primary">{completionPct}%</span>
              </div>
              <ProgressBar value={completionPct} showValue={false} color="bg-primary" />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Bạn đã hoàn thành {watchedCount} trong tổng số {totalLectures} bài giảng.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="gradient" onClick={handlePrimaryAction}>
                {primaryIsTask ? <NotebookPen className="mr-1.5 h-4 w-4" /> : <PlayCircle className="mr-1.5 h-4 w-4" />}
                {primaryLabel}
              </Button>
              <Button size="sm" variant="outline" onClick={onOpenCurriculum}>
                <BookOpenCheck className="mr-1.5 h-4 w-4" /> Xem lộ trình
              </Button>
            </div>
          </div>
        </section>

        <Card className="border-border/70 shadow-sm">
          <CardContent className="flex h-full flex-col p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Buổi học tiếp theo</p>
                {nextSession ? (
                  <>
                    <h3 className="mt-2 text-lg font-bold capitalize text-foreground">{formatSessionDate(nextSession.date)}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 text-primary" />
                      {nextSession.startTime} – {nextSession.endTime}
                    </p>
                  </>
                ) : (
                  <h3 className="mt-2 text-lg font-bold text-foreground">Chưa có lịch sắp tới</h3>
                )}
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarClock className="h-5 w-5" />
              </div>
            </div>

            {nextSession?.title && (
              <button
                type="button"
                onClick={onOpenSessions}
                className="group mt-4 flex items-center gap-3 rounded-xl border border-border/60 bg-muted/25 p-3 text-left transition hover:border-primary/30 hover:bg-primary/[0.04]"
              >
                <BookOpenCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">{nextSession.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{nextSession.contentCount ?? 0} nội dung</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </button>
            )}

            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              {onlineLink && (
                <Button
                  size="sm"
                  variant="gradient"
                  className="flex-1"
                  onClick={() => window.open(onlineLink, "_blank", "noopener,noreferrer")}
                >
                  <Video className="mr-1.5 h-4 w-4" /> Tham gia Online
                </Button>
              )}
              <Button size="sm" variant="outline" className="flex-1" onClick={onOpenSessions}>
                Chi tiết buổi học
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {metrics.map((metric) => (
          <button
            type="button"
            key={metric.label}
            onClick={metric.onClick}
            className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3.5 text-left shadow-sm transition hover:border-primary/25 hover:bg-primary/[0.03]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/50">
              <metric.icon className={`h-5 w-5 ${metric.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-xs font-semibold text-muted-foreground">{metric.label}</p>
                <p className="text-lg font-bold text-foreground">{metric.value}</p>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{metric.detail}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <div className="space-y-4">
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-4 md:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CircleAlert className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-bold text-foreground">Sắp đến hạn</h3>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Những bài cần ưu tiên hoàn thành</p>
                </div>
                <Button size="sm" variant="ghost" className="text-xs text-primary" onClick={onOpenHomework}>
                  Xem tất cả <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>

              {tasks.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900">
                    <Check className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Bạn đã hoàn thành các bài được giao</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Hãy tiếp tục học theo lộ trình của lớp.</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {tasks.slice(0, 3).map((task) => {
                    const due = dueMeta(task.dueDate);
                    return (
                      <button
                        type="button"
                        key={task.id}
                        onClick={onOpenHomework}
                        className="group flex w-full items-center gap-3 py-3 text-left first:pt-1 last:pb-0"
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${task.kind === "exam" ? "bg-violet-100 text-violet-600 dark:bg-violet-950" : "bg-amber-100 text-amber-600 dark:bg-amber-950"}`}>
                          {task.kind === "exam" ? <GraduationCap className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{task.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{task.kind === "exam" ? "Bài kiểm tra" : "Bài tập nộp file"}</p>
                        </div>
                        <Badge className={`shrink-0 border-0 text-[10px] ${due.className}`}>{due.label}</Badge>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-4 md:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Bài giảng gần đây</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Mở nhanh và tiếp tục từ nội dung gần nhất</p>
                </div>
                <Button size="sm" variant="ghost" className="text-xs text-primary" onClick={onOpenLectures}>
                  Thư viện <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>

              {recentLectures.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-8 text-center text-muted-foreground">
                  <PlayCircle className="mx-auto mb-2 h-8 w-8 opacity-30" />
                  <p className="text-xs">Chưa có bài giảng được xuất bản.</p>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {recentLectures.slice(0, 4).map((lecture) => (
                    <button
                      type="button"
                      key={lecture.id}
                      onClick={() => onWatchLecture(lecture.id, lecture.videoUrl)}
                      className="group flex items-center gap-3 rounded-xl border border-border/60 p-3 text-left transition hover:border-primary/30 hover:bg-primary/[0.04]"
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${lecture.watched ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950" : "bg-primary/10 text-primary"}`}>
                        {lecture.watched ? <Check className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary">{lecture.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{lecture.watched ? "Đã xem" : lecture.duration || "Chưa xem"}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {notes[0] && (
            <Card className="border-amber-200/80 bg-amber-50/35 shadow-sm dark:border-amber-900 dark:bg-amber-950/15">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900">
                    <NotebookPen className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">Nhắn từ giáo viên</p>
                    <h3 className="mt-1 truncate text-sm font-bold text-foreground">{notes[0].title}</h3>
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{notes[0].content}</p>
                    <button type="button" onClick={onOpenNotes} className="mt-3 flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline dark:text-amber-300">
                      Xem ghi chú <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-4 md:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Thông tin lớp</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Thông tin cần thiết trong quá trình học</p>
                </div>
                {packageType && (
                  <Badge className={`border-0 text-[10px] ${PACKAGE_META[packageType].className}`}>
                    {PACKAGE_META[packageType].label}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-muted/35 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {tutorName.split(" ").slice(-2).map((name) => name[0]).join("") || "GV"}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{tutorName}</p>
                  <p className="text-xs text-muted-foreground">Giảng viên · {subject}</p>
                </div>
              </div>

              <div className="mt-3 space-y-2 text-xs">
                {classroom && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
                    <span className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> Phòng học</span>
                    <span className="font-semibold text-foreground">{classroom}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-muted-foreground"><UserRound className="h-3.5 w-3.5" /> Hình thức</span>
                  <span className="font-semibold text-foreground">{onlineLink ? "Có phòng học Online" : "Theo lịch của lớp"}</span>
                </div>
              </div>

              {description && (
                <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{description}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
