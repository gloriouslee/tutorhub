"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCurriculum, saveExamResult, getExamResult, type CurriculumLesson, type ExamQuestion } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import "katex/dist/katex.min.css";
import {
  Clock, CheckCircle2, XCircle, AlertTriangle, Check,
  ChevronLeft, Flag, RotateCcw, BookOpen, Circle,
  ChevronRight, LayoutGrid, X,
} from "lucide-react";
import { useStudentContext } from "@/hooks/useStudentContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type StudentAnswer = {
  selected_option?: number;
  selected_value?: string;
  essay_text?: string;
};

type ExamResult = {
  answers: Record<string, StudentAnswer>;
  score: number;
  total: number;
  submitted_at: string;
};

// Mark lesson as watched (for curriculum progress)
function markExamComplete(studentId: string, lessonId: string) {
  if (!studentId) return;
  try {
    const raw = localStorage.getItem(`tutorhub_watched_${studentId}`);
    const watched: string[] = raw ? JSON.parse(raw) : [];
    if (!watched.includes(lessonId)) {
      localStorage.setItem(`tutorhub_watched_${studentId}`, JSON.stringify([...watched, lessonId]));
    }
  } catch { /* ignore */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAnswered(ans: StudentAnswer | undefined): boolean {
  if (!ans) return false;
  return ans.selected_option !== undefined || !!ans.selected_value || !!ans.essay_text;
}

function RichContent({ html, className = "" }: { html: string; className?: string }) {
  return (
    <div
      className={`prose prose-sm dark:prose-invert max-w-none
        [&_p]:my-1 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:my-3
        [&_h3]:text-base [&_h3]:font-semibold [&_h3]:my-2
        [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
        [&_li]:my-0.5 [&_hr]:border-border [&_hr]:my-3
        [&_img]:max-w-full [&_img]:rounded-xl [&_img]:my-2
        [&_strong]:font-bold [&_em]:italic
        [&_.math-node]:inline-block
        ${className}`}
      dangerouslySetInnerHTML={{ __html: html || "" }}
    />
  );
}

function RawText({ html }: { html: string }) {
  return <span>{html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 60)}</span>;
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function useTimer(totalSeconds: number | null, onExpire: () => void) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const expiredRef = useRef(false);
  const cbRef = useRef(onExpire);
  cbRef.current = onExpire;

  useEffect(() => {
    if (!totalSeconds) return;
    setRemaining(totalSeconds);
    expiredRef.current = false;
    const id = setInterval(() => {
      setRemaining(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(id);
          if (!expiredRef.current) { expiredRef.current = true; cbRef.current(); }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [totalSeconds]);

  return remaining;
}

// ── Circular timer ────────────────────────────────────────────────────────────

function CircularTimer({ remaining, total }: { remaining: number | null; total: number | null }) {
  if (remaining === null || total === null) return null;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct  = remaining / total;
  const urgent = pct < 0.2;
  const warn   = pct < 0.5;

  // SVG circle
  const R  = 26;
  const C  = 2 * Math.PI * R;
  const dash = C * pct;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-16 w-16">
        <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
          {/* Track */}
          <circle cx="32" cy="32" r={R} fill="none"
            strokeWidth="5" className="stroke-muted" />
          {/* Progress */}
          <circle cx="32" cy="32" r={R} fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            stroke={urgent ? "#ef4444" : warn ? "#f59e0b" : "rgb(var(--primary))"}
            strokeDasharray={`${dash} ${C}`}
            style={{ transition: "stroke-dasharray 1s linear, stroke 0.5s" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Clock className={`h-3 w-3 mb-0.5 ${urgent ? "text-red-500 animate-pulse" : "text-muted-foreground"}`} />
          <span className={`font-mono text-[11px] font-bold leading-none ${urgent ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground">Thời gian</span>
    </div>
  );
}

// ── Progress panel (sidebar stat block) ──────────────────────────────────────

function ProgressPanel({
  questions, answers, current, setCurrent, timeLimit, remaining, onSubmit,
}: {
  questions: ExamQuestion[];
  answers: Record<string, StudentAnswer>;
  current: number;
  setCurrent: (i: number) => void;
  timeLimit: number | null;
  remaining: number | null;
  onSubmit: () => void;
}) {
  const total      = questions.length;
  const answered   = questions.filter(q => isAnswered(answers[q.id])).length;
  const unanswered = total - answered;
  const pct        = total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Timer */}
      {timeLimit !== null && (
        <div className="flex justify-center">
          <CircularTimer remaining={remaining} total={timeLimit} />
        </div>
      )}

      {/* Progress stats */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-muted-foreground">Tiến trình</span>
          <span className="text-primary font-semibold">{pct}%</span>
        </div>
        {/* Bar */}
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-2.5 text-center border border-emerald-100 dark:border-emerald-800/40">
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{answered}</div>
            <div className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70">Đã trả lời</div>
          </div>
          <div className={`rounded-xl p-2.5 text-center border ${unanswered > 0 ? "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/40" : "bg-muted/50 border-border"}`}>
            <div className={`text-lg font-bold ${unanswered > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>{unanswered}</div>
            <div className={`text-[10px] ${unanswered > 0 ? "text-amber-700/70 dark:text-amber-400/70" : "text-muted-foreground"}`}>Chưa làm</div>
          </div>
        </div>
      </div>

      {/* Question grid */}
      <div className="bg-card rounded-2xl border border-border p-3">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2 px-1">Danh sách câu</p>
        <div className="grid grid-cols-5 gap-1.5">
          {questions.map((q, i) => {
            const done = isAnswered(answers[q.id]);
            const active = i === current;
            return (
              <button
                key={q.id}
                onClick={() => setCurrent(i)}
                title={`Câu ${i + 1}`}
                className={`h-8 w-full rounded-lg text-xs font-semibold transition-all
                  ${active
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30 scale-105"
                    : done
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                    : "border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 mt-3 px-1">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary inline-block" />Đang làm
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400 inline-block" />Đã trả lời
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-sm border border-border inline-block" />Chưa làm
          </span>
        </div>
      </div>

      {/* Submit button */}
      <Button
        variant="gradient"
        className="w-full gap-2"
        onClick={onSubmit}
      >
        <Flag className="h-4 w-4" />
        Nộp bài ({answered}/{total})
      </Button>
    </div>
  );
}

// ── Answer input components ───────────────────────────────────────────────────

function MCOptions({ q, answer, onAnswer }: { q: ExamQuestion; answer: StudentAnswer; onAnswer: (a: StudentAnswer) => void }) {
  const OPTS = ["A", "B", "C", "D"];
  return (
    <div className="space-y-2.5 mt-5">
      {(q.options ?? []).map((opt, i) => {
        const selected = answer.selected_option === i;
        return (
          <button
            key={i}
            onClick={() => onAnswer({ selected_option: i })}
            className={`w-full flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all
              ${selected
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
              }`}
          >
            <span className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 transition-all
              ${selected ? "bg-primary text-primary-foreground scale-110" : "border-2 border-border text-muted-foreground"}`}>
              {OPTS[i]}
            </span>
            <RichContent html={opt} className="flex-1 pt-1" />
            {selected && <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-1" />}
          </button>
        );
      })}
    </div>
  );
}

function TFOptions({ answer, onAnswer }: { answer: StudentAnswer; onAnswer: (a: StudentAnswer) => void }) {
  return (
    <div className="flex gap-4 mt-5">
      {(["true", "false"] as const).map(v => (
        <button
          key={v}
          onClick={() => onAnswer({ selected_value: v })}
          className={`flex-1 py-6 rounded-2xl border-2 text-base font-semibold transition-all flex flex-col items-center gap-1
            ${answer.selected_value === v
              ? v === "true"
                ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 shadow-sm"
                : "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 shadow-sm"
              : "border-border bg-card hover:border-primary/50 text-muted-foreground hover:bg-muted/30"}`}
        >
          <span className="text-2xl">{v === "true" ? "✓" : "✗"}</span>
          <span>{v === "true" ? "Đúng" : "Sai"}</span>
        </button>
      ))}
    </div>
  );
}

function FillInput({ answer, onAnswer }: { answer: StudentAnswer; onAnswer: (a: StudentAnswer) => void }) {
  return (
    <div className="mt-5">
      <label className="text-sm text-muted-foreground mb-2 block">Điền câu trả lời:</label>
      <input
        value={answer.selected_value ?? ""}
        onChange={e => onAnswer({ selected_value: e.target.value })}
        placeholder="Nhập câu trả lời…"
        className="w-full h-12 px-4 rounded-2xl border-2 border-border bg-card text-foreground text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
      />
    </div>
  );
}

function EssayInput({ answer, onAnswer }: { answer: StudentAnswer; onAnswer: (a: StudentAnswer) => void }) {
  return (
    <div className="mt-5">
      <label className="text-sm text-muted-foreground mb-2 block">Bài làm của bạn:</label>
      <textarea
        value={answer.essay_text ?? ""}
        onChange={e => onAnswer({ essay_text: e.target.value })}
        rows={7}
        placeholder="Nhập bài làm…"
        className="w-full px-4 py-3 rounded-2xl border-2 border-border bg-card text-foreground text-sm resize-none outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
      />
    </div>
  );
}

// ── Result view ───────────────────────────────────────────────────────────────

function ResultView({ questions, result, onRetry, examTitle }: {
  questions: ExamQuestion[];
  result: ExamResult;
  onRetry: () => void;
  examTitle: string;
}) {
  const router = useRouter();
  const pct    = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
  const passed = pct >= 50;

  const isCorrect = (q: ExamQuestion, ans: StudentAnswer): boolean => {
    if (q.type === "multiple_choice") return ans.selected_option === q.correct_option;
    if (q.type === "true_false")      return ans.selected_value === q.correct_value;
    if (q.type === "fill_blank")      return (ans.selected_value ?? "").trim().toLowerCase() === (q.correct_value ?? "").trim().toLowerCase();
    return true;
  };

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const correctCount = questions.filter(q => isCorrect(q, result.answers[q.id] ?? {})).length;
  const wrongCount   = questions.filter(q => !isCorrect(q, result.answers[q.id] ?? {}) && q.type !== "essay").length;

  // Circular score arc
  const R = 54; const C = 2 * Math.PI * R;
  const dash = C * (pct / 100);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Kết quả bài thi</p>
            <p className="text-sm font-semibold text-foreground truncate">{examTitle}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        {/* Score hero */}
        <div className={`rounded-3xl p-8 text-center border-2 ${passed
          ? "border-emerald-200 bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-900/20 dark:to-transparent dark:border-emerald-800/50"
          : "border-red-200 bg-gradient-to-b from-red-50 to-white dark:from-red-900/20 dark:to-transparent dark:border-red-800/50"}`}>
          {/* Circular score */}
          <div className="relative h-36 w-36 mx-auto mb-4">
            <svg className="h-36 w-36 -rotate-90" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r={R} fill="none" strokeWidth="8" className="stroke-muted" />
              <circle cx="64" cy="64" r={R} fill="none" strokeWidth="8"
                strokeLinecap="round"
                stroke={passed ? "#10b981" : "#ef4444"}
                strokeDasharray={`${dash} ${C}`}
                style={{ transition: "stroke-dasharray 1.2s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold ${passed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {pct}%
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">
                {result.score}/{result.total} điểm
              </span>
            </div>
          </div>

          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-2 ${passed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
            {passed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {passed ? "Đạt yêu cầu" : "Chưa đạt"}
          </div>
          <p className="text-xs text-muted-foreground">
            Nộp lúc {new Date(result.submitted_at).toLocaleString("vi-VN")}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Đúng",  value: correctCount, cls: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/40" },
            { label: "Sai",   value: wrongCount,   cls: "text-red-500 dark:text-red-400",         bg: "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/40" },
            { label: "Tổng",  value: questions.length, cls: "text-foreground",                   bg: "bg-muted/50 border-border" },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 text-center ${s.bg}`}>
              <div className={`text-3xl font-bold ${s.cls}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Per-question */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Chi tiết từng câu</h3>
          <div className="space-y-2.5">
            {questions.map((q, idx) => {
              const ans     = result.answers[q.id] ?? {};
              const correct = isCorrect(q, ans);
              const open    = expanded.has(q.id);
              const OPTS    = ["A", "B", "C", "D"];

              return (
                <div key={q.id} className={`rounded-2xl border overflow-hidden ${correct ? "border-emerald-200 dark:border-emerald-800/50" : q.type === "essay" ? "border-amber-200 dark:border-amber-800/50" : "border-red-200 dark:border-red-800/50"}`}>
                  <button onClick={() => toggle(q.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
                    {correct ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                      : q.type === "essay" ? <BookOpen className="h-5 w-5 text-amber-500 shrink-0" />
                      : <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
                    <span className="text-xs font-semibold text-muted-foreground shrink-0 w-12">Câu {idx + 1}</span>
                    <span className="flex-1 text-sm font-medium text-foreground truncate"><RawText html={q.content_html} /></span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${correct ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : q.type === "essay" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                      {correct ? `+${q.score}đ` : q.type === "essay" ? "Tự luận" : "0đ"}
                    </span>
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-90" : ""}`} />
                  </button>

                  {open && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                      <RichContent html={q.content_html} />
                      {q.type === "multiple_choice" && (
                        <div className="space-y-2">
                          {(q.options ?? []).map((opt, i) => {
                            const isStudentPick = ans.selected_option === i;
                            const isCorrectOpt  = q.correct_option === i;
                            return (
                              <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-xl text-sm ${isCorrectOpt ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50" : isStudentPick ? "bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800/50" : "bg-muted/30"}`}>
                                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${isCorrectOpt ? "bg-emerald-500 text-white" : isStudentPick ? "bg-red-500 text-white" : "border border-border text-muted-foreground"}`}>{OPTS[i]}</span>
                                <RichContent html={opt} />
                                {isCorrectOpt && <span className="ml-auto text-[10px] font-semibold text-emerald-600 shrink-0">Đúng</span>}
                                {isStudentPick && !isCorrectOpt && <span className="ml-auto text-[10px] font-semibold text-red-500 shrink-0">Bạn chọn</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {q.type === "essay" && ans.essay_text && (
                        <div className="bg-muted/30 rounded-xl p-3">
                          <p className="text-xs text-muted-foreground mb-1">Bài làm của bạn:</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{ans.essay_text}</p>
                        </div>
                      )}
                      {q.type === "fill_blank" && (
                        <div className="space-y-1.5">
                          <div className={`px-3 py-2 rounded-xl text-sm border ${correct ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400" : "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400"}`}>
                            Bạn điền: <strong>{ans.selected_value || "(trống)"}</strong>
                          </div>
                          {!correct && <div className="px-3 py-2 rounded-xl text-sm bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400">
                            Đáp án đúng: <strong>{q.correct_value}</strong>
                          </div>}
                        </div>
                      )}
                      {q.explanation_html && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl p-3">
                          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1.5">💡 Giải thích</p>
                          <RichContent html={q.explanation_html} className="text-blue-900 dark:text-blue-200" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pb-8">
          <Button variant="outline" className="flex-1 gap-2" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" />Làm lại
          </Button>
          <Button variant="gradient" className="flex-1 gap-2" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4" />Quay lại lộ trình
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Score calculation ─────────────────────────────────────────────────────────

function calcScore(questions: ExamQuestion[], answers: Record<string, StudentAnswer>): number {
  return questions.reduce((total, q) => {
    const ans = answers[q.id];
    if (!ans) return total;
    let correct = false;
    if (q.type === "multiple_choice") correct = ans.selected_option === q.correct_option;
    else if (q.type === "true_false") correct = ans.selected_value === q.correct_value;
    else if (q.type === "fill_blank") correct = (ans.selected_value ?? "").trim().toLowerCase() === (q.correct_value ?? "").trim().toLowerCase();
    else if (q.type === "essay") correct = true;
    return total + (correct ? q.score : 0);
  }, 0);
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExamPage() {
  const params   = useParams();
  const classId  = params.classId as string;
  const lessonId = params.lessonId as string;
  const router   = useRouter();

  const { studentId, studentName } = useStudentContext();

  const [lesson,      setLesson]      = useState<CurriculumLesson | null>(null);
  const [questions,   setQuestions]   = useState<ExamQuestion[]>([]);
  const [answers,     setAnswers]     = useState<Record<string, StudentAnswer>>({});
  const [current,     setCurrent]     = useState(0);
  const [result,      setResult]      = useState<ExamResult | null>(null);
  const [submitted,   setSubmitted]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPanel,   setShowPanel]   = useState(false);
  const [examLocked,  setExamLocked]  = useState(false);
  const [lockReason,  setLockReason]  = useState("");

  useEffect(() => {
    const chapters = getCurriculum(classId);
    for (const ch of chapters)
      for (const sess of ch.sessions) {
        const found = sess.lessons.find(l => l.id === lessonId);
        if (found) {
          setLesson(found);
          setQuestions(found.exam_content?.questions ?? []);

          // Check access control
          const status = found.exam_status ?? "draft";
          const opensAt = found.exam_opens_at;
          if (status === "closed") {
            setExamLocked(true); setLockReason("Bài thi đã kết thúc.");
          } else if (status === "draft") {
            setExamLocked(true); setLockReason("Bài thi chưa được mở.");
          } else if (opensAt && new Date(opensAt) > new Date()) {
            setExamLocked(true);
            setLockReason(`Bài thi sẽ mở lúc ${new Date(opensAt).toLocaleString("vi-VN")}.`);
          }

          // Load previous result (scoped to this student)
          const prev = getExamResult(classId, lessonId, studentId || "anon");
          if (prev) { setResult(prev as unknown as ExamResult); setSubmitted(true); }
          return;
        }
      }
  }, [classId, lessonId, studentId]);

  const timeLimit = lesson?.exam_content?.time_limit
    ? lesson.exam_content.time_limit * 60
    : null;

  const handleTimeUp = useCallback(() => {
    if (!submitted) submit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const remaining = useTimer(submitted ? null : timeLimit, handleTimeUp);

  function setAnswer(questionId: string, ans: StudentAnswer) {
    setAnswers(prev => ({ ...prev, [questionId]: ans }));
  }

  function submit() {
    const score = calcScore(questions, answers);
    const total = questions.reduce((s, q) => s + q.score, 0);
    const submitted_at = new Date().toISOString();
    const res: ExamResult = { answers, score, total, submitted_at };
    const sid = studentId || "anon";
    saveExamResult(classId, lessonId, sid, studentName, { score, total, submitted_at, answers: answers as Record<string, unknown> });
    markExamComplete(sid, lessonId);
    setResult(res);
    setSubmitted(true);
    setShowConfirm(false);
  }

  function retry() {
    // Remove only this student's result
    const sid = studentId || "anon";
    localStorage.removeItem(`tutorhub_exam_result_${classId}_${lessonId}_${sid}`);
    setAnswers({});
    setResult(null);
    setSubmitted(false);
    setCurrent(0);
  }

  // ── States ──

  if (!lesson) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Đang tải đề thi…</p>
      </div>
    </div>
  );

  if (questions.length === 0) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 px-4">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
        <p className="text-base font-semibold text-foreground">Bài thi chưa có câu hỏi</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4 mr-1" />Quay lại
        </Button>
      </div>
    </div>
  );

  if (submitted && result) return (
    <ResultView questions={questions} result={result} onRetry={retry} examTitle={lesson.title} />
  );

  if (examLocked) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 px-4 max-w-sm">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
          <Clock className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-base font-semibold text-foreground">Bài thi chưa khả dụng</p>
        <p className="text-sm text-muted-foreground">{lockReason}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4 mr-1" />Quay lại
        </Button>
      </div>
    </div>
  );

  // ── Taking exam ──

  const q   = questions[current];
  const ans = answers[q.id] ?? {};
  const answeredCount = questions.filter(qq => isAnswered(answers[qq.id])).length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur-sm shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Đang làm bài thi</p>
            <p className="text-sm font-semibold text-foreground truncate">{lesson.title}</p>
          </div>

          {/* Mobile: timer compact */}
          {timeLimit && remaining !== null && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono text-sm font-semibold lg:hidden
              ${remaining / timeLimit < 0.2
                ? "border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400"
                : "border-border bg-muted/30 text-foreground"}`}>
              <Clock className={`h-3.5 w-3.5 ${remaining / timeLimit < 0.2 ? "animate-pulse" : ""}`} />
              {String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}
            </div>
          )}

          {/* Mobile: progress panel toggle */}
          <button
            onClick={() => setShowPanel(true)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="text-xs font-medium">{answeredCount}/{questions.length}</span>
          </button>

          <button
            onClick={() => setShowConfirm(true)}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <Flag className="h-3.5 w-3.5" />Nộp bài
          </button>
        </div>
      </div>

      {/* ── Body: two-column on desktop ── */}
      <div className="flex-1 flex overflow-hidden max-w-6xl w-full mx-auto">
        {/* ── Question area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Thin progress bar (answered %) */}
          <div className="h-1.5 bg-muted shrink-0">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
            />
          </div>

          {/* Question scroll area */}
          <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
            {/* Question meta */}
            <div className="flex items-center flex-wrap gap-2 mb-4">
              <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                Câu {current + 1} / {questions.length}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                {q.score} điểm
              </span>
              {q.difficulty && (
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  q.difficulty === "easy"   ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : q.difficulty === "hard" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                  {q.difficulty === "easy" ? "Dễ" : q.difficulty === "hard" ? "Khó" : "Trung bình"}
                </span>
              )}
              {q.tags?.map(tag => (
                <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">{tag}</span>
              ))}
              {isAnswered(answers[q.id]) && (
                <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />Đã trả lời
                </span>
              )}
            </div>

            {/* Question card */}
            <div className="bg-card rounded-3xl border border-border p-6 shadow-sm">
              <RichContent html={q.content_html} className="text-base" />
            </div>

            {/* Answer area */}
            {q.type === "multiple_choice" && <MCOptions q={q} answer={ans} onAnswer={a => setAnswer(q.id, a)} />}
            {q.type === "true_false"      && <TFOptions answer={ans} onAnswer={a => setAnswer(q.id, a)} />}
            {q.type === "fill_blank"      && <FillInput answer={ans} onAnswer={a => setAnswer(q.id, a)} />}
            {q.type === "essay"           && <EssayInput answer={ans} onAnswer={a => setAnswer(q.id, a)} />}
          </div>

          {/* ── Bottom navigation ── */}
          <div className="border-t border-border bg-card/90 backdrop-blur-sm shrink-0 px-4 py-3 lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setCurrent(c => c - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" />Câu trước
              </Button>

              {/* Progress dots (desktop) */}
              <div className="hidden md:flex items-center gap-1.5 flex-1 justify-center overflow-x-auto">
                {questions.map((qq, i) => {
                  const done   = isAnswered(answers[qq.id]);
                  const active = i === current;
                  return (
                    <button
                      key={qq.id}
                      onClick={() => setCurrent(i)}
                      className={`h-2 rounded-full transition-all ${active ? "w-6 bg-primary" : done ? "w-2 bg-emerald-400" : "w-2 bg-border"}`}
                    />
                  );
                })}
              </div>

              {current < questions.length - 1 ? (
                <Button variant="gradient" size="sm" onClick={() => setCurrent(c => c + 1)}>
                  Câu tiếp <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button variant="gradient" size="sm" onClick={() => setShowConfirm(true)}>
                  <Flag className="h-4 w-4 mr-1" />Nộp bài
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Desktop sidebar ── */}
        <aside className="hidden lg:flex flex-col w-72 shrink-0 border-l border-border bg-card/50 overflow-y-auto px-4 py-5">
          <ProgressPanel
            questions={questions}
            answers={answers}
            current={current}
            setCurrent={setCurrent}
            timeLimit={timeLimit}
            remaining={remaining}
            onSubmit={() => setShowConfirm(true)}
          />
        </aside>
      </div>

      {/* ── Mobile: sliding panel ── */}
      {showPanel && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setShowPanel(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-card border-l border-border overflow-y-auto p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-foreground">Tiến trình làm bài</span>
              <button onClick={() => setShowPanel(false)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ProgressPanel
              questions={questions}
              answers={answers}
              current={current}
              setCurrent={i => { setCurrent(i); setShowPanel(false); }}
              timeLimit={timeLimit}
              remaining={remaining}
              onSubmit={() => { setShowPanel(false); setShowConfirm(true); }}
            />
          </div>
        </div>
      )}

      {/* ── Submit confirm dialog ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm rounded-3xl border border-border shadow-xl p-6 space-y-4">
            <div className="text-center">
              <Flag className="h-10 w-10 text-primary mx-auto mb-3" />
              <h3 className="text-base font-semibold text-foreground">Nộp bài thi?</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Đã trả lời <strong className="text-foreground">{answeredCount}</strong> / {questions.length} câu.
              </p>
              {answeredCount < questions.length && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  Còn {questions.length - answeredCount} câu chưa làm.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>
                Tiếp tục làm
              </Button>
              <Button variant="gradient" className="flex-1" onClick={submit}>
                <Check className="h-4 w-4 mr-1" />Nộp bài
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
