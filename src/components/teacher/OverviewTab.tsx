"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClassSchedule } from "@/types";
import { Clock, Video, Upload, Presentation, StickyNote } from "lucide-react";

export default function OverviewTab({
  description,
  scheduleForDisplay,
  lectures,
  materials,
  notes,
  classStudentsCount,
  maxStudents,
  onlineLink,
  onEditSchedule,
  onQuickAdd,
  onSetupOnlineLink,
}: {
  description: string;
  scheduleForDisplay: ClassSchedule[];
  lectures: any[];
  materials: any[];
  notes: any[];
  classStudentsCount: number;
  maxStudents: number;
  onlineLink: string;
  onEditSchedule: () => void;
  onQuickAdd: (type: "lecture" | "material" | "note") => void;
  onSetupOnlineLink: () => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Thông tin lớp học</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">{description}</p>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lịch học</p>
              <button
                onClick={onEditSchedule}
                className="text-xs text-primary hover:underline"
              >
                Chỉnh sửa lịch →
              </button>
            </div>
            <div className="space-y-2">
              {scheduleForDisplay.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50">
                  <span className="flex items-center gap-2 text-sm font-medium"><Clock className="h-4 w-4 text-primary" />{s.day}</span>
                  <span className="text-sm text-muted-foreground">{s.start_time} – {s.end_time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button onClick={() => onQuickAdd("lecture")} className="p-5 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-center group">
            <Presentation className="h-8 w-8 text-muted-foreground mx-auto mb-2 group-hover:text-primary transition-colors" />
            <p className="text-sm font-semibold group-hover:text-primary transition-colors">Thêm bài giảng</p>
            <p className="text-xs text-muted-foreground mt-0.5">Video, slide bài giảng</p>
          </button>
          <button onClick={() => onQuickAdd("material")} className="p-5 rounded-2xl border-2 border-dashed border-border hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all text-center group">
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2 group-hover:text-emerald-600 transition-colors" />
            <p className="text-sm font-semibold group-hover:text-emerald-600 transition-colors">Tải tài liệu</p>
            <p className="text-xs text-muted-foreground mt-0.5">PDF, tóm tắt, đề thi</p>
          </button>
          <button onClick={() => onQuickAdd("note")} className="p-5 rounded-2xl border-2 border-dashed border-border hover:border-amber-500/50 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all text-center group">
            <StickyNote className="h-8 w-8 text-muted-foreground mx-auto mb-2 group-hover:text-amber-600 transition-colors" />
            <p className="text-sm font-semibold group-hover:text-amber-600 transition-colors">Viết ghi chú</p>
            <p className="text-xs text-muted-foreground mt-0.5">Thông báo, nhắc nhở</p>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Thống kê nhanh</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Bài giảng đã đăng</span><span className="font-bold">{lectures.filter(l => l.is_published).length}/{lectures.length}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tài liệu</span><span className="font-bold">{materials.length} file</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Ghi chú đã ghim</span><span className="font-bold">{notes.filter(n => n.is_pinned).length}</span></div>
              <div className="flex justify-between text-sm pt-2 border-t border-border/50"><span className="text-muted-foreground">Sĩ số</span><span className="font-bold">{classStudentsCount}/{maxStudents}</span></div>
            </div>
          </CardContent>
        </Card>
        {onlineLink ? (
          <Button
            variant="gradient"
            className="w-full shadow-lg shadow-primary/20"
            onClick={() => window.open(onlineLink, "_blank", "noopener,noreferrer")}
          >
            <Video className="h-4 w-4 mr-2" />Mở phòng học Online
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full text-muted-foreground"
            onClick={onSetupOnlineLink}
          >
            <Video className="h-4 w-4 mr-2" />Cài đặt link Online
          </Button>
        )}
      </div>
    </div>
  );
}
