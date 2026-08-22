"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  Homework,
  SavedAttendanceRecord,
  Session,
  Submission,
} from "@/components/teacher/classDetail.types";
import type { CurriculumSession } from "@/lib/storage";
import { toLocalDateKey } from "@/lib/utils";
import { isAttendedStatus } from "@/lib/attendance";
import { weekdayLabelVi } from "@/lib/weekday";
import type { ClassSchedule } from "@/types";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileUp,
  GraduationCap,
  Link2,
  ListTodo,
  MessageSquareText,
  PenLine,
  PlayCircle,
  Presentation,
  Settings2,
  Sparkles,
  UserCheck,
  Users,
  Video,
} from "lucide-react";

type Props = {
  description: string;
  scheduleForDisplay: ClassSchedule[];
  homeworks: Homework[];
  submissions: Submission[];
  attendanceRecords: SavedAttendanceRecord[];
  classStudentsCount: number;
  maxStudents: number;
  onlineLink: string;
  nextSession: Session | null;
  nextSessionContent?: CurriculumSession;
  onEditSchedule: () => void;
  onQuickAdd: (type: "lecture" | "material" | "note") => void;
  onSetupOnlineLink: () => void;
  onOpenCurriculum: () => void;
  onOpenHomework: () => void;
  onCreateHomework: () => void;
  onOpenSessions: () => void;
  onOpenStudents: () => void;
};

function formatSessionDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

