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
// Trắc nghiệm một đáp án: điểm mặc định mỗi câu khi giáo viên không tự đặt.
export const MC_DEFAULT_SCORE = 0.25;

// Thang điểm Đúng/Sai: % điểm câu theo SỐ mệnh đề trả lời đúng (1/2/3/4 ý).
// Có thể tùy chỉnh & lưu theo từng đề (ExamContent.true_false_scale); nếu không
// cấu hình thì dùng khung chuẩn THPT bên dưới.
export type TrueFalseScale = { one: number; two: number; three: number; four: number };
export const DEFAULT_TF_SCALE: TrueFalseScale = { one: 10, two: 25, three: 50, four: 100 };

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

// Tỉ lệ (0..1) điểm câu Đúng/Sai theo số mệnh đề đúng, theo thang cấu hình.
export function trueFalseFraction(correctCount: number, scale: TrueFalseScale = DEFAULT_TF_SCALE): number {
  const pct =
    correctCount >= 4 ? scale.four :
    correctCount === 3 ? scale.three :
    correctCount === 2 ? scale.two :
    correctCount === 1 ? scale.one : 0;
  return pct / 100;
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
export function autoQuestionScore(
  q: ExamQuestion,
  ans: StudentAnswer | undefined,
  scale: TrueFalseScale = DEFAULT_TF_SCALE,
): number {
  if (!ans) return 0;
  switch (q.type) {
    case "multiple_choice":
      return ans.selected_option === q.correct_option ? q.score : 0;
    case "true_false":
      // Nhiều mệnh đề → điểm thành phần theo tỉ lệ thang cấu hình, nhân điểm tối đa của câu.
      if (q.statements && q.statements.length > 0)
        return round3(trueFalseFraction(countCorrectStatements(q, ans), scale) * maxQuestionScore(q));
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
  if (q.type === "multiple_choice") return q.score ?? MC_DEFAULT_SCORE;
  return q.score ?? 1; // tự luận
}

// Tổng điểm tự động của cả bài (không gồm tự luận).
export function calcAutoScore(
  questions: ExamQuestion[],
  answers: Record<string, StudentAnswer>,
  scale: TrueFalseScale = DEFAULT_TF_SCALE,
): number {
  return round3(questions.reduce((total, q) => total + autoQuestionScore(q, answers[q.id], scale), 0));
}

// Tổng điểm tối đa của cả bài.
export function calcMaxScore(questions: ScorableShape[]): number {
  return round3(questions.reduce((total, q) => total + maxQuestionScore(q), 0));
}
