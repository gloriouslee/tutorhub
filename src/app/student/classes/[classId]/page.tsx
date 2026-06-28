"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LearningModeBadge, ProgressBar, SectionHeader } from "@/components/shared";
import {
  MOCK_CLASSES, MOCK_TEACHERS, MOCK_CLASS_MATERIALS,
  MOCK_LECTURES, MOCK_CLASS_NOTES, MOCK_EXAM_SCORES,
} from "@/lib/mock-data";
import {
  BookOpen, Clock, Video, MapPin, Users, ArrowLeft, FileText, Download,
  PlayCircle, StickyNote, Pin, Eye, ChevronRight, Image, GraduationCap,
  Calendar, Presentation, Tag, Lock, ShieldAlert,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Current student — from auth session in a real app
// ─────────────────────────────────────────────────────────────────────────────

const CURRENT_STUDENT_ID = "s1";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

type TabKey = "overview" | "lectures" | "materials" | "notes";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "overview",   label: "Tổng quan",  icon: BookOpen },
  { key: "lectures",   label: "Bài giảng",  icon: Presentation },
  { key: "materials",  label: "Tài liệu",   icon: FileText },
  { key: "notes",      label: "Ghi chú",    icon: StickyNote },
];

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  formula:  { label: "Công thức", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  exam_prep:{ label: "Ôn thi",    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  summary:  { label: "Tóm tắt",   color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  textbook: { label: "Giáo trình",color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
};

const DAY_VI: Record<string, string> = {
  Monday: "Thứ Hai", Tuesday: "Thứ Ba", Wednesday: "Thứ Tư",
  Thursday: "Thứ Năm", Friday: "Thứ Sáu", Saturday: "Thứ Bảy", Sunday: "Chủ Nhật",
};

function getFileIcon(type: string) {
  if (type === "video") return <PlayCircle className="h-5 w-5" />;
  if (type === "image") return <Image className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentClassDetailPage() {
  const params  = useParams();
  const classId = params.classId as string;
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const cls = MOCK_CLASSES.find(c => c.id === classId);

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!cls) {
    return (
      <PortalLayout role="student" userName="Nguyễn Anh Tuấn" pageTitle="Lớp học">
        <div className="flex flex-col items-center justify-center py-20">
          <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold">Không tìm thấy lớp học</h2>
          <Link href="/student/classes">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />Quay lại
            </Button>
          </Link>
        </div>
      </PortalLayout>
    );
  }

  // ── Enrollment check ───────────────────────────────────────────────────────
  const isEnrolled = (cls.student_ids ?? []).includes(CURRENT_STUDENT_ID);
  if (!isEnrolled) {
    return (
      <PortalLayout role="student" userName="Nguyễn Anh Tuấn" pageTitle="Lớp học">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold">Bạn không có quyền truy cập lớp này</h2>
          <p className="text-sm text-muted-foreground mt-1">Bạn chưa được đăng ký vào lớp học này.</p>
          <Link href="/student/classes">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />Quay lại danh sách lớp
            </Button>
          </Link>
        </div>
      </PortalLayout>
    );
  }

  // ── Data ───────────────────────────────────────────────────────────────────
  const teacher   = MOCK_TEACHERS.find(t => t.id === cls.tutor_id);
  const materials = MOCK_CLASS_MATERIALS.filter(m => m.class_id === classId);
  const lectures  = MOCK_LECTURES.filter(l => l.class_id === classId);
  const notes     = MOCK_CLASS_NOTES.filter(n => n.class_id === classId);

  // Average score from real exam data for this student + class
  const myScores   = MOCK_EXAM_SCORES.filter(e => e.student_id === CURRENT_STUDENT_ID && e.class_id === classId);
  const avgScore   = myScores.length
    ? (myScores.reduce((s, e) => s + e.score, 0) / myScores.length).toFixed(1)
    : null;

  // Completion: published lectures watched (using views > 0 as proxy, 0 = not watched)
  const publishedLectures = lectures.filter(l => l.is_published);
  const watchedCount      = publishedLectures.filter(l => l.views > 0).length;
  const completionPct     = publishedLectures.length > 0
    ? Math.round((watchedCount / publishedLectures.length) * 100)
    : 0;

  // Enrolled student count
  const enrolledCount = (cls.student_ids ?? []).length;

  // Only show zoom button for online/hybrid classes
  const showZoom = cls.zoom_link && (cls.learning_mode === "online" || cls.learning_mode === "hybrid");

  return (
    <PortalLayout role="student" userName="Nguyễn Anh Tuấn" pageTitle={cls.class_name}>
      <div className="space-y-6 max-w-6xl mx-auto">

        <Link href="/student/classes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Quay lại danh sách lớp
        </Link>

        {/* Hero */}
        <div className="rounded-2xl overflow-hidden border border-border/50 shadow-sm">
          <div className="p-6 md:p-8 text-white relative" style={{ background: `linear-gradient(135deg, ${cls.color} 0%, #000 250%)` }}>
            <div className="flex flex-col md:flex-row gap-5 items-start">
              <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/30 shadow-lg shrink-0">
                <BookOpen className="h-8 w-8" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <LearningModeBadge mode={cls.learning_mode} />
                  {cls.grade && (
                    <Badge className="bg-white/20 text-white border-white/30 text-[10px]">
                      <GraduationCap className="h-3 w-3 mr-1" />Lớp {cls.grade}
                    </Badge>
                  )}
                  {showZoom && (
                    <Badge className="bg-white/20 text-white border-white/30 text-[10px]">
                      <Video className="h-3 w-3 mr-1" />Zoom
                    </Badge>
                  )}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold leading-tight">{cls.class_name}</h1>
                <p className="text-white/70 mt-1 font-medium">{cls.subject}</p>
              </div>
              <div className="flex flex-wrap gap-3 shrink-0">
                {[
                  { value: publishedLectures.length, label: "Bài giảng" },
                  { value: materials.length,         label: "Tài liệu" },
                  { value: notes.length,             label: "Ghi chú" },
                ].map(stat => (
                  <div key={stat.label} className="bg-white/10 backdrop-blur px-4 py-2 rounded-xl text-center border border-white/20">
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-[11px] text-white/60">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-card border-b border-border px-4 md:px-8 flex gap-1 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.key === "lectures"  && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{publishedLectures.length}</span>}
                {tab.key === "materials" && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{materials.length}</span>}
                {tab.key === "notes"     && notes.some(n => n.is_pinned) && <span className="h-2 w-2 bg-red-500 rounded-full" />}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="animate-fade-in">

          {/* ── Overview ── */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">

                {/* Description */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Mô tả khóa học</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {cls.description || "Khóa học cung cấp kiến thức nền tảng và nâng cao, bám sát chương trình chuẩn."}
                    </p>
                  </CardContent>
                </Card>

                {/* Schedule */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Lịch học</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {cls.schedule.map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <Clock className="h-4 w-4 text-primary" />
                          {DAY_VI[s.day] ?? s.day}
                        </span>
                        <span className="text-sm text-muted-foreground">{s.start_time} – {s.end_time}</span>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-4 pt-1">
                      {cls.classroom && (
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 text-amber-500" />
                          Phòng học: <strong className="text-foreground">{cls.classroom}</strong>
                        </span>
                      )}
                      {showZoom && (
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Video className="h-4 w-4 text-blue-500" />
                          Có phòng học Online
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Recent lectures */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Bài giảng gần đây</CardTitle>
                      <Button size="sm" variant="ghost" onClick={() => setActiveTab("lectures")}>
                        Xem tất cả <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {publishedLectures.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">
                        <Presentation className="h-10 w-10 mx-auto opacity-20 mb-2" />
                        <p className="text-sm">Chưa có bài giảng nào</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {publishedLectures.slice(0, 3).map(lec => (
                          <div key={lec.id} className="flex items-center gap-4 p-3 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                              <PlayCircle className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{lec.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{lec.duration} · {lec.views} lượt xem</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right sidebar */}
              <div className="space-y-6">

                {/* Teacher */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Giảng viên</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/50">
                      <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {teacher?.full_name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{teacher?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{teacher?.specialization}</p>
                      </div>
                    </div>
                    {teacher?.bio && (
                      <p className="text-xs text-muted-foreground leading-relaxed px-1">{teacher.bio}</p>
                    )}
                  </CardContent>
                </Card>

                {/* Class info */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Thông tin lớp</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {[
                      { icon: Users,         label: "Sĩ số",    value: `${enrolledCount} / ${cls.max_students} học viên` },
                      { icon: GraduationCap, label: "Khối lớp", value: cls.grade ? `Lớp ${cls.grade}` : "—" },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                          <row.icon className="h-3.5 w-3.5" />{row.label}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{row.value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Progress */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Tiến trình của tôi</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Hoàn thành bài giảng</span>
                      <span className="font-bold text-primary">{completionPct}%</span>
                    </div>
                    <ProgressBar value={completionPct} showValue={false} color="bg-primary" />
                    <div className="flex justify-between text-sm pt-2 border-t border-border/50">
                      <span className="text-muted-foreground">Điểm trung bình</span>
                      {avgScore
                        ? <span className="font-bold text-emerald-600">{avgScore}/10</span>
                        : <span className="text-muted-foreground text-xs italic">Chưa có điểm</span>}
                    </div>
                  </CardContent>
                </Card>

                {/* Pinned notes */}
                {notes.filter(n => n.is_pinned).length > 0 && (
                  <Card className="border-amber-200 dark:border-amber-800/50">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Pin className="h-4 w-4 text-amber-500" />
                        <CardTitle className="text-sm">Ghim quan trọng</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {notes.filter(n => n.is_pinned).map(note => (
                          <div
                            key={note.id}
                            onClick={() => setActiveTab("notes")}
                            className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200/50 dark:border-amber-800/30 cursor-pointer hover:shadow-sm transition-shadow"
                          >
                            <p className="text-sm font-semibold text-foreground">{note.title}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{note.content}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Zoom join button — only for online/hybrid */}
                {showZoom && (
                  <Button variant="gradient" className="w-full shadow-lg shadow-primary/20">
                    <Video className="h-4 w-4 mr-2" />Tham gia phòng học Online
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── Lectures ── */}
          {activeTab === "lectures" && (
            <div className="space-y-4">
              {lectures.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center text-muted-foreground">
                    <Presentation className="h-12 w-12 mx-auto opacity-20 mb-3" />
                    <p className="text-sm font-medium">Chưa có bài giảng nào</p>
                    <p className="text-xs mt-1">Giáo viên sẽ đăng tải bài giảng sớm.</p>
                  </CardContent>
                </Card>
              ) : (
                lectures.sort((a, b) => a.order - b.order).map((lec, i) => (
                  <Card
                    key={lec.id}
                    className={`overflow-hidden animate-fade-in transition-all ${!lec.is_published ? "opacity-60" : "hover:shadow-lg hover:border-primary/30"}`}
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <CardContent className="p-0">
                      <div className="flex flex-col sm:flex-row">
                        <div className={`sm:w-48 flex items-center justify-center p-6 ${lec.is_published ? "bg-primary/5" : "bg-muted/50"}`}>
                          <div className={`h-16 w-16 rounded-2xl flex items-center justify-center ${lec.is_published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {lec.is_published ? <PlayCircle className="h-8 w-8" /> : <Lock className="h-6 w-6" />}
                          </div>
                        </div>
                        <div className="flex-1 p-5 sm:p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={lec.is_published ? "info" : "outline"} className="text-[10px]">
                                  {lec.is_published ? `Bài ${lec.order}` : "Sắp ra mắt"}
                                </Badge>
                              </div>
                              <h3 className="font-semibold text-foreground text-base">{lec.title}</h3>
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{lec.description}</p>
                              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{lec.duration}</span>
                                {lec.is_published && <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{lec.views} lượt xem</span>}
                                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(lec.created_at)}</span>
                              </div>
                            </div>
                            {lec.is_published && (
                              <div className="flex flex-col gap-2 shrink-0">
                                <Button size="sm" variant="gradient"><PlayCircle className="h-3.5 w-3.5 mr-1.5" />Xem bài giảng</Button>
                                {lec.slides_url && <Button size="sm" variant="outline"><Download className="h-3.5 w-3.5 mr-1.5" />Tải slide</Button>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* ── Materials ── */}
          {activeTab === "materials" && (
            <>
              {materials.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto opacity-20 mb-3" />
                    <p className="text-sm font-medium">Chưa có tài liệu nào</p>
                    <p className="text-xs mt-1">Giáo viên sẽ đăng tải tài liệu sớm.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {materials.map((mat, i) => {
                    const cat = CATEGORY_MAP[mat.category] ?? { label: mat.category, color: "bg-muted text-muted-foreground" };
                    return (
                      <Card
                        key={mat.id}
                        className="group hover:shadow-lg hover:border-primary/30 transition-all animate-fade-in flex flex-col"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <CardContent className="p-5 flex-1 flex flex-col">
                          <div className="flex justify-between items-start mb-3">
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${mat.file_type === "pdf" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                              {getFileIcon(mat.file_type)}
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${cat.color}`}>{cat.label}</span>
                          </div>
                          <h3 className="font-semibold text-sm text-foreground line-clamp-2 mb-1.5 group-hover:text-primary transition-colors">{mat.title}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{mat.description}</p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-auto mb-3">
                            <span>{mat.file_size}</span>
                            <span>·</span>
                            <span className="flex items-center gap-1"><Download className="h-3 w-3" />{mat.download_count}</span>
                            <span>·</span>
                            <span>{formatDate(mat.created_at)}</span>
                          </div>
                          <div className="flex gap-2 pt-3 border-t border-border/50">
                            <Button size="sm" variant="outline" className="flex-1 text-xs h-8"><Eye className="h-3 w-3 mr-1.5" />Xem</Button>
                            <Button size="sm" variant="gradient" className="flex-1 text-xs h-8"><Download className="h-3 w-3 mr-1.5" />Tải về</Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Notes ── */}
          {activeTab === "notes" && (
            <div className="space-y-4">
              {notes.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center text-muted-foreground">
                    <StickyNote className="h-12 w-12 mx-auto opacity-20 mb-3" />
                    <p className="text-sm font-medium">Chưa có ghi chú nào</p>
                    <p className="text-xs mt-1">Giáo viên sẽ đăng tải thông tin sau các buổi học.</p>
                  </CardContent>
                </Card>
              ) : (
                notes
                  .sort((a, b) =>
                    (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) ||
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  )
                  .map((note, i) => (
                    <Card
                      key={note.id}
                      className={`animate-fade-in transition-all hover:shadow-md ${note.is_pinned ? "border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-900/5" : ""}`}
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <CardContent className="p-5 md:p-6">
                        <div className="flex items-start gap-4">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${note.is_pinned ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" : "bg-primary/10 text-primary"}`}>
                            {note.is_pinned ? <Pin className="h-4 w-4" /> : <StickyNote className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {note.is_pinned && <Badge variant="warning" className="text-[10px]">Đã ghim</Badge>}
                              <span className="text-xs text-muted-foreground">{formatDate(note.created_at)}</span>
                            </div>
                            <h3 className="font-semibold text-foreground">{note.title}</h3>
                            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line leading-relaxed">{note.content}</p>
                            {note.tags && note.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {note.tags.map(tag => (
                                  <span key={tag} className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                                    <Tag className="h-2.5 w-2.5" />{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
              )}
            </div>
          )}

        </div>
      </div>
    </PortalLayout>
  );
}