export default function OverviewTab({
  description,
  scheduleForDisplay,
  homeworks,
  submissions,
  attendanceRecords,
  classStudentsCount,
  maxStudents,
  onlineLink,
  nextSession,
  nextSessionContent,
  onEditSchedule,
  onQuickAdd,
  onSetupOnlineLink,
  onOpenCurriculum,
  onOpenHomework,
  onCreateHomework,
  onOpenSessions,
  onOpenStudents,
}: Props) {
  const todayKey = toLocalDateKey(new Date());
  const submissionKeys = new Set(
    submissions.map((submission) => `${submission.homework_id}:${submission.student_id}`),
  );

  let expectedSubmissions = 0;
  let completedSubmissions = 0;
  let overdueMissing = 0;

  for (const homework of homeworks) {
    const assignedStudentIds = homework.assigned_to?.length
      ? homework.assigned_to
      : Array.from({ length: classStudentsCount }, (_, index) => `class-student-${index}`);
    expectedSubmissions += assignedStudentIds.length;

    const completedForHomework = homework.kind === "exam"
      ? Object.keys(homework.exam_results ?? {}).length
      : homework.assigned_to?.length
        ? assignedStudentIds.filter((studentId) => submissionKeys.has(`${homework.id}:${studentId}`)).length
        : submissions.filter((submission) => submission.homework_id === homework.id).length;

    completedSubmissions += Math.min(completedForHomework, assignedStudentIds.length);
    if (homework.due_date < todayKey) {
      overdueMissing += Math.max(0, assignedStudentIds.length - completedForHomework);
    }
  }

  const pendingGrading = submissions.filter((submission) => submission.score == null).length;
  const submissionRate = expectedSubmissions > 0
    ? Math.round((completedSubmissions / expectedSubmissions) * 100)
    : null;
  const attendedRecords = attendanceRecords.filter(
    (record) => isAttendedStatus(record.status),
  ).length;
  const attendanceRate = attendanceRecords.length > 0
    ? Math.round((attendedRecords / attendanceRecords.length) * 100)
    : null;
  const capacityRate = maxStudents > 0
    ? Math.min(100, Math.round((classStudentsCount / maxStudents) * 100))
    : null;

  const attentionItems = [
    pendingGrading > 0
      ? {
          label: "Bài nộp đang chờ chấm",
          detail: "Ưu tiên phản hồi để học sinh tiếp tục tiến độ",
          value: pendingGrading,
          icon: ClipboardCheck,
          tone: "text-violet-600 bg-violet-50 dark:bg-violet-950/40",
          onClick: onOpenHomework,
        }
      : null,
    overdueMissing > 0
      ? {
          label: "Lượt nộp đã quá hạn",
          detail: "Kiểm tra và nhắc các học sinh chưa hoàn thành",
          value: overdueMissing,
          icon: AlertTriangle,
          tone: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
          onClick: onOpenHomework,
        }
      : null,
    nextSession && !nextSessionContent
      ? {
          label: "Buổi tiếp theo chưa có nội dung",
          detail: "Gắn bài giảng hoặc bài tập vào lộ trình",
          value: 1,
          icon: BookOpenCheck,
          tone: "text-blue-600 bg-blue-50 dark:bg-blue-950/40",
          onClick: onOpenCurriculum,
        }
      : null,
    !onlineLink
      ? {
          label: "Chưa cài đặt phòng học Online",
          detail: "Thêm link để học sinh tham gia đúng giờ",
          value: 1,
          icon: Link2,
          tone: "text-rose-600 bg-rose-50 dark:bg-rose-950/40",
          onClick: onSetupOnlineLink,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const healthMetrics = [
    {
      label: "Nộp bài",
      value: submissionRate == null ? "—" : `${submissionRate}%`,
      detail: expectedSubmissions > 0 ? `${completedSubmissions}/${expectedSubmissions} lượt` : "Chưa có bài tập",
      icon: CheckCircle2,
      color: "text-emerald-600",
    },
    {
      label: "Chuyên cần",
      value: attendanceRate == null ? "—" : `${attendanceRate}%`,
      detail: attendanceRecords.length > 0 ? `${attendedRecords}/${attendanceRecords.length} lượt` : "Chưa điểm danh",
      icon: UserCheck,
      color: "text-blue-600",
    },
    {
      label: "Sĩ số",
      value: maxStudents > 0 ? `${classStudentsCount}/${maxStudents}` : classStudentsCount,
      detail: capacityRate == null ? "Chưa đặt giới hạn" : `${capacityRate}% sức chứa`,
      icon: Users,
      color: "text-violet-600",
    },
    {
      label: "Bài tập",
      value: homeworks.length,
      detail: pendingGrading > 0 ? `${pendingGrading} bài chờ chấm` : "Đã xử lý hết",
      icon: ListTodo,
      color: "text-amber-600",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
        <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.09] via-card to-card p-5 shadow-sm md:p-6">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex h-full flex-col justify-between gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  <CalendarClock className="h-4 w-4" /> Buổi học tiếp theo
                </div>
                {nextSession ? (
                  <>
                    <h2 className="text-xl font-bold capitalize text-foreground md:text-2xl">
                      {formatSessionDate(nextSession.date)}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-primary" />
                        {nextSession.start_time} – {nextSession.end_time}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <GraduationCap className="h-4 w-4 text-primary" />
                        {classStudentsCount} học viên
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-foreground md:text-2xl">Chưa có lịch học sắp tới</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Thiết lập lịch để bắt đầu vận hành lớp học.</p>
                  </>
                )}
              </div>

              {nextSession && (
                <div className="rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-right shadow-sm backdrop-blur">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Trạng thái</p>
                  <p className={`mt-0.5 text-xs font-bold ${nextSessionContent ? "text-emerald-600" : "text-amber-600"}`}>
                    {nextSessionContent ? "Đã chuẩn bị" : "Cần chuẩn bị"}
                  </p>
                </div>
              )}
            </div>

            {nextSession && (
              <button
                type="button"
                onClick={nextSessionContent ? onOpenSessions : onOpenCurriculum}
                className="group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-background/75 p-3.5 text-left transition hover:border-primary/30 hover:bg-background"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${nextSessionContent ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950" : "bg-amber-100 text-amber-600 dark:bg-amber-950"}`}>
                  {nextSessionContent ? <BookOpenCheck className="h-5 w-5" /> : <PenLine className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {nextSessionContent?.title ?? "Gắn nội dung cho buổi học này"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {nextSessionContent
                      ? `${nextSessionContent.lessons.length} nội dung trong lộ trình`
                      : "Bài giảng, tài liệu và bài tập sẽ hiển thị theo đúng buổi"}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            )}

            <div className="flex flex-wrap gap-2">
              {onlineLink ? (
                <Button
                  size="sm"
                  variant="gradient"
                  onClick={() => window.open(onlineLink, "_blank", "noopener,noreferrer")}
                >
                  <Video className="mr-1.5 h-4 w-4" /> Mở phòng học
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={onSetupOnlineLink}>
                  <Link2 className="mr-1.5 h-4 w-4" /> Cài link Online
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={onOpenSessions}>
                <ClipboardCheck className="mr-1.5 h-4 w-4" /> Điểm danh
              </Button>
              <Button size="sm" variant="outline" onClick={onOpenCurriculum}>
                <BookOpenCheck className="mr-1.5 h-4 w-4" /> Chuẩn bị bài
              </Button>
            </div>
          </div>
        </section>

        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-4 md:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">Sức khỏe lớp</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Các chỉ số vận hành chính</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BarChart3 className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {healthMetrics.map((metric) => (
                <button
                  type="button"
                  key={metric.label}
                  onClick={metric.label === "Sĩ số" ? onOpenStudents : metric.label === "Chuyên cần" ? onOpenSessions : onOpenHomework}
                  className="rounded-xl border border-border/60 bg-muted/20 p-3 text-left transition hover:border-primary/25 hover:bg-primary/[0.04]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <metric.icon className={`h-4 w-4 ${metric.color}`} />
                    <span className="text-lg font-bold text-foreground">{metric.value}</span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-foreground">{metric.label}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{metric.detail}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-foreground">Việc cần xử lý</h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Ưu tiên được tổng hợp từ hoạt động của lớp</p>
              </div>
              {attentionItems.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  {attentionItems.length} việc
                </span>
              )}
            </div>

            {attentionItems.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Lớp học đang được cập nhật tốt</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Hiện không có công việc khẩn cấp cần xử lý.</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {attentionItems.slice(0, 4).map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.onClick}
                    className="group flex w-full items-center gap-3 py-3 text-left first:pt-1 last:pb-0"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground group-hover:text-primary">{item.label}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <span className="min-w-8 rounded-lg bg-muted px-2 py-1 text-center text-xs font-bold text-foreground">{item.value}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-4 md:p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Tạo nhanh</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Thêm nội dung mà không rời tổng quan</p>
                </div>
                <PlayCircle className="h-4 w-4 text-primary" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={onCreateHomework} className="flex items-center gap-2 rounded-xl border border-border/60 p-2.5 text-left text-xs font-semibold transition hover:border-primary/30 hover:bg-primary/5">
                  <ListTodo className="h-4 w-4 text-amber-600" /> Bài tập
                </button>
                <button type="button" onClick={() => onQuickAdd("lecture")} className="flex items-center gap-2 rounded-xl border border-border/60 p-2.5 text-left text-xs font-semibold transition hover:border-primary/30 hover:bg-primary/5">
                  <Presentation className="h-4 w-4 text-blue-600" /> Bài giảng
                </button>
                <button type="button" onClick={() => onQuickAdd("material")} className="flex items-center gap-2 rounded-xl border border-border/60 p-2.5 text-left text-xs font-semibold transition hover:border-primary/30 hover:bg-primary/5">
                  <FileUp className="h-4 w-4 text-emerald-600" /> Tài liệu
                </button>
                <button type="button" onClick={() => onQuickAdd("note")} className="flex items-center gap-2 rounded-xl border border-border/60 p-2.5 text-left text-xs font-semibold transition hover:border-primary/30 hover:bg-primary/5">
                  <MessageSquareText className="h-4 w-4 text-violet-600" /> Ghi chú
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-4 md:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Thông tin lớp</h3>
                <button type="button" onClick={onEditSchedule} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  <Settings2 className="h-3.5 w-3.5" /> Chỉnh sửa
                </button>
              </div>
              {description && <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{description}</p>}
              <div className="space-y-2">
                {scheduleForDisplay.slice(0, 2).map((schedule, index) => (
                  <div key={`${schedule.day}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-muted/35 px-3 py-2 text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-foreground"><Clock className="h-3.5 w-3.5 text-primary" />{weekdayLabelVi(schedule.day)}</span>
                    <span className="text-muted-foreground">{schedule.start_time} – {schedule.end_time}</span>
                  </div>
                ))}
                {scheduleForDisplay.length === 0 && (
                  <button type="button" onClick={onEditSchedule} className="w-full rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary">
                    Thêm lịch học cho lớp
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
