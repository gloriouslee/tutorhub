"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  saveClassScheduleOverride, pushScheduleNotification, saveOnlineLink,
} from "@/lib/storage";
import { ClassSchedule } from "@/types";
import {
  Clock, Video, Calendar, Plus, Trash2, Save, AlertCircle, CheckCircle2, Loader2,
} from "lucide-react";
import { DAYS_VI } from "./classDetail.types";

// ── Schedule Editor ──────────────────────────────────────────────────────────

function ScheduleEditor({ classId, className, initialSchedule, onSaved }: {
  classId: string;
  className: string;
  initialSchedule: ClassSchedule[];
  onSaved?: (schedule: ClassSchedule[]) => void;
}) {
  const [rows, setRows] = useState<ClassSchedule[]>(initialSchedule);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [notifMessage, setNotifMessage] = useState("");
  const [showNotifField, setShowNotifField] = useState(false);
  const [dirty, setDirty] = useState(false);

  const updateRow = (idx: number, field: keyof ClassSchedule, value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    setDirty(true);
  };

  // Mỗi thứ trong tuần chỉ được một ca học
  const usedDays = rows.map(r => r.day);
  const hasDuplicateDays = new Set(usedDays).size !== usedDays.length;
  const allDaysUsed = DAYS_VI.every(d => usedDays.includes(d));

  const addRow = () => {
    const freeDay = DAYS_VI.find(d => !usedDays.includes(d));
    if (!freeDay) return;
    setRows(prev => [...prev, { day: freeDay, start_time: "08:00", end_time: "10:00" }]);
    setDirty(true);
  };

  const removeRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaveState("saving");
    try {
      await saveClassScheduleOverride(classId, rows);

      const scheduleText = rows.map(r => `${r.day} ${r.start_time}–${r.end_time}`).join(", ");
      await pushScheduleNotification({
        class_id: classId,
        class_name: className,
        message: notifMessage.trim() || `Lịch học lớp ${className} đã được cập nhật: ${scheduleText}.`,
      });

      onSaved?.(rows);
      setSaveState("success");
      setDirty(false);
      setShowNotifField(false);
      setNotifMessage("");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Buổi học trong tuần
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/60">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
              </div>
              <select
                value={row.day}
                onChange={e => updateRow(i, "day", e.target.value)}
                className="h-9 flex-1 min-w-0 sm:w-36 sm:flex-none rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                {DAYS_VI.map(d => (
                  <option key={d} value={d} disabled={d !== row.day && usedDays.includes(d)}>{d}</option>
                ))}
              </select>
              <div className="flex items-center gap-2 flex-1 sm:flex-none">
                <input
                  type="time"
                  value={row.start_time}
                  onChange={e => updateRow(i, "start_time", e.target.value)}
                  className="h-9 w-28 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-muted-foreground text-sm">–</span>
                <input
                  type="time"
                  value={row.end_time}
                  onChange={e => updateRow(i, "end_time", e.target.value)}
                  className="h-9 w-28 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                onClick={() => removeRow(i)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-auto sm:ml-0"
                title="Xoá buổi học"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {(hasDuplicateDays || allDaysUsed) && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Mỗi thứ chỉ một ca — điều chỉnh giờ ca hiện có.
            </p>
          )}

          <button
            onClick={addRow}
            disabled={allDaysUsed}
            className="flex items-center gap-2 text-sm text-primary hover:underline font-medium disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" /> Thêm buổi học
          </button>
        </CardContent>
      </Card>

      {dirty && (
        <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-900/10">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Lịch học có thay đổi</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Khi lưu, hệ thống sẽ đẩy thông báo đến toàn bộ học viên trong lớp.
                </p>
              </div>
              <button
                onClick={() => setShowNotifField(v => !v)}
                className="text-xs text-amber-700 dark:text-amber-400 underline whitespace-nowrap"
              >
                {showNotifField ? "Ẩn" : "Tuỳ chỉnh nội dung"}
              </button>
            </div>

            {showNotifField && (
              <textarea
                value={notifMessage}
                onChange={e => setNotifMessage(e.target.value)}
                rows={3}
                placeholder={`VD: Lịch học lớp ${className} đã thay đổi từ tuần sau. Vui lòng kiểm tra lại...`}
                className="w-full rounded-lg border border-amber-200 dark:border-amber-800 bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-amber-400"
              />
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button
          className="h-10 px-6"
          disabled={!dirty || saveState === "saving"}
          onClick={handleSave}
        >
          {saveState === "saving"
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Đang lưu...</>
            : <><Save className="h-4 w-4 mr-2" />Lưu & gửi thông báo</>}
        </Button>

        {saveState === "success" && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <CheckCircle2 className="h-4 w-4" /> Đã lưu và gửi thông báo
          </span>
        )}
        {saveState === "error" && (
          <span className="flex items-center gap-1.5 text-sm text-red-500 font-medium">
            <AlertCircle className="h-4 w-4" /> Lưu thất bại
          </span>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Lịch hiện tại (xem trước)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có buổi học nào.</p>
          ) : rows.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-primary" />{s.day}
              </span>
              <span className="text-sm text-muted-foreground">{s.start_time} – {s.end_time}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Schedule tab (editor + online link) ──────────────────────────────────────

export default function ScheduleTab({
  classId,
  className,
  currentSchedule,
  onlineLink,
  setOnlineLink,
  onlineLinkDraft,
  setOnlineLinkDraft,
  linkSaved,
  setLinkSaved,
  onSaveOnlineLink,
  onSaved,
}: {
  classId: string;
  className: string;
  currentSchedule: ClassSchedule[];
  onlineLink: string;
  setOnlineLink: (v: string) => void;
  onlineLinkDraft: string;
  setOnlineLinkDraft: (v: string) => void;
  linkSaved: boolean;
  setLinkSaved: (v: boolean) => void;
  onSaveOnlineLink: () => void;
  onSaved?: (schedule: ClassSchedule[]) => void;
}) {
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <div className="mb-5">
          <h2 className="text-base font-semibold">Cài đặt lịch học</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Chỉnh sửa lịch buổi học. Khi lưu, hệ thống tự động đẩy thông báo đến toàn bộ học viên trong lớp <strong>{className}</strong>.
          </p>
        </div>
        <ScheduleEditor
          classId={classId}
          className={className}
          initialSchedule={currentSchedule}
          onSaved={onSaved}
        />
      </div>

      {/* Online link editor */}
      <Card>
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" /> Phòng học Online
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Dán link phòng học (Zoom, Google Meet, Microsoft Teams…). Học viên sẽ thấy nút tham gia trực tiếp trên trang lớp học.
          </p>

          <div className="flex flex-wrap gap-2">
            {[
              { label: "Zoom",          prefix: "https://zoom.us/j/" },
              { label: "Google Meet",   prefix: "https://meet.google.com/" },
              { label: "Microsoft Teams",prefix: "https://teams.microsoft.com/" },
            ].map(p => (
              <button
                key={p.label}
                onClick={() => {
                  if (!onlineLinkDraft.startsWith(p.prefix)) setOnlineLinkDraft(p.prefix);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-border bg-muted hover:border-primary/40 hover:bg-primary/5 transition-colors font-medium text-muted-foreground"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={onlineLinkDraft}
              onChange={e => { setOnlineLinkDraft(e.target.value); setLinkSaved(false); }}
              placeholder="https://zoom.us/j/123456789  hoặc  meet.google.com/abc-defg-hij"
              className="flex-1 font-mono text-xs"
            />
            <Button
              onClick={onSaveOnlineLink}
              disabled={onlineLinkDraft === onlineLink}
              className="shrink-0"
            >
              <Save className="h-4 w-4 mr-1.5" /> Lưu
            </Button>
          </div>

          {onlineLink && (
            <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="text-xs text-emerald-700 dark:text-emerald-400 truncate font-mono">{onlineLink}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 ml-2 text-xs"
                onClick={() => window.open(onlineLink, "_blank", "noopener,noreferrer")}
              >
                <Video className="h-3.5 w-3.5 mr-1" /> Mở thử
              </Button>
            </div>
          )}

          {linkSaved && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Đã lưu link phòng học
            </p>
          )}

          {onlineLink && (
            <button
              onClick={async () => { setOnlineLinkDraft(""); await saveOnlineLink(classId, ""); setOnlineLink(""); }}
              className="text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              Xoá link
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
