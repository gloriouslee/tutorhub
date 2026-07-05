"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader, ProgressBar } from "@/components/shared";
import { MOCK_EXAM_SCORES, MOCK_CLASSES, MOCK_TEACHERS } from "@/lib/mock-data";
import { GraduationCap, TrendingUp, Trophy, Target, BookOpen, ChevronDown, Pencil, Check, X } from "lucide-react";
import { useStudentContext } from "@/hooks/useStudentContext";
import { getExamScoresByStudent, type StoredExamScore } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Tooltip,
} from "recharts";

const DEFAULT_TARGET = 9.0;

// Vietnamese grade scale (score/10)
function gradeLabel(pct: number): { label: string; variant: "success" | "info" | "warning" | "default" | "destructive" } {
  if (pct >= 90) return { label: "Xuất sắc", variant: "success" };
  if (pct >= 80) return { label: "Giỏi",     variant: "info" };
  if (pct >= 65) return { label: "Khá",      variant: "default" };
  if (pct >= 50) return { label: "Trung bình", variant: "warning" };
  return            { label: "Yếu",       variant: "destructive" };
}

function letterGrade(avg: number): string {
  if (avg >= 9.5) return "A+";
  if (avg >= 9.0) return "A";
  if (avg >= 8.5) return "B+";
  if (avg >= 8.0) return "B";
  if (avg >= 7.0) return "C+";
  if (avg >= 6.5) return "C";
  return "D";
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StudentScoresPage() {
  const { studentId, studentName, myClasses } = useStudentContext();
  const gpaTarget_KEY = `tutorhub_gpa_target_${studentId}`;
  const [classFilter,  setClassFilter]  = useState<string>("all");
  const [showAll,      setShowAll]      = useState(false);
  const [gpaTarget,    setGpaTarget]    = useState(DEFAULT_TARGET);
  const [editingGoal,  setEditingGoal]  = useState(false);
  const [draftTarget,  setDraftTarget]  = useState(DEFAULT_TARGET);
  const [storedScores, setStoredScores] = useState<StoredExamScore[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(gpaTarget_KEY);
      if (saved) { const v = parseFloat(saved); if (!isNaN(v)) setGpaTarget(v); }
    } catch {}
    getExamScoresByStudent(studentId).then(setStoredScores);
  }, [studentId, gpaTarget_KEY]);

  function startEdit() {
    setDraftTarget(gpaTarget);
    setEditingGoal(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function confirmEdit() {
    const v = Math.min(10, Math.max(0, Math.round(draftTarget * 10) / 10));
    setGpaTarget(v);
    setEditingGoal(false);
    try { localStorage.setItem(gpaTarget_KEY, String(v)); } catch {}
  }

  function cancelEdit() { setEditingGoal(false); }

  // Merge mock scores (demo) + localStorage scores (real), deduplicated by id
  const allScores = useMemo(() => {
    const mockForStudent = MOCK_EXAM_SCORES.filter(s => s.student_id === studentId);
    const combined = [...mockForStudent, ...storedScores];
    const seen = new Set<string>();
    return combined
      .filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; })
      .sort((a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime());
  }, [studentId, storedScores]);


  // Filtered list
  const filtered = useMemo(
    () => classFilter === "all" ? allScores : allScores.filter(s => s.class_id === classFilter),
    [allScores, classFilter]
  );
  const displayed = showAll ? filtered : filtered.slice(0, 6);

  // Overall stats
  const avgScore = allScores.length
    ? Number((allScores.reduce((acc, s) => acc + s.score, 0) / allScores.length).toFixed(1))
    : 0;

  const highestScore = allScores.length ? Math.max(...allScores.map(s => s.score)) : 0;
  const lowestScore  = allScores.length ? Math.min(...allScores.map(s => s.score)) : 0;

  const gapToTarget = Math.max(0, gpaTarget - avgScore);

  // Radar: average per class → one data point per class
  const radarData = myClasses.map(cls => {
    const clsScores = allScores.filter(s => s.class_id === cls.id);
    const clsAvg    = clsScores.length
      ? Number((clsScores.reduce((a, s) => a + s.score, 0) / clsScores.length).toFixed(1))
      : 0;
    const teacher   = MOCK_TEACHERS.find(t => t.id === cls.tutor_id);
    return { subject: cls.subject.split(" ").slice(0, 2).join(" "), score: clsAvg, fullMark: 10, teacher: teacher?.full_name };
  });

  // Per-class breakdown for sidebar
  const classBreakdown = myClasses.map(cls => {
    const recs   = allScores.filter(s => s.class_id === cls.id);
    const avg    = recs.length ? Number((recs.reduce((a, s) => a + s.score, 0) / recs.length).toFixed(1)) : 0;
    const best   = recs.length ? Math.max(...recs.map(s => s.score)) : 0;
    const teacher = MOCK_TEACHERS.find(t => t.id === cls.tutor_id);
    return { cls, recs: recs.length, avg, best, teacher };
  });

  const grade = letterGrade(avgScore);

  return (
    <PortalLayout role="student" userName={studentName} pageTitle="Kết quả học tập">
      <div className="space-y-6 max-w-6xl mx-auto">
        <SectionHeader
          title="Bảng điểm cá nhân"
          subtitle="Theo dõi thành tích và đánh giá năng lực qua các kỳ thi"
        />

        {/* ── Summary cards ────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Average */}
          <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-0 shadow-lg animate-fade-in">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-4">
                <p className="text-white/80 font-medium text-sm">Điểm Trung Bình</p>
                <div className="p-2 bg-white/20 rounded-lg"><Trophy className="h-4 w-4" /></div>
              </div>
              <h2 className="text-4xl font-black">{avgScore}<span className="text-xl text-white/70 font-normal">/10</span></h2>
              <p className="text-xs text-emerald-300 mt-2 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Cao nhất: <strong className="ml-1">{highestScore}</strong>&nbsp;·&nbsp;Thấp nhất: <strong>{lowestScore}</strong>
              </p>
            </CardContent>
          </Card>

          {/* Total exams */}
          <Card className="animate-fade-in" style={{ animationDelay: "80ms" }}>
            <CardContent className="p-5 h-full flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <p className="text-muted-foreground font-medium text-sm">Tổng bài thi</p>
                <div className="p-2 bg-primary/10 text-primary rounded-lg"><BookOpen className="h-4 w-4" /></div>
              </div>
              <h2 className="text-4xl font-bold">{allScores.length}</h2>
              <p className="text-xs text-muted-foreground mt-2">
                Trải dài {myClasses.length} lớp học
              </p>
            </CardContent>
          </Card>

          {/* GPA target */}
          <Card className="lg:col-span-2 animate-fade-in" style={{ animationDelay: "160ms" }}>
            <CardContent className="p-0 h-full flex items-center">
              <div className="flex-1 p-5 border-r border-border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-amber-500" /> Mục tiêu GPA
                  </h3>
                  {!editingGoal ? (
                    <button
                      onClick={startEdit}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-muted"
                    >
                      <Pencil className="h-3 w-3" /> Chỉnh sửa
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button onClick={confirmEdit} className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={cancelEdit} className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {editingGoal ? (
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      ref={inputRef}
                      type="number"
                      min={0} max={10} step={0.1}
                      value={draftTarget}
                      onChange={e => setDraftTarget(parseFloat(e.target.value) || 0)}
                      onKeyDown={e => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") cancelEdit(); }}
                      className="w-24 h-9 rounded-lg border border-primary bg-background text-center text-lg font-bold text-primary outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <span className="text-sm text-muted-foreground">/ 10</span>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-foreground mb-3">
                    {avgScore}<span className="text-sm text-muted-foreground font-normal"> / {gpaTarget}</span>
                  </p>
                )}

                <ProgressBar value={Math.min(100, (avgScore / gpaTarget) * 100)} size="sm" color={avgScore >= gpaTarget ? "bg-emerald-500" : "bg-amber-500"} />
                <p className="text-[11px] text-muted-foreground mt-2">
                  {gapToTarget > 0
                    ? `Còn thiếu ${gapToTarget.toFixed(1)} điểm để đạt mục tiêu.`
                    : "Đã đạt mục tiêu GPA! Xuất sắc."}
                </p>
              </div>
              <div className="w-1/3 p-4 flex justify-center">
                <div className="h-20 w-20 rounded-full border-4 border-primary/20 flex items-center justify-center relative">
                  <span className="text-xl font-black text-primary">{grade}</span>
                  <div className="absolute inset-[-4px] border-4 border-primary rounded-full border-t-transparent border-l-transparent rotate-45" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Score list ───────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="font-bold text-lg">Chi tiết điểm thi</h3>
              {/* Class filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setClassFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${classFilter === "all" ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  Tất cả ({allScores.length})
                </button>
                {myClasses.map(cls => {
                  const cnt = allScores.filter(s => s.class_id === cls.id).length;
                  return (
                    <button
                      key={cls.id}
                      onClick={() => setClassFilter(cls.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${classFilter === cls.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                    >
                      {cls.subject.split(" ").slice(0, 2).join(" ")} ({cnt})
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 p-4 border-b border-border bg-muted/30 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                <div className="col-span-5">Bài thi</div>
                <div className="col-span-3 text-center">Ngày thi</div>
                <div className="col-span-2 text-center">Điểm</div>
                <div className="col-span-2 text-right">Xếp loại</div>
              </div>

              {filtered.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">
                  <GraduationCap className="h-10 w-10 mx-auto opacity-20 mb-3" />
                  <p className="text-sm">Không có dữ liệu</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {displayed.map((score, i) => {
                    const cls = MOCK_CLASSES.find(c => c.id === score.class_id);
                    const pct = (score.score / score.max_score) * 100;
                    const { label, variant } = gradeLabel(pct);

                    return (
                      <div
                        key={score.id}
                        className="grid grid-cols-12 gap-2 p-4 items-center hover:bg-muted/20 transition-colors animate-fade-in"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <div className="col-span-5 flex items-center gap-3 min-w-0">
                          <div
                            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-white"
                            style={{ background: cls?.color ?? "var(--primary)" }}
                          >
                            <GraduationCap className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">{score.exam_name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{cls?.class_name ?? "Lớp học"}</p>
                          </div>
                        </div>
                        <div className="col-span-3 text-center text-xs text-muted-foreground">
                          {formatDate(score.exam_date)}
                        </div>
                        <div className="col-span-2 text-center">
                          <span className={`font-bold text-base ${pct >= 90 ? "text-emerald-600 dark:text-emerald-400" : pct >= 80 ? "text-blue-600 dark:text-blue-400" : pct >= 65 ? "text-foreground" : "text-amber-600 dark:text-amber-400"}`}>
                            {score.score}
                          </span>
                          <span className="text-xs text-muted-foreground">/{score.max_score}</span>
                        </div>
                        <div className="col-span-2 text-right">
                          <Badge variant={variant} className="text-[10px] font-semibold">{label}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {filtered.length > 6 && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm text-muted-foreground hover:text-primary transition-colors border border-border/60 rounded-xl bg-card hover:border-primary/30"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
                {showAll ? "Thu gọn" : `Xem thêm ${filtered.length - 6} bài thi`}
              </button>
            )}
          </div>

          {/* ── Sidebar ──────────────────────────────────── */}
          <div className="space-y-4">

            {/* Radar chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Phân tích theo lớp</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                {radarData.length >= 3 ? (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 500 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                          itemStyle={{ color: "hsl(var(--primary))", fontWeight: "bold" }}
                          formatter={(v: any) => [`${v}/10`, "Điểm TB"]}
                        />
                        <Radar name="Điểm TB" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  /* Bar-style fallback for < 3 subjects */
                  <div className="space-y-4 py-2 px-3">
                    {radarData.map(d => (
                      <div key={d.subject} className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-foreground">{d.subject}</span>
                          <span className="font-bold text-primary">{d.score}/10</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${(d.score / 10) * 100}%` }}
                          />
                        </div>
                        {d.teacher && <p className="text-[11px] text-muted-foreground">{d.teacher}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Per-class breakdown */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" /> Theo từng lớp
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {classBreakdown.map(({ cls, recs, avg, best, teacher }) => {
                  const { label } = gradeLabel((avg / 10) * 100);
                  return (
                    <div key={cls.id} className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{cls.subject}</p>
                          {teacher && <p className="text-[11px] text-muted-foreground">{teacher.full_name}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-primary">{avg}/10</p>
                          <p className="text-[11px] text-muted-foreground">{label}</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(avg / 10) * 100}%` }} />
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{recs} bài thi</span>
                        <span>Cao nhất: <strong className="text-foreground">{best}</strong></span>
                      </div>
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
