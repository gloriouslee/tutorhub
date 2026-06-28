"use client";

import { useState, useEffect, useMemo } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { MOCK_STUDENTS, MOCK_HOMEWORK, MOCK_CLASSES } from "@/lib/mock-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search, CheckCircle2, Clock, FileText, ChevronDown, ChevronUp,
  Star, MessageSquare, BarChart2, Download, Image,
} from "lucide-react";
import {
  getSubmissionsByHomeworks,
  updateGrade as supabaseUpdateGrade,
  type SubmissionRecord,
} from "@/lib/supabase/submissions";

// ── Data types ────────────────────────────────────────────────────────────────
// Use SubmissionRecord from Supabase lib; extend with student_name for display
type Submission = SubmissionRecord & { student_name: string };

// ── localStorage helpers ──────────────────────────────────────────────────────
const SUBMISSION_KEY = "tutorhub_submissions";

const DEFAULT_SUBMISSIONS: Submission[] = [
  { id: "sub1", homework_id: "h1", student_id: "s1", student_name: "Nguyễn Anh Tuấn", status: "graded",    submitted_at: "2026-07-08T14:30:00Z", score: 9.2, feedback: "Em làm bài rất tốt! Lời giải rõ ràng, lập luận chặt chẽ. Chú ý thêm ở bài 2.14 tính toán sai dấu ở dòng cuối.", graded_at: "2026-07-09T10:00:00Z" },
  { id: "sub2", homework_id: "h1", student_id: "s2", student_name: "Trần Mai Phương",  status: "submitted", submitted_at: "2026-07-09T20:15:00Z" },
  { id: "sub3", homework_id: "h1", student_id: "s4", student_name: "Phạm Thảo My",     status: "submitted", submitted_at: "2026-07-08T22:00:00Z" },
  { id: "sub4", homework_id: "h4", student_id: "s1", student_name: "Nguyễn Anh Tuấn", status: "submitted", submitted_at: "2026-06-30T16:00:00Z" },
  { id: "sub5", homework_id: "h4", student_id: "s2", student_name: "Trần Mai Phương",  status: "graded",    submitted_at: "2026-06-29T21:30:00Z", score: 7.5, feedback: "Bài làm đạt yêu cầu. Cần đọc kỹ đề hơn.", graded_at: "2026-06-30T09:00:00Z" },
  { id: "sub6", homework_id: "h4", student_id: "s4", student_name: "Phạm Thảo My",     status: "submitted", submitted_at: "2026-06-30T09:00:00Z" },
];

