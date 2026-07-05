"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LearningModeBadge, SectionHeader } from "@/components/shared";
import { MOCK_CLASSES, MOCK_TEACHERS } from "@/lib/mock-data";
import { getOnlineLink } from "@/lib/storage";
import { BookOpen, Clock, Video, MapPin, Users, Search, ChevronRight, GraduationCap } from "lucide-react";
import { useStudentContext } from "@/hooks/useStudentContext";

const DAY_VI: Record<string, string> = {
  Monday: "Thứ Hai", Tuesday: "Thứ Ba", Wednesday: "Thứ Tư",
  Thursday: "Thứ Năm", Friday: "Thứ Sáu", Saturday: "Thứ Bảy", Sunday: "Chủ Nhật",
};

type ModeFilter = "all" | "online" | "offline" | "hybrid";

const MODE_LABELS: Record<ModeFilter, string> = {
  all: "Tất cả", online: "Trực tuyến", offline: "Trực tiếp", hybrid: "Kết hợp",
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StudentClassesPage() {
  const { studentName, myClasses } = useStudentContext();
  const [search,      setSearch]      = useState("");
  const [modeFilter,  setModeFilter]  = useState<ModeFilter>("all");
  const [onlineLinks, setOnlineLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    const links: Record<string, string> = {};
    myClasses.forEach(cls => {
      links[cls.id] = getOnlineLink(cls.id) ?? cls.zoom_link ?? "";
    });
    setOnlineLinks(links);
  }, [myClasses]);

  const displayed = useMemo(() => myClasses.filter(cls => {
    const matchSearch = cls.class_name.toLowerCase().includes(search.toLowerCase())
      || cls.subject.toLowerCase().includes(search.toLowerCase());
    const matchMode = modeFilter === "all" || cls.learning_mode === modeFilter;
    return matchSearch && matchMode;
  }), [myClasses, search, modeFilter]);

  return (
    <PortalLayout role="student" userName={studentName} pageTitle="Lớp học của tôi">
      <div className="space-y-6 max-w-6xl mx-auto">
        <SectionHeader
          title="Lớp học đã đăng ký"
          subtitle={`${myClasses.length} lớp đang theo học trong học kỳ này`}
        />

        {/* ── Search + filter bar ───────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 bg-card p-2 rounded-2xl border border-border shadow-sm">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm tên lớp, môn học..."
              className="w-full h-10 pl-9 pr-3 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Mode filter */}
          <div className="flex items-center gap-1.5 px-1 pb-1 sm:pb-0 overflow-x-auto shrink-0">
            {(["all", "online", "offline", "hybrid"] as ModeFilter[]).map(mode => (
              <button
                key={mode}
                onClick={() => setModeFilter(mode)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  modeFilter === mode
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                }`}
              >
                {MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>

        {/* ── Class grid ───────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {displayed.length === 0 ? (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-border/50 rounded-2xl">
              <BookOpen className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <h3 className="text-base font-semibold text-foreground">Không tìm thấy lớp học</h3>
              <p className="text-sm text-muted-foreground mt-1">Thử thay đổi từ khoá hoặc bộ lọc.</p>
            </div>
          ) : (
            displayed.map((cls, i) => {
              const tutor        = MOCK_TEACHERS.find(t => t.id === cls.tutor_id);
              const studentCount = cls.student_ids?.length ?? 0;
              const liveLink     = onlineLinks[cls.id] || "";

              return (
                <Link key={cls.id} href={`/student/classes/${cls.id}`} className="block group">
                  <Card
                    className="overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/50 animate-fade-in h-full flex flex-col"
                    style={{ animationDelay: `${(i % 6) * 80}ms` }}
                  >
                    {/* Color accent bar */}
                    <div className="h-1.5 w-full shrink-0" style={{ background: cls.color }} />

                    <CardHeader className="pb-3 bg-muted/10">
                      <div className="flex items-start gap-3">
                        <div
                          className="h-12 w-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm transition-transform group-hover:scale-110"
                          style={{ background: cls.color }}
                        >
                          <BookOpen className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
                            {cls.class_name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5 font-medium">{cls.subject}</p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-3 space-y-3 flex-1 flex flex-col">
                      {/* Mode + zoom badge */}
                      <div className="flex items-center justify-between gap-2">
                        <LearningModeBadge mode={cls.learning_mode} />
                        {liveLink && (
                          <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-[10px]">
                            <Video className="h-3 w-3 mr-1" /> Online sẵn sàng
                          </Badge>
                        )}
                      </div>

                      {/* Schedule */}
                      <div className="space-y-1.5 p-2.5 bg-muted/30 rounded-xl border border-border/50">
                        {cls.schedule.map((s, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-foreground font-medium">
                            <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>
                              {DAY_VI[s.day] ?? s.day}
                              <span className="text-muted-foreground mx-1.5">·</span>
                              {s.start_time} – {s.end_time}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Meta: teacher + location + students */}
                      <div className="space-y-1.5 flex-1">
                        {/* Teacher */}
                        {tutor && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <GraduationCap className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                            <span className="font-medium text-foreground truncate">{tutor.full_name}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-3 flex-wrap">
                          {cls.classroom && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              {cls.classroom}
                            </span>
                          )}
                          {cls.max_students && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                              {studentCount}/{cls.max_students} học viên
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1 mt-auto border-t border-border/50">
                        {cls.zoom_link ? (
                          <Button
                            size="sm"
                            variant="gradient"
                            className="flex-1 shadow-md shadow-primary/20 text-xs"
                            onClick={e => {
                              e.preventDefault();
                              window.open(cls.zoom_link, "_blank", "noopener,noreferrer");
                            }}
                          >
                            <Video className="h-3.5 w-3.5 mr-1.5" /> Tham gia Online
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-primary/20 text-primary hover:bg-primary/5 text-xs"
                          >
                            <MapPin className="h-3.5 w-3.5 mr-1.5" /> Xem chi tiết lớp
                          </Button>
                        )}
                        <Button size="icon" variant="outline" className="w-9 h-9 shrink-0">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
