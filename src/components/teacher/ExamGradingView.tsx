"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { gradeExamResult, type StoredExamResult, type ExamQuestion } from "@/lib/storage";
import { maxQuestionScore, calcMaxScore, autoQuestionScore, countCorrectStatements, type TrueFalseScale } from "@/lib/exam-scoring";
import { renderMathInHtml } from "@/lib/mathRender";
import "katex/dist/katex.min.css";
import {
  X, ChevronLeft, ChevronRight, Check, Loader2, Save,
  ClipboardCheck, Clock, PenSquare,
} from "lucide-react";

const OPTS = ["A", "B", "C", "D"];

type StudentAnswer = {
  selected_option?: number;
  selected_value?: string;
  essay_text?: string;
  essay_images?: string[];
  statement_answers?: Record<number, boolean>;
};

// null = essay (không tự chấm được)
function isCorrect(q: ExamQuestion, ans: StudentAnswer): boolean | null {
  if (q.type === "essay") return null;
  if (q.type === "multiple_choice") return ans.selected_option === q.correct_option;
  if (q.type === "true_false") {
    if (q.statements && q.statements.length > 0) {
      return q.statements.every((st, i) => ans.statement_answers?.[i] === st.correct);
    }
    return ans.selected_value === q.correct_value;
  }
  if (q.type === "fill_blank") {
    return String(ans.selected_value ?? "").trim().toLowerCase() === String(q.correct_value ?? "").trim().toLowerCase();
  }
  return null;
}

function essayQids(questions: ExamQuestion[]): string[] {
  return questions.filter(q => q.type === "essay").map(q => q.id);
}

