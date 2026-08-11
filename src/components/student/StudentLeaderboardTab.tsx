"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Crown,
  Medal,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  ClassLeaderboardEntry,
  ClassLeaderboardSummary,
} from "@/lib/class-leaderboard";

interface LeaderboardPayload extends ClassLeaderboardSummary {
  classId: string;
  generatedAt: string;
}

interface StudentLeaderboardTabProps {
  classId: string;
}

const PODIUM_STYLES = [
  {
    shell: "border-amber-300/80 bg-gradient-to-b from-amber-50 to-card dark:from-amber-950/30",
    avatar: "ring-4 ring-amber-300",
    icon: Crown,
    iconClass: "text-amber-500",
    label: "Hạng nhất",
  },
  {
    shell: "border-slate-300/80 bg-gradient-to-b from-slate-50 to-card dark:from-slate-900/40",
    avatar: "ring-4 ring-slate-300",
    icon: Medal,
    iconClass: "text-slate-500 dark:text-slate-300",
    label: "Hạng nhì",
  },
  {
    shell: "border-orange-300/80 bg-gradient-to-b from-orange-50 to-card dark:from-orange-950/30",
    avatar: "ring-4 ring-orange-300",
    icon: Medal,
    iconClass: "text-orange-600 dark:text-orange-400",
    label: "Hạng ba",
  },
] as const;

