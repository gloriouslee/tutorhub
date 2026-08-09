"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, User, Video, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Class } from "@/types";

type View = "month" | "week" | "day";

interface CalEvent {
  key: string;
  classId: string;
  title: string;
  subject: string;
  teacher: string;
  color: string;
  isOnline: boolean;
  classroom?: string;
  date: Date;
  startMin: number;
  endMin: number;
  start: string;
  end: string;
}

const DAY_EN_TO_DOW: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};
// Tuần bắt đầu từ Thứ Hai, theo thói quen ở Việt Nam.
const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const DAY_FULL = [
  "Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy",
];
const HOUR_HEIGHT = 56;

function toMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const dow = d.getDay();
  return addDays(d, dow === 0 ? -6 : 1 - dow);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/** Lịch lớp lặp lại hàng tuần, nên buổi học được sinh ra theo từng ngày trong khoảng đang xem. */
function buildEvents(classes: Class[], from: Date, days: number): CalEvent[] {
  const byDow = new Map<number, { cls: Class; start: string; end: string }[]>();
  classes.forEach((cls) => {
    (cls.schedule ?? []).forEach((slot) => {
      const dow = DAY_EN_TO_DOW[slot.day];
      if (dow === undefined) return;
      const list = byDow.get(dow) ?? [];
      list.push({ cls, start: slot.start_time, end: slot.end_time });
      byDow.set(dow, list);
    });
  });

  const events: CalEvent[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    (byDow.get(date.getDay()) ?? []).forEach((slot, index) => {
      events.push({
        key: `${slot.cls.id}-${date.toDateString()}-${index}`,
        classId: slot.cls.id,
        title: slot.cls.class_name,
        subject: slot.cls.subject,
        teacher: slot.cls.tutor_name ?? "Giáo viên",
        color: slot.cls.color ?? "#6366f1",
        isOnline: slot.cls.learning_mode === "online",
        classroom: slot.cls.classroom,
        date,
        startMin: toMinutes(slot.start),
        endMin: toMinutes(slot.end),
        start: slot.start,
        end: slot.end,
      });
    });
  }
  return events.sort((a, b) => a.startMin - b.startMin);
}

/**
 * Chia cột cho các buổi trùng giờ trong cùng một ngày (giống Google Calendar):
 * gom thành cụm chồng lấn, rồi trong mỗi cụm xếp tham lam vào cột trống đầu tiên.
 */
function packDay(events: CalEvent[]): { ev: CalEvent; col: number; cols: number }[] {
  const sorted = [...events].sort(
    (a, b) => a.startMin - b.startMin || a.endMin - b.endMin,
  );
  const out: { ev: CalEvent; col: number; cols: number }[] = [];
  let cluster: CalEvent[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const columns: CalEvent[][] = [];
    const assigned = new Map<string, number>();
    cluster.forEach((ev) => {
      let index = 0;
      while (
        index < columns.length
        && columns[index][columns[index].length - 1].endMin > ev.startMin
      ) index++;
      if (!columns[index]) columns[index] = [];
      columns[index].push(ev);
      assigned.set(ev.key, index);
    });
    cluster.forEach((ev) =>
      out.push({ ev, col: assigned.get(ev.key) ?? 0, cols: columns.length }),
    );
    cluster = [];
    clusterEnd = -1;
  };

  sorted.forEach((ev) => {
    if (cluster.length > 0 && ev.startMin >= clusterEnd) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.endMin);
  });
  flush();
  return out;
}