function loadSubmissions(): Submission[] {
  try {
    const raw = localStorage.getItem(SUBMISSION_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_SUBMISSIONS;
  } catch { return DEFAULT_SUBMISSIONS; }
}

function saveSubmissions(subs: Submission[]) {
  localStorage.setItem(SUBMISSION_KEY, JSON.stringify(subs));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TEACHER_ID = "t1";
const myClassIds = MOCK_CLASSES.filter(c => c.tutor_id === TEACHER_ID).map(c => c.id);
const myHomework = MOCK_HOMEWORK.filter(h => myClassIds.includes(h.class_id));

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1)  return "Vừa nộp";
  if (h < 24) return `${h} giờ trước`;
  if (d <  7) return `${d} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

function scoreColor(score: number) {
  if (score >= 9) return "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400";
  if (score >= 7) return "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400";
  if (score >= 5) return "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400";
  return "text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400";
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TeacherSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [hwFilter,    setHwFilter]    = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "graded" | "ungraded">("all");
  const [search,      setSearch]      = useState("");
  const [grading,     setGrading]     = useState<string | null>(null); // submission id
  const [scoreInput,  setScoreInput]  = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");

  useEffect(() => {
    // Try Supabase first, fall back to localStorage seed
    getSubmissionsByHomeworks(myHomework.map(h => h.id)).then(remote => {
      if (remote.length > 0) {
        // Enrich with student_name from MOCK_STUDENTS for display
        const enriched = remote.map(s => ({
          ...s,
          student_name: s.student_name
            ?? MOCK_STUDENTS.find(st => st.id === s.student_id)?.full_name
            ?? s.student_id,
        })) as Submission[];
        setSubmissions(enriched);
      } else {
        setSubmissions(loadSubmissions());
      }
    });
  }, []);

  // Filtered list
  const displayed = useMemo(() => {
    return submissions.filter(s => {
      if (hwFilter !== "all" && s.homework_id !== hwFilter) return false;
      if (statusFilter === "graded"   && s.score == null) return false;
      if (statusFilter === "ungraded" && s.score != null) return false;
      if (search && !s.student_name.toLowerCase().includes(search.toLowerCase())) return false;
      // Only show teacher's homework
      if (!myHomework.find(h => h.id === s.homework_id)) return false;
      return true;
    }).sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
  }, [submissions, hwFilter, statusFilter, search]);

  // Stats
  const mySubmissions = submissions.filter(s => myHomework.find(h => h.id === s.homework_id));
  const gradedCount   = mySubmissions.filter(s => s.score != null).length;
  const ungradedCount = mySubmissions.length - gradedCount;
  const avgScore = gradedCount > 0
    ? (mySubmissions.filter(s => s.score != null).reduce((acc, s) => acc + s.score!, 0) / gradedCount).toFixed(1)
    : "—";

  function openGrading(sub: Submission) {
    setGrading(sub.id);
    setScoreInput(sub.score != null ? String(sub.score) : "");
    setFeedbackInput(sub.feedback ?? "");
  }

  async function handleSaveGrade(subId: string) {
    const score = parseFloat(scoreInput);
    if (isNaN(score) || score < 0 || score > 10) return;
    const feedback = feedbackInput.trim();

    // Optimistic UI update
    const updated = submissions.map(s =>
      s.id === subId
        ? { ...s, score, feedback: feedback || undefined, graded_at: new Date().toISOString() }
        : s
    );
    setSubmissions(updated);
    saveSubmissions(updated);
    setGrading(null);

    // Persist to Supabase (non-blocking; localStorage already saved)
    await supabaseUpdateGrade(subId, score, feedback);
  }

  const hwForSub = (sub: Submission) => myHomework.find(h => h.id === sub.homework_id);
  const classForHw = (classId: string) => MOCK_CLASSES.find(c => c.id === classId);

  return (
    <PortalLayout role="teacher" userName="Tiến sĩ Sarah Mitchell" pageTitle="Quản lý Bài nộp">
      <div className="space-y-6">
        <SectionHeader
          title="Chấm bài & Phản hồi"
          subtitle={`${ungradedCount > 0 ? `${ungradedCount} bài chưa chấm · ` : ""}Quản lý bài nộp của học viên`}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ── Main list ─────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm học viên..."
                  className="w-full pl-9 pr-3 h-9 text-sm rounded-xl border border-input bg-card outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {/* Status filter */}
              <div className="flex items-center gap-1.5 shrink-0">
                {(["all", "ungraded", "graded"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                      statusFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {{ all: "Tất cả", ungraded: "Chưa chấm", graded: "Đã chấm" }[f]}
                    {f === "ungraded" && ungradedCount > 0 && (
                      <span className="ml-1.5 bg-primary-foreground/20 text-[10px] font-bold px-1.5 rounded-full">{ungradedCount}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Homework filter tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setHwFilter("all")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${hwFilter === "all" ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-accent"}`}
              >
                Tất cả bài tập
              </button>
              {myHomework.map(hw => (
                <button
                  key={hw.id}
                  onClick={() => setHwFilter(hw.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all max-w-[180px] truncate ${hwFilter === hw.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                >
                  {hw.title}
                </button>
              ))}
            </div>

            {/* Submission cards */}
            {displayed.length === 0 ? (
              <div className="text-center py-14 border-2 border-dashed border-border/50 rounded-xl text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Không có bài nộp nào.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayed.map((sub, i) => {
                  const hw  = hwForSub(sub);
                  const cls = hw ? classForHw(hw.class_id) : null;
                  const isGraded  = sub.score != null;
                  const isGrading = grading === sub.id;

                  return (
                    <Card
                      key={sub.id}
                      className={`transition-all duration-200 animate-fade-in ${isGrading ? "ring-2 ring-primary/30" : "hover:border-primary/20"}`}
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <CardContent className="p-4 space-y-3">
                        {/* Homework label */}
                        {hwFilter === "all" && hw && (
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                            <FileText className="h-3.5 w-3.5 text-primary" />
                            {hw.title}
                            {cls && <span className="ml-1 px-1.5 py-0.5 bg-muted rounded text-[10px]">{cls.class_name}</span>}
                          </div>
                        )}

                        {/* Student row */}
                        <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                          <div className="flex items-center gap-3">
                            <Avatar size="sm">
                              <AvatarFallback>{sub.student_name[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{sub.student_name}</p>
                              <p className="text-xs text-muted-foreground">Nộp {relativeTime(sub.submitted_at)}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isGraded ? (
                              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold ${scoreColor(sub.score!)}`}>
                                <Star className="h-3.5 w-3.5" />
                                {sub.score!.toFixed(1)}/10
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                <Clock className="h-3.5 w-3.5 text-amber-500" />
                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Chưa chấm</span>
                              </div>
                            )}
                            <Button
                              size="sm"
                              variant={isGraded ? "outline" : "gradient"}
                              className="h-8 text-xs"
                              onClick={() => isGrading ? setGrading(null) : openGrading(sub)}
                            >
                              {isGrading
                                ? <><ChevronUp className="h-3.5 w-3.5 mr-1" />Đóng</>
                                : isGraded
                                  ? <><ChevronDown className="h-3.5 w-3.5 mr-1" />Sửa điểm</>
                                  : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Chấm bài</>
                              }
                            </Button>
                          </div>
                        </div>

                        {/* Submitted file */}
                        {sub.file_name && (
                          <div className="ml-11 flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border border-border/50">
                            {/\.(jpg|jpeg|png)$/i.test(sub.file_name)
                              ? <Image className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                              : <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                            <span className="truncate">{sub.file_name}</span>
                            {sub.file_url && (
                              <a
                                href={sub.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-auto shrink-0 p-1 rounded hover:bg-primary/10 text-primary transition-colors"
                                title="Tải xuống"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Existing feedback display */}
                        {isGraded && sub.feedback && !isGrading && (
                          <div className="ml-11 flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                            <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span className="leading-relaxed">{sub.feedback}</span>
                          </div>
                        )}

                        {/* Grading panel */}
                        {isGrading && (
                          <div className="ml-0 mt-1 border-t border-border pt-3 space-y-3 animate-fade-in">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="space-y-1 flex-1 min-w-[140px]">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Điểm số (0 – 10)
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={0} max={10} step={0.1}
                                    value={scoreInput}
                                    onChange={e => setScoreInput(e.target.value)}
                                    placeholder="VD: 8.5"
                                    className="w-24 h-10 text-center text-lg font-bold rounded-xl border border-input bg-card outline-none focus:ring-2 focus:ring-ring"
                                    autoFocus
                                  />
                                  <span className="text-sm text-muted-foreground">/10</span>
                                  {scoreInput && !isNaN(parseFloat(scoreInput)) && (
                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${scoreColor(parseFloat(scoreInput))}`}>
                                      {parseFloat(scoreInput) >= 9 ? "Xuất sắc" : parseFloat(scoreInput) >= 7 ? "Khá" : parseFloat(scoreInput) >= 5 ? "Trung bình" : "Yếu"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Nhận xét cho học viên
                              </label>
                              <textarea
                                value={feedbackInput}
                                onChange={e => setFeedbackInput(e.target.value)}
                                placeholder="Nhận xét về bài làm, điểm cần cải thiện..."
                                rows={3}
                                className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground"
                              />
                            </div>
                            <div className="flex items-center gap-2 justify-end">
                              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setGrading(null)}>
                                Huỷ
                              </Button>
                              <Button
                                size="sm" variant="gradient" className="h-8 text-xs"
                                onClick={() => handleSaveGrade(sub.id)}
                                disabled={!scoreInput || isNaN(parseFloat(scoreInput)) || parseFloat(scoreInput) < 0 || parseFloat(scoreInput) > 10}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                Lưu điểm
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Sidebar ───────────────────────────────────── */}
          <div className="space-y-4">

            {/* Stats */}
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" /> Tổng quan
                </h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{mySubmissions.length}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Bài nộp</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{gradedCount}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Đã chấm</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{ungradedCount}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Chưa chấm</p>
                  </div>
                </div>
                <div className="pt-1 border-t border-border/50 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Điểm TB</span>
                  <span className="font-bold text-foreground">{avgScore}{avgScore !== "—" ? "/10" : ""}</span>
                </div>
              </CardContent>
            </Card>

            {/* Per-homework progress */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Tiến độ chấm bài</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {myHomework.map(hw => {
                  const hwSubs    = submissions.filter(s => s.homework_id === hw.id);
                  const hwGraded  = hwSubs.filter(s => s.score != null).length;
                  const hwTotal   = hwSubs.length;
                  const pct       = hwTotal > 0 ? Math.round((hwGraded / hwTotal) * 100) : 0;
                  const cls       = classForHw(hw.class_id);
                  return (
                    <div key={hw.id} className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{hw.title}</p>
                          {cls && <p className="text-[10px] text-muted-foreground">{cls.class_name}</p>}
                        </div>
                        <span className="text-xs font-bold text-foreground shrink-0">{hwGraded}/{hwTotal}</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? "bg-emerald-500" : pct > 50 ? "bg-primary" : "bg-amber-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">Hạn: {new Date(hw.due_date).toLocaleDateString("vi-VN")}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
