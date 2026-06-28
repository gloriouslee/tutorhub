"use client";

import { useState, useMemo } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared";
import { MOCK_CLASSES } from "@/lib/mock-data";
import {
  Clock, MapPin, Video, ChevronLeft, ChevronRight,
  CalendarDays, CalendarRange, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DAY_EN: Record<string, number> = {
  Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4,
  Friday: 5, Saturday: 6, Sunday: 0,
};

const DAY_LABEL = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const DAY_FULL  = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatDate(d: Date) {
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Build flat list of sessions per day-of-week index (0=Sun … 6=Sat)
// ─────────────────────────────────────────────────────────────────────────────

interface Session {
  classId: string;
  className: string;
  subject: string;
  start: string;
  end: string;
  color: string;
  classroom?: string;
  teacher?: string;
}

const SESSION_BY_DOW: Record<number, Session[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

MOCK_CLASSES.forEach(cls => {
  cls.schedule.forEach(slot => {
    const dow = DAY_EN[slot.day];
    if (dow === undefined) return;
    SESSION_BY_DOW[dow].push({
      classId:   cls.id,
      className: cls.class_name,
      subject:   cls.subject,
      start:     slot.start_time,
      end:       slot.end_time,
      color:     cls.color,
      classroom: cls.classroom,
    });
  });
});

Object.values(SESSION_BY_DOW).forEach(arr => arr.sort((a, b) => a.start.localeCompare(b.start)));

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

type Range = "2w" | "1m";

export default function StudentSchedulePage() {
  const [range, setRange]       = useState<Range>("2w");
  const [offset, setOffset]     = useState(0);   // in units of the selected range

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Start of current view window (always Monday of today's week, shifted by offset)
  const windowStart = useMemo(() => {
    // find Monday of today's week
    const dow = today.getDay(); // 0=Sun
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const mon = addDays(today, diffToMon);

    if (range === "2w") return addDays(mon, offset * 14);
    // 1 month: first day of current month shifted by offset months
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    // shift to Monday of that week
    const dowFOM = firstOfMonth.getDay();
    const diffFOM = dowFOM === 0 ? -6 : 1 - dowFOM;
    return addDays(firstOfMonth, diffFOM);
  }, [today, range, offset]);

  const totalDays = range === "2w" ? 14 : 35; // 5 weeks covers any month

  // Build day objects for the window
  const days = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => {
      const date = addDays(windowStart, i);
      const dow  = date.getDay();
      return {
        date,
        dow,
        label:    DAY_FULL[dow],
        short:    DAY_LABEL[dow],
        isToday:  sameDay(date, today),
        isPast:   date < today,
        sessions: SESSION_BY_DOW[dow] ?? [],
      };
    });
  }, [windowStart, totalDays, today]);

  // For 1-month view: cut to only days in the target month
  const visibleDays = useMemo(() => {
    if (range === "2w") return days;
    const targetMonth = new Date(today.getFullYear(), today.getMonth() + offset, 1).getMonth();
    return days.filter(d => d.date.getMonth() === targetMonth);
  }, [days, range, offset, today]);

  // Label for the nav bar
  const windowLabel = useMemo(() => {
    if (range === "2w") {
      const end = addDays(windowStart, 13);
      return `${formatDate(windowStart)} – ${formatDate(end)}`;
    }
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    return d.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
  }, [windowStart, range, offset, today]);

  const totalSessions = visibleDays.reduce((s, d) => s + d.sessions.length, 0);

  return (
    <PortalLayout role="student" userName="Nguyễn Anh Tuấn" pageTitle="Lịch học">
      <div className="space-y-5 max-w-3xl mx-auto">

        <SectionHeader
          title="Lịch học của tôi"
          subtitle={`${totalSessions} buổi học trong kỳ này`}
        />

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Range toggle */}
          <div className="flex rounded-xl border border-border bg-muted/40 p-1 gap-1">
            {([
              { value: "2w", icon: CalendarRange, label: "2 tuần" },
              { value: "1m", icon: CalendarDays,  label: "1 tháng" },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => { setRange(opt.value); setOffset(0); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  range === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <opt.icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setOffset(o => o - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={() => setOffset(0)}
              className="text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted transition-colors min-w-[130px] text-center"
            >
              {windowLabel}
            </button>
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setOffset(o => o + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Day list */}
        <div className="space-y-2">
          {visibleDays.map(({ date, dow, label, short, isToday, isPast, sessions }) => {
            const hasSessions = sessions.length > 0;

            return (
              <div key={date.toISOString()} className={`rounded-2xl overflow-hidden transition-all ${
                isToday
                  ? "ring-2 ring-primary shadow-md shadow-primary/10"
                  : hasSessions
                    ? "border border-border"
                    : "border border-border/40 opacity-50"
              }`}>

                {/* Day header */}
                <div className={`flex items-center gap-3 px-4 py-3 ${
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : hasSessions
                      ? "bg-muted/40"
                      : "bg-muted/20"
                }`}>
                  {/* Date circle */}
                  <div className={`h-9 w-9 rounded-full flex flex-col items-center justify-center shrink-0 font-bold leading-none ${
                    isToday
                      ? "bg-white/20 text-white"
                      : isPast
                        ? "bg-muted text-muted-foreground"
                        : "bg-background text-foreground shadow-sm"
                  }`}>
                    <span className="text-[9px] uppercase font-bold opacity-70">{short}</span>
                    <span className="text-sm">{date.getDate()}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-semibold ${isToday ? "text-white" : "text-foreground"}`}>
                      {label}
                      {isToday && <span className="ml-2 text-xs font-medium opacity-80">· Hôm nay</span>}
                    </span>
                    <p className={`text-xs mt-0.5 ${isToday ? "text-white/70" : "text-muted-foreground"}`}>
                      {formatDate(date)} {new Date().getFullYear() !== date.getFullYear() ? date.getFullYear() : ""}
                    </p>
                  </div>

                  {hasSessions && (
                    <Badge
                      className={`shrink-0 text-[10px] ${isToday ? "bg-white/20 text-white border-0" : ""}`}
                      variant={isToday ? "secondary" : "outline"}
                    >
                      {sessions.length} buổi
                    </Badge>
                  )}
                </div>

                {/* Sessions */}
                {hasSessions && (
                  <div className="divide-y divide-border/50 bg-card">
                    {sessions.map((s, idx) => (
                      <div key={`${s.classId}-${idx}`} className="flex items-stretch gap-0 group hover:bg-muted/20 transition-colors">
                        {/* Color strip */}
                        <div className="w-1 shrink-0 rounded-none" style={{ background: s.color }} />

                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-semibold text-foreground">{s.className}</span>
                              <span className="text-xs text-muted-foreground">{s.subject}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {s.start} – {s.end}
                              </span>
                              {s.classroom ? (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  {s.classroom}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-blue-500">
                                  <Video className="h-3 w-3" /> Online
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0">
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                              style={{ background: s.color }}
                            >
                              <BookOpen className="h-2.5 w-2.5 inline mr-0.5" />
                              {s.subject}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty day (no class) */}
                {!hasSessions && (
                  <div className="px-4 py-2 bg-card">
                    <p className="text-xs text-muted-foreground italic">Không có buổi học</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </PortalLayout>
  );
}