export default function ScheduleCalendar({ classes }: { classes: Class[] }) {
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState<Date>(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);

  const today = useMemo(() => startOfDay(new Date()), []);

  // Vạch "bây giờ" chỉ vẽ ở client để tránh lệch giữa server và trình duyệt.
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    };
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);

  const range = useMemo(() => {
    if (view === "day") return { from: cursor, days: 1 };
    if (view === "week") return { from: startOfWeek(cursor), days: 7 };
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    return { from: startOfWeek(firstOfMonth), days: 42 };
  }, [view, cursor]);

  const events = useMemo(
    () => buildEvents(classes, range.from, range.days),
    [classes, range],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    events.forEach((ev) => {
      const key = ev.date.toDateString();
      map.set(key, [...(map.get(key) ?? []), ev]);
    });
    return map;
  }, [events]);

  // Khung giờ vừa đủ chứa các buổi học, thay vì luôn hiển thị trọn 24 giờ.
  const [hourFrom, hourTo] = useMemo(() => {
    if (events.length === 0) return [7, 21];
    const earliest = Math.min(...events.map((ev) => ev.startMin));
    const latest = Math.max(...events.map((ev) => ev.endMin));
    return [
      Math.max(0, Math.floor(earliest / 60) - 1),
      Math.min(24, Math.ceil(latest / 60) + 1),
    ];
  }, [events]);

  const title = useMemo(() => {
    if (view === "day") {
      return `${DAY_FULL[cursor.getDay()]}, ${cursor.toLocaleDateString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric",
      })}`;
    }
    if (view === "week") {
      const from = startOfWeek(cursor);
      const to = addDays(from, 6);
      const fmt = (d: Date) =>
        d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
      return `${fmt(from)} – ${fmt(to)}, ${to.getFullYear()}`;
    }
    return cursor.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
  }, [view, cursor]);

  function shift(direction: number) {
    setCursor((current) => {
      if (view === "day") return addDays(current, direction);
      if (view === "week") return addDays(current, direction * 7);
      return new Date(current.getFullYear(), current.getMonth() + direction, 1);
    });
  }

  const totalSessions = events.length;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      {/* ── Thanh điều khiển ─────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(startOfDay(new Date()))}
          >
            Hôm nay
          </Button>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => shift(-1)}
              aria-label="Kỳ trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => shift(1)}
              aria-label="Kỳ sau"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="ml-1 text-lg font-semibold capitalize text-foreground">
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-3 lg:ml-auto">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {totalSessions} buổi
          </span>
          <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
            {([
              { value: "day", label: "Ngày" },
              { value: "week", label: "Tuần" },
              { value: "month", label: "Tháng" },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setView(option.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === option.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {classes.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground">
          <CalendarDays className="mx-auto mb-3 h-10 w-10 opacity-20" />
          <p className="font-semibold">Bạn chưa được xếp lớp học nào.</p>
        </div>
      ) : view === "month" ? (
        <MonthGrid
          from={range.from}
          cursorMonth={cursor.getMonth()}
          today={today}
          eventsByDay={eventsByDay}
          onSelect={setSelected}
          onPickDay={(date) => { setCursor(date); setView("day"); }}
        />
      ) : (
        <TimeGrid
          from={range.from}
          days={range.days}
          today={today}
          hourFrom={hourFrom}
          hourTo={hourTo}
          nowMinutes={nowMinutes}
          eventsByDay={eventsByDay}
          onSelect={setSelected}
        />
      )}

      {selected && (
        <EventDetail event={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

// ─── Xem theo tháng ───────────────────────────────────────────────────────────

function MonthGrid({
  from, cursorMonth, today, eventsByDay, onSelect, onPickDay,
}: {
  from: Date;
  cursorMonth: number;
  today: Date;
  eventsByDay: Map<string, CalEvent[]>;
  onSelect: (event: CalEvent) => void;
  onPickDay: (date: Date) => void;
}) {
  const cells = Array.from({ length: 42 }, (_, i) => addDays(from, i));
  // Bỏ hàng cuối khi nó hoàn toàn thuộc tháng sau.
  const rows = cells[35].getMonth() === cursorMonth ? 6 : 5;

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-border">
        {WEEK_DAYS.map((dow) => (
          <div
            key={dow}
            className="py-2 text-center text-xs font-semibold uppercase text-muted-foreground"
          >
            {DAY_SHORT[dow]}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.slice(0, rows * 7).map((date) => {
          const dayEvents = eventsByDay.get(date.toDateString()) ?? [];
          const isToday = sameDay(date, today);
          const outside = date.getMonth() !== cursorMonth;
          return (
            // Ô ngày là div chứ không phải button: các chip buổi học bên trong
            // cũng là nút bấm, mà nút lồng trong nút là HTML không hợp lệ.
            <div
              key={date.toISOString()}
              className={`min-h-[104px] border-b border-r border-border p-1.5 align-top ${
                outside ? "bg-muted/20" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onPickDay(date)}
                title="Xem chi tiết ngày"
                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold transition-colors hover:bg-muted ${
                  isToday
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : outside
                      ? "text-muted-foreground/50"
                      : "text-foreground"
                }`}
              >
                {date.getDate()}
              </button>
              <div className="mt-1 space-y-1">
                {dayEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.key}
                    type="button"
                    onClick={() => onSelect(ev)}
                    className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] font-medium text-white"
                    style={{ background: ev.color }}
                  >
                    <span className="hidden sm:inline">{ev.start}</span>
                    <span className="truncate">{ev.title}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <button
                    type="button"
                    onClick={() => onPickDay(date)}
                    className="block px-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    +{dayEvents.length - 3} buổi nữa
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Xem theo tuần / ngày ─────────────────────────────────────────────────────

function TimeGrid({
  from, days, today, hourFrom, hourTo, nowMinutes, eventsByDay, onSelect,
}: {
  from: Date;
  days: number;
  today: Date;
  hourFrom: number;
  hourTo: number;
  nowMinutes: number | null;
  eventsByDay: Map<string, CalEvent[]>;
  onSelect: (event: CalEvent) => void;
}) {
  const hours = Array.from({ length: hourTo - hourFrom }, (_, i) => hourFrom + i);
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  const bodyHeight = hours.length * HOUR_HEIGHT;
  const offsetTop = (minutes: number) =>
    ((minutes - hourFrom * 60) / 60) * HOUR_HEIGHT;

  return (
    <div className="overflow-x-auto">
      <div className={days === 1 ? "min-w-full" : "min-w-[720px]"}>
        {/* Đầu cột ngày */}
        <div
          className="grid border-b border-border"
          style={{ gridTemplateColumns: `56px repeat(${days}, minmax(0, 1fr))` }}
        >
          <div />
          {dates.map((date) => {
            const isToday = sameDay(date, today);
            return (
              <div key={date.toISOString()} className="py-2 text-center">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  {DAY_SHORT[date.getDay()]}
                </p>
                <p
                  className={`mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground"
                  }`}
                >
                  {date.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Lưới giờ */}
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `56px repeat(${days}, minmax(0, 1fr))` }}
        >
          <div className="relative" style={{ height: bodyHeight }}>
            {hours.map((hour, index) => (
              <span
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground"
                style={{ top: index * HOUR_HEIGHT }}
              >
                {index === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
              </span>
            ))}
          </div>

          {dates.map((date) => {
            const dayEvents = eventsByDay.get(date.toDateString()) ?? [];
            const packed = packDay(dayEvents);
            const isToday = sameDay(date, today);
            return (
              <div
                key={date.toISOString()}
                className="relative border-l border-border"
                style={{ height: bodyHeight }}
              >
                {hours.map((hour, index) => (
                  <div
                    key={hour}
                    className="absolute inset-x-0 border-t border-border/60"
                    style={{ top: index * HOUR_HEIGHT }}
                  />
                ))}

                {isToday && nowMinutes !== null
                  && nowMinutes >= hourFrom * 60 && nowMinutes <= hourTo * 60 && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                    style={{ top: offsetTop(nowMinutes) }}
                  >
                    <span className="h-2 w-2 -translate-x-1 rounded-full bg-red-500" />
                    <span className="h-px flex-1 bg-red-500" />
                  </div>
                )}

                {packed.map(({ ev, col, cols }) => (
                  <button
                    key={ev.key}
                    type="button"
                    onClick={() => onSelect(ev)}
                    className="absolute z-10 overflow-hidden rounded-md px-1.5 py-1 text-left text-white shadow-sm transition-transform hover:z-30 hover:scale-[1.02]"
                    style={{
                      top: offsetTop(ev.startMin),
                      height: Math.max(
                        22,
                        ((ev.endMin - ev.startMin) / 60) * HOUR_HEIGHT - 2,
                      ),
                      left: `calc(${(col / cols) * 100}% + 2px)`,
                      width: `calc(${100 / cols}% - 4px)`,
                      background: ev.color,
                    }}
                  >
                    <span className="block truncate text-[11px] font-semibold leading-tight">
                      {ev.title}
                    </span>
                    <span className="block truncate text-[10px] leading-tight opacity-90">
                      {ev.start} – {ev.end}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Chi tiết buổi học ────────────────────────────────────────────────────────

function EventDetail({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-1 h-4 w-4 shrink-0 rounded"
            style={{ background: event.color }}
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-foreground">{event.title}</h3>
            <p className="text-sm text-muted-foreground">{event.subject}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              {DAY_FULL[event.date.getDay()]},{" "}
              {event.date.toLocaleDateString("vi-VN", {
                day: "2-digit", month: "2-digit", year: "numeric",
              })}
              {" · "}
              {event.start} – {event.end}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4 shrink-0" />
            <span>{event.teacher}</span>
          </div>
          {event.isOnline ? (
            <div className="flex items-center gap-2 text-blue-500">
              <Video className="h-4 w-4 shrink-0" />
              <span>Học online</span>
            </div>
          ) : event.classroom ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{event.classroom}</span>
            </div>
          ) : null}
        </dl>

        <Link href={`/student/classes/${event.classId}`} className="mt-5 block">
          <Button className="w-full">Vào lớp học</Button>
        </Link>
      </div>
    </div>
  );
}
