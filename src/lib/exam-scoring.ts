// Thang điểm bài thi — nguồn chân lý DUY NHẤT cho cả server (exam-server.ts,
// dùng khi chấm lúc nộp) lẫn client (trang làm bài, chấm tay, editor).
// KHÔNG import gì thuộc server ở đây để cả hai phía dùng chung được.
import type { ExamQuestion } from "@/lib/storage";

// ── Hằng số thang điểm (chuẩn THPT 2025) ─────────────────────────────────────
// Đúng/Sai nhiều mệnh đề: tính theo SỐ mệnh đề trả lời đúng
//   1 ý = 0.1đ · 2 ý = 0.25đ · 3 ý = 0.5đ · 4 ý (trở lên) = 1.0đ
export const TRUE_FALSE_MAX = 1;
// Trả lời ngắn (điền đáp án): mỗi câu đúng 0.5đ
export const FILL_BLANK_SCORE = 0.5;

// Đề không chuẩn form: giáo viên đặt score_mode="custom" để tự quyết điểm câu.
// Đúng/Sai custom vẫn chấm thành phần theo TỈ LỆ khung chuẩn, nhân với điểm câu
// (VD câu 2đ: 1 ý = 0.2 · 2 ý = 0.5 · 3 ý = 1 · 4 ý = 2đ).
export type ScoreMode = "standard" | "custom";

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export type StudentAnswer = {
  selected_option?: number;
  selected_value?: string;
  essay_text?: string;
  essay_images?: string[];
  statement_answers?: Record<number, boolean>;
};

// Điểm Đúng/Sai theo số mệnh đề đúng.
export function trueFalsePartialScore(correctCount: number): number {
  if (correctCount >= 4) return 1;
  if (correctCount === 3) return 0.5;
  if (correctCount === 2) return 0.25;
  if (correctCount === 1) return 0.1;
  return 0;
}

// Số mệnh đề trả lời đúng của một câu Đúng/Sai.
export function countCorrectStatements(q: ExamQuestion, ans: StudentAnswer | undefined): number {
  if (!q.statements || q.statements.length === 0 || !ans?.statement_answers) return 0;
  return q.statements.reduce(
    (n, st, i) => n + (ans.statement_answers![i] === st.correct ? 1 : 0),
    0
  );
}

function fillBlankMatches(q: ExamQuestion, ans: StudentAnswer | undefined): boolean {
  return (ans?.selected_value ?? "").trim().toLowerCase()
    === (q.correct_value ?? "").trim().toLowerCase();
}

// Điểm tự động của MỘT câu (tự luận = 0, giáo viên chấm tay riêng).
export function autoQuestionScore(q: ExamQuestion, ans: StudentAnswer | undefined): number {
  if (!ans) return 0;
  switch (q.type) {
    case "multiple_choice":
      return ans.selected_option === q.correct_option ? q.score : 0;
    case "true_false":
      // Nhiều mệnh đề → điểm thành phần theo tỉ lệ khung, nhân điểm tối đa của câu
      // (chuẩn: max = 1 nên giữ nguyên khung; custom: scale theo điểm giáo viên đặt).
      if (q.statements && q.statements.length > 0)
        return round3(trueFalsePartialScore(countCorrectStatements(q, ans)) * (maxQuestionScore(q) / TRUE_FALSE_MAX));
      return ans.selected_value === q.correct_value ? q.score : 0;
    case "fill_blank":
      return fillBlankMatches(q, ans) ? maxQuestionScore(q) : 0;
    default: // essay
      return 0;
  }
}

// Cấu trúc tối thiểu để tính điểm tối đa (ExamQuestion lẫn ParsedQuestion editor).
type ScorableShape = {
  type: ExamQuestion["type"];
  score?: number;
  score_mode?: ScoreMode;
  statements?: unknown[];
};

// Điểm tối đa của MỘT câu — dùng cho thang điểm / "Tổng".
// Đúng/Sai & Trả lời ngắn: mặc định theo khung chuẩn; score_mode="custom" thì
// dùng điểm giáo viên tự đặt (q.score).
export function maxQuestionScore(q: ScorableShape): number {
  if (q.type === "true_false" && q.statements && q.statements.length > 0)
    return q.score_mode === "custom" ? (q.score ?? TRUE_FALSE_MAX) : TRUE_FALSE_MAX;
  if (q.type === "fill_blank")
    return q.score_mode === "custom" ? (q.score ?? FILL_BLANK_SCORE) : FILL_BLANK_SCORE;
  return q.score ?? 1;
}

// Tổng điểm tự động của cả bài (không gồm tự luận).
export function calcAutoScore(
  questions: ExamQuestion[],
  answers: Record<string, StudentAnswer>
): number {
  return round3(questions.reduce((total, q) => total + autoQuestionScore(q, answers[q.id]), 0));
}

// Tổng điểm tối đa của cả bài.
export function calcMaxScore(questions: ScorableShape[]): number {
  return round3(questions.reduce((total, q) => total + maxQuestionScore(q), 0));
}