function needsGrading(r: StoredExamResult, questions: ExamQuestion[]): boolean {
  const qids = essayQids(questions);
  if (qids.length === 0) return false;
  return qids.some(id => r.manual_scores?.[id] === undefined);
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fmtScore(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export default function ExamGradingView({
  classId,
  lessonId,
  examTitle,
  className,
  questions,
  initialResults,
  onClose,
  onResultsChange,
  scale,
}: {
  classId: string;
  lessonId: string;
  examTitle: string;
  className?: string; // tên lớp (hiển thị)
  questions: ExamQuestion[];
  initialResults: StoredExamResult[];
  onClose: () => void;
  onResultsChange?: (results: StoredExamResult[]) => void;
  scale?: TrueFalseScale;
}) {
  const [results, setResults] = useState<StoredExamResult[]>(initialResults);
  const [selectedId, setSelectedId] = useState<string | null>(initialResults[0]?.student_id ?? null);

  // Bản nháp chấm điểm của học sinh đang chọn
  const [draftScores, setDraftScores] = useState<Record<string, number>>(
    () => ({ ...(initialResults[0]?.manual_scores ?? {}) })
  );
  const [draftFeedback, setDraftFeedback] = useState<string>(initialResults[0]?.teacher_feedback ?? "");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const selected = results.find(r => r.student_id === selectedId) ?? null;
  const selectedIdx = results.findIndex(r => r.student_id === selectedId);
  const maxTotal = useMemo(() => calcMaxScore(questions), [questions]);

  function selectStudent(r: StoredExamResult) {
    setSelectedId(r.student_id);
    setDraftScores({ ...(r.manual_scores ?? {}) });
    setDraftFeedback(r.teacher_feedback ?? "");
    setSavedFlash(false);
  }

  function navigate(dir: 1 | -1) {
    const next = results[selectedIdx + dir];
    if (next) selectStudent(next);
  }

  // Tổng điểm hiện tại = điểm tự động (score đã tính lúc nộp) + điểm tự luận giáo viên chấm
  const manualSum = Object.values(draftScores).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const combinedTotal = (selected?.score ?? 0) + manualSum;

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await gradeExamResult(classId, lessonId, selected.student_id, {
        manual_scores: draftScores,
        teacher_feedback: draftFeedback.trim() || undefined,
      });
      // Cập nhật lạc quan trong danh sách bên trái
      const nextResults = results.map(r =>
        r.student_id === selected.student_id
          ? (updated ?? { ...r, manual_scores: { ...draftScores }, teacher_feedback: draftFeedback.trim() || undefined, graded_at: new Date().toISOString() })
          : r
      );
      setResults(nextResults);
      onResultsChange?.(nextResults);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  // Portal to <body>: tránh ancestor có transform làm hỏng position: fixed
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border shrink-0">
        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ClipboardCheck className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-foreground truncate">Chấm bài · {examTitle}</h2>
          <p className="text-xs text-muted-foreground truncate">
            {className ? `${className} · ` : ""}{results.length} bài nộp
          </p>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors" title="Đóng">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ── Sidebar: danh sách học sinh đã nộp ── */}
        <div className="w-[280px] shrink-0 border-r border-border overflow-y-auto p-3 space-y-1.5">
          {results.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-10 px-2">
              Chưa có học sinh nào nộp bài.
            </p>
          )}
          {results.map(r => {
            const pending = needsGrading(r, questions);
            const active = r.student_id === selectedId;
            return (
              <button
                key={r.student_id}
                onClick={() => selectStudent(r)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                  active ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-sm font-medium text-foreground truncate">{r.student_name || r.student_id}</p>
                  <span className="text-xs font-bold text-primary shrink-0">{fmtScore(r.score)}/{r.total}đ</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    pending
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  }`}>
                    {pending ? "Chưa chấm tự luận" : "Đã chấm"}
                  </span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />{fmtTime(r.submitted_at)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Main pane ── */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <PenSquare className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <h3 className="text-sm font-semibold text-foreground">Chưa có bài nộp</h3>
              <p className="text-xs text-muted-foreground mt-1">Khi học sinh nộp bài, bài làm sẽ hiển thị ở đây để chấm.</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-6 py-5 space-y-4">
              {/* Student header + navigation */}
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-foreground truncate">{selected.student_name || selected.student_id}</h3>
                  <p className="text-xs text-muted-foreground">
                    Nộp lúc {fmtTime(selected.submitted_at)}
                    {selected.graded_at && ` · Đã chấm lúc ${fmtTime(selected.graded_at)}`}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate(-1)} disabled={selectedIdx <= 0}>
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />Trước
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(1)} disabled={selectedIdx >= results.length - 1}>
                  Sau<ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>

              {/* Score summary */}
              <div className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-muted/30">
                <div className="flex-1">
                  <p className="text-2xl font-bold text-primary">{fmtScore(combinedTotal)}<span className="text-sm font-medium text-muted-foreground">/{maxTotal || selected.total}đ</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Trắc nghiệm tự động: {fmtScore(selected.score)}đ · Tự luận: {fmtScore(manualSum)}đ
                  </p>
                </div>
                {needsGrading({ ...selected, manual_scores: draftScores }, questions) && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
                    Còn câu tự luận chưa chấm
                  </span>
                )}
              </div>

              {/* Questions */}
              {questions.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Không tìm thấy câu hỏi (đề thi có thể đã bị sửa).</p>
              )}
              {questions.map((q, idx) => {
                const ans = (selected.answers as Record<string, StudentAnswer>)[q.id] ?? {};
                const correct = isCorrect(q, ans);
                const isEssay = q.type === "essay";
                const qMax    = maxQuestionScore(q);
                const qEarned = isEssay ? 0 : autoQuestionScore(q, ans, scale);
                const qPartial = !isEssay && qEarned > 0 && qEarned < qMax;

                return (
                  <div
                    key={q.id}
                    className={`rounded-2xl border p-4 space-y-2.5 ${
                      isEssay
                        ? "border-amber-200 dark:border-amber-800/50"
                        : correct
                          ? "border-emerald-200 dark:border-emerald-800/50"
                          : qPartial
                            ? "border-amber-200 dark:border-amber-800/50"
                            : "border-red-200 dark:border-red-800/50"
                    }`}
                  >
                    {/* Question */}
                    <div className="flex items-start gap-2.5">
                      <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                        isEssay ? "bg-amber-400 text-white" : correct ? "bg-emerald-500 text-white" : qPartial ? "bg-amber-400 text-white" : "bg-red-500 text-white"
                      }`}>
                        {isEssay ? "~" : correct ? "✓" : qPartial ? "±" : "✗"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">
                          Câu {idx + 1} · {qMax}đ
                          {!isEssay && <span className={`ml-1.5 font-bold ${correct ? "text-emerald-600 dark:text-emerald-400" : qPartial ? "text-amber-600 dark:text-amber-400" : "text-red-500 dark:text-red-400"}`}>(+{qEarned}đ)</span>}
                        </p>
                        <div
                          className="text-sm text-foreground leading-snug [&_p]:my-0.5 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-1"
                          dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.content_html) }}
                        />
                      </div>
                    </div>

                    {/* Multiple choice */}
                    {q.type === "multiple_choice" && (
                      <div className="space-y-1 pl-8">
                        {(q.options ?? []).map((opt, i) => {
                          const isStudentPick = ans.selected_option === i;
                          const isCorrectOpt = q.correct_option === i;
                          if (!isStudentPick && !isCorrectOpt) return null;
                          return (
                            <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                              isCorrectOpt
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                                : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                            }`}>
                              <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${isCorrectOpt ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>{OPTS[i]}</span>
                              <span className="flex-1 truncate [&_p]:inline [&_img]:hidden" dangerouslySetInnerHTML={{ __html: renderMathInHtml(opt) }} />
                              <span className="font-semibold shrink-0">
                                {isCorrectOpt && isStudentPick ? "HS chọn · Đáp án" : isCorrectOpt ? "Đáp án" : "HS chọn"}
                              </span>
                            </div>
                          );
                        })}
                        {ans.selected_option === undefined && (
                          <p className="text-xs text-muted-foreground italic pl-1">Chưa trả lời</p>
                        )}
                      </div>
                    )}

                    {/* True/false with statements */}
                    {q.type === "true_false" && (q.statements?.length ?? 0) > 0 && (
                      <div className="pl-8 space-y-1">
                        <p className="text-[11px] text-muted-foreground">
                          Đúng {countCorrectStatements(q, ans)}/{q.statements!.length} mệnh đề · +{qEarned}đ/{qMax}đ
                        </p>
                        {q.statements!.map((st, i) => {
                          const picked = ans.statement_answers?.[i];
                          const ok = picked === st.correct;
                          return (
                            <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                              ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                            }`}>
                              <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${ok ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
                                {String.fromCharCode(97 + i)}
                              </span>
                              <span className="flex-1" dangerouslySetInnerHTML={{
                                __html: renderMathInHtml(st.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")),
                              }} />
                              <span className="font-semibold shrink-0">
                                HS: {picked === undefined ? "—" : picked ? "Đ" : "S"}{!ok && ` · ĐA: ${st.correct ? "Đ" : "S"}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Legacy true/false */}
                    {q.type === "true_false" && !(q.statements?.length) && (
                      <div className="pl-8 flex gap-2 flex-wrap text-xs">
                        <span className={`px-2.5 py-1 rounded-lg ${
                          ans.selected_value === undefined
                            ? "bg-muted text-muted-foreground"
                            : correct
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                              : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                        }`}>
                          HS: {ans.selected_value === "true" ? "✓ Đúng" : ans.selected_value === "false" ? "✗ Sai" : "Chưa trả lời"}
                        </span>
                        {!correct && (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                            Đáp án: {q.correct_value === "true" ? "✓ Đúng" : "✗ Sai"}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Fill blank */}
                    {q.type === "fill_blank" && (
                      <div className="pl-8 flex gap-2 flex-wrap text-xs">
                        <span className={`px-2.5 py-1 rounded-lg ${
                          correct ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                        }`}>
                          HS: <strong>{String(ans.selected_value || "(trống)")}</strong>
                        </span>
                        {!correct && (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                            Đáp án: <strong>{q.correct_value}</strong>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Essay */}
                    {isEssay && (
                      <div className="pl-8 space-y-2.5">
                        {ans.essay_text?.trim() ? (
                          <div className="bg-muted/40 rounded-xl p-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                            {ans.essay_text}
                          </div>
                        ) : (
                          !(ans.essay_images?.length) && <p className="text-xs text-muted-foreground italic">Chưa trả lời</p>
                        )}
                        {(ans.essay_images?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {ans.essay_images!.map((url, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={i}
                                src={url}
                                alt={`Bài làm ${i + 1}`}
                                onClick={() => setImagePreview(url)}
                                className="h-28 w-auto rounded-xl border border-border object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                              />
                            ))}
                          </div>
                        )}
                        {/* Đáp án mẫu (nếu có) */}
                        {q.answer_html && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-primary hover:underline">Xem đáp án mẫu</summary>
                            <div
                              className="mt-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-sm text-foreground [&_p]:my-0.5 [&_img]:max-w-full [&_img]:rounded-lg"
                              dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.answer_html) }}
                            />
                          </details>
                        )}
                        {/* Score input */}
                        <div className="flex items-center gap-2 pt-1">
                          <label className="text-xs font-medium text-muted-foreground">Điểm:</label>
                          <input
                            type="number"
                            min={0}
                            max={q.score}
                            step={0.25}
                            value={draftScores[q.id] ?? ""}
                            onChange={e => {
                              const v = e.target.value;
                              setDraftScores(prev => {
                                const next = { ...prev };
                                if (v === "") { delete next[q.id]; return next; }
                                const n = Math.max(0, Math.min(q.score, Number(v)));
                                next[q.id] = n;
                                return next;
                              });
                            }}
                            placeholder="—"
                            className="w-20 h-8 rounded-xl border border-border bg-background px-2.5 text-sm text-center outline-none focus:ring-2 focus:ring-primary/40"
                          />
                          <span className="text-xs text-muted-foreground">/ {q.score}đ</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Feedback + save */}
              <div className="rounded-2xl border border-border p-4 space-y-3">
                <label className="text-xs font-medium text-muted-foreground block">Nhận xét chung</label>
                <textarea
                  rows={3}
                  value={draftFeedback}
                  onChange={e => setDraftFeedback(e.target.value)}
                  placeholder="Nhận xét về bài làm của học sinh..."
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/40"
                />
                <div className="flex items-center justify-end gap-2">
                  {savedFlash && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" />Đã lưu
                    </span>
                  )}
                  <Button variant="gradient" size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    Lưu chấm bài
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Image lightbox ── */}
      {imagePreview && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setImagePreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePreview} alt="Bài làm" className="max-h-full max-w-full rounded-xl object-contain" />
          <button className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