function formatScore(score: number | null) {
  return score === null ? "—" : score.toFixed(1);
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-5" aria-live="polite" aria-busy="true">
      <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-44 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export default function StudentLeaderboardTab({ classId }: StudentLeaderboardTabProps) {
  const [data, setData] = useState<LeaderboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);

  const loadLeaderboard = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch(`/api/student/classes/${encodeURIComponent(classId)}/leaderboard`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("leaderboard_unavailable");
        return response.json() as Promise<LeaderboardPayload>;
      })
      .then(setData)
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [classId, revision]);

  const currentStudent = useMemo(
    () => data?.entries.find((entry) => entry.isCurrentStudent) ?? null,
    [data],
  );
  const podium = useMemo(
    () => data?.entries.filter((entry) => entry.averageScore !== null).slice(0, 3) ?? [],
    [data],
  );

  if (loading) return <LeaderboardSkeleton />;

  if (error || !data) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center px-6 py-14 text-center">
          <Trophy className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="font-semibold">Chưa tải được bảng xếp hạng</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Dữ liệu điểm có thể đang được cập nhật. Bạn thử tải lại sau nhé.
          </p>
          <Button variant="outline" className="mt-5" onClick={loadLeaderboard}>
            <RefreshCw className="mr-2 h-4 w-4" /> Tải lại
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-indigo-300/30 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-5 text-white shadow-lg md:p-6">
        <div className="absolute -right-10 -top-14 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-fuchsia-300/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/80">
              <Sparkles className="h-4 w-4" /> Thành tích trong lớp
            </div>
            <h2 className="flex items-center gap-3 text-2xl font-black md:text-3xl">
              <Trophy className="h-8 w-8 text-amber-300" /> Bảng xếp hạng
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">
              Điểm được quy đổi về thang 100 từ các bài kiểm tra đã có kết quả trong lớp này.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 md:min-w-[360px]">
            {[
              {
                label: "Hạng của bạn",
                value: currentStudent?.rank ? `#${currentStudent.rank}` : "—",
                icon: Trophy,
              },
              {
                label: "Điểm của bạn",
                value: formatScore(currentStudent?.averageScore ?? null),
                icon: Target,
              },
              {
                label: "Đã có điểm",
                value: `${data.scoredStudents}/${data.totalStudents}`,
                icon: Users,
              },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/20 bg-white/10 px-2 py-3 text-center backdrop-blur-sm">
                <stat.icon className="mx-auto mb-1 h-4 w-4 text-white/70" />
                <p className="text-xl font-black leading-none">{stat.value}</p>
                <p className="mt-1.5 text-[10px] font-medium text-white/60">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {podium.length > 0 ? (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Dẫn đầu</p>
              <h3 className="mt-1 text-lg font-bold">Top thành tích nổi bật</h3>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Điểm trung bình lớp</p>
              <p className="text-lg font-black text-primary">{formatScore(data.classAverage)}</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {podium.map((entry, index) => {
              const style = PODIUM_STYLES[index];
              const PodiumIcon = style.icon;
              return (
                <Card key={entry.studentId} className={`overflow-hidden ${style.shell} ${entry.isCurrentStudent ? "ring-2 ring-primary/50" : ""}`}>
                  <CardContent className="relative flex flex-col items-center p-5 text-center">
                    <PodiumIcon className={`absolute right-4 top-4 h-6 w-6 ${style.iconClass}`} />
                    <span className={`mb-4 text-xs font-bold uppercase tracking-wider ${style.iconClass}`}>
                      {style.label}
                    </span>
                    <UserAvatar
                      size="xl"
                      name={entry.displayName}
                      src={entry.avatarUrl}
                      className={style.avatar}
                    />
                    <div className="mt-4 flex items-center gap-2">
                      <p className="max-w-[190px] truncate font-bold">{entry.displayName}</p>
                      {entry.isCurrentStudent && <Badge variant="secondary">Bạn</Badge>}
                    </div>
                    <p className="mt-2 text-3xl font-black text-foreground">{formatScore(entry.averageScore)}</p>
                    <p className="text-xs text-muted-foreground">{entry.assessments} bài đã tính điểm</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <Medal className="mb-3 h-10 w-10 text-muted-foreground/35" />
            <h3 className="font-semibold">Bảng xếp hạng đang chờ điểm đầu tiên</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Kết quả sẽ tự động xuất hiện khi lớp có bài kiểm tra được chấm điểm.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border bg-muted/25 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
          <div>
            <h3 className="font-bold">Toàn bộ lớp</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Khi bằng điểm, học viên có nhiều bài đã tính điểm hơn được xếp trước.
            </p>
          </div>
          <Badge variant="outline" className="w-fit">{data.totalStudents} học viên</Badge>
        </div>
        <div className="divide-y divide-border/60">
          {data.entries.map((entry) => (
            <LeaderboardRow key={entry.studentId} entry={entry} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function LeaderboardRow({ entry }: { entry: ClassLeaderboardEntry }) {
  const rankClass = entry.rank === 1
    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/35 dark:text-amber-300"
    : entry.rank === 2
      ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100"
      : entry.rank === 3
        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/35 dark:text-orange-300"
        : "bg-muted text-muted-foreground";

  return (
    <div className={`grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 transition-colors md:grid-cols-[50px_minmax(0,1fr)_120px_100px] md:px-5 ${entry.isCurrentStudent ? "bg-primary/5" : "hover:bg-muted/25"}`}>
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black ${rankClass}`}>
        {entry.rank ? `#${entry.rank}` : "—"}
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar size="sm" name={entry.displayName} src={entry.avatarUrl} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{entry.displayName}</p>
            {entry.isCurrentStudent && <Badge className="shrink-0 border-0 bg-primary/10 text-primary">Bạn</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground md:hidden">
            {entry.assessments > 0 ? `${entry.assessments} bài đã tính` : "Chưa có điểm"}
          </p>
        </div>
      </div>
      <div className="hidden text-right md:block">
        <p className="text-sm font-semibold">{entry.assessments}</p>
        <p className="text-[11px] text-muted-foreground">Bài đã tính</p>
      </div>
      <div className="text-right">
        <p className={`text-lg font-black ${entry.averageScore === null ? "text-muted-foreground" : "text-foreground"}`}>
          {formatScore(entry.averageScore)}
        </p>
        <p className="text-[11px] text-muted-foreground">Thang 100</p>
      </div>
    </div>
  );
}
