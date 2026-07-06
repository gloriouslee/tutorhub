// ─────────────────────────────────────────────────────────────────────────────
// Parser đề thi từ văn bản thuần theo quy ước soạn đề (kiểu Azota):
//
//   Câu 1. <đề bài>                      ← "Câu N." hoặc "Câu N:" bắt đầu câu hỏi
//     A. <phương án>   B. <phương án>    ← Trắc nghiệm: A./B./C./D. (in hoa + dấu chấm)
//     *C. <phương án>                    ← dấu * trước chữ cái = đáp án đúng
//   Lời giải                             ← đề nằm TRÊN "Lời giải", giải thích nằm DƯỚI
//     <giải thích...>
//
//   Đúng sai: a) b) c) d) (chữ thường + dấu ngoặc), * trước mệnh đề đúng
//   Trả lời ngắn: sau "Lời giải" có dòng "Đáp án: <con số>"
//   Không khớp gì → tự luận
//
// Dòng "Phần ..." trước câu hỏi được coi là tiêu đề nhóm (bỏ qua khi chấm).
// ─────────────────────────────────────────────────────────────────────────────

import type { ExamQuestion } from "./storage";

export interface ParsedStatement { text: string; correct: boolean }

export interface ParsedQuestion {
  index: number;                      // số câu trong văn bản ("Câu 3." → 3)
  type: "multiple_choice" | "true_false" | "fill_blank" | "essay";
  content: string;                    // đề bài (text thuần)
  options?: string[];                 // trắc nghiệm A-D
  correctOption?: number;             // 0-based
  statements?: ParsedStatement[];     // đúng sai a-d
  shortAnswer?: string;               // trả lời ngắn
  solution?: string;                  // phần dưới "Lời giải"
  warnings: string[];                 // vấn đề phát hiện khi parse (thiếu *, thiếu đáp án...)
}

export interface ParseResult {
  questions: ParsedQuestion[];
  sections: string[];                 // các dòng "Phần ..." gặp được
  errors: string[];                   // lỗi mức toàn cục
}

const QUESTION_RE = /^\s*Câu\s+(\d+)\s*[.:]?\s*(.*)$/i;
const SECTION_RE  = /^\s*(Phần|PHẦN)\s+/;
const SOLUTION_RE = /^\s*(Lời\s*giải|LỜI\s*GIẢI)\s*[.:]?\s*$/i;
// "*A. text" | "A. text" — chữ HOA + dấu chấm (trắc nghiệm)
const MCQ_OPT_RE  = /(^|\s)(\*?)([A-D])\.\s+/g;
// "*a) text" | "a) text" — chữ thường + dấu ngoặc (đúng sai)
const TF_OPT_RE   = /(^|\s)(\*?)([a-d])\)\s+/g;
const SHORT_ANS_RE = /Đáp\s*án\s*[:：]\s*(.+)/i;

/** Tách các phương án nằm trên cùng một dòng hoặc nhiều dòng. */
function extractOptions(
  text: string,
  re: RegExp
): { before: string; opts: { letter: string; starred: boolean; text: string }[] } {
  const matches: { idx: number; len: number; letter: string; starred: boolean }[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push({
      idx: m.index + m[1].length,
      len: m[0].length - m[1].length,
      letter: m[3],
      starred: m[2] === "*",
    });
  }
  if (matches.length === 0) return { before: text, opts: [] };
  const before = text.slice(0, matches[0].idx).trim();
  const opts = matches.map((cur, i) => {
    const end = i + 1 < matches.length ? matches[i + 1].idx : text.length;
    return {
      letter: cur.letter,
      starred: cur.starred,
      text: text.slice(cur.idx + cur.len, end).trim().replace(/\s+/g, " "),
    };
  });
  return { before, opts };
}

function parseOneQuestion(index: number, body: string): ParsedQuestion {
  const warnings: string[] = [];

  // Tách đề / lời giải
  const lines = body.split("\n");
  let solutionAt = -1;
  for (let i = 0; i < lines.length; i++) {
    if (SOLUTION_RE.test(lines[i])) { solutionAt = i; break; }
  }
  const questionPart = (solutionAt >= 0 ? lines.slice(0, solutionAt) : lines).join("\n").trim();
  const solutionPart = solutionAt >= 0 ? lines.slice(solutionAt + 1).join("\n").trim() : "";

  // 1) Trắc nghiệm: A. B. C. D.
  const mcq = extractOptions(questionPart, MCQ_OPT_RE);
  if (mcq.opts.length >= 2) {
    const correctIdx = mcq.opts.findIndex(o => o.starred);
    if (correctIdx < 0) warnings.push("Trắc nghiệm nhưng chưa đánh dấu * đáp án đúng.");
    if (mcq.opts.filter(o => o.starred).length > 1) warnings.push("Có nhiều hơn 1 phương án đánh dấu *.");
    return {
      index, type: "multiple_choice",
      content: mcq.before,
      options: mcq.opts.map(o => o.text),
      correctOption: correctIdx >= 0 ? correctIdx : undefined,
      solution: solutionPart || undefined,
      warnings,
    };
  }

  // 2) Đúng sai: a) b) c) d)
  const tf = extractOptions(questionPart, TF_OPT_RE);
  if (tf.opts.length >= 2) {
    if (!tf.opts.some(o => o.starred)) warnings.push("Đúng sai nhưng chưa đánh dấu * mệnh đề đúng.");
    return {
      index, type: "true_false",
      content: tf.before,
      statements: tf.opts.map(o => ({ text: o.text, correct: o.starred })),
      solution: solutionPart || undefined,
      warnings,
    };
  }

  // 3) Trả lời ngắn: sau "Lời giải" có "Đáp án: <con số>"
  const shortMatch = solutionPart.match(SHORT_ANS_RE);
  if (shortMatch) {
    const answer = shortMatch[1].trim().split(/\s/)[0]; // lấy token đầu (con số)
    return {
      index, type: "fill_blank",
      content: questionPart,
      shortAnswer: answer,
      solution: solutionPart || undefined,
      warnings,
    };
  }

  // 4) Mặc định: tự luận
  return {
    index, type: "essay",
    content: questionPart,
    solution: solutionPart || undefined,
    warnings,
  };
}

export function parseExamText(raw: string): ParseResult {
  const text = raw.replace(/\r\n/g, "\n").replace(/ /g, " ");
  const lines = text.split("\n");

  const sections: string[] = [];
  const errors: string[] = [];
  // Gom các dòng thành block theo "Câu N."
  const blocks: { index: number; lines: string[] }[] = [];
  let current: { index: number; lines: string[] } | null = null;

  for (const line of lines) {
    const qm = line.match(QUESTION_RE);
    if (qm) {
      if (current) blocks.push(current);
      current = { index: parseInt(qm[1], 10), lines: [qm[2]] };
      continue;
    }
    if (!current) {
      if (SECTION_RE.test(line)) sections.push(line.trim());
      // các dòng khác trước "Câu 1" bỏ qua (tiêu đề, hướng dẫn)
      continue;
    }
    current.lines.push(line);
  }
  if (current) blocks.push(current);

  if (blocks.length === 0) {
    errors.push('Không tìm thấy câu hỏi nào. Mỗi câu phải bắt đầu bằng "Câu 1.", "Câu 2." …');
  }

  const questions = blocks.map(b => parseOneQuestion(b.index, b.lines.join("\n")));
  return { questions, sections, errors };
}

// ── Chuyển kết quả parse sang ExamQuestion của hệ thống ─────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Token ảnh theo quy ước: [img:<url>] — trên dòng riêng hoặc nằm giữa văn bản.
const IMG_TOKEN_RE = /\[img:([^\]\s]+)\]/g;

/** Chỉ cho phép http(s) và data:image — tránh javascript:, file:… */
function sanitizeImgUrl(url: string): string | null {
  return /^(https?:\/\/|data:image\/)/i.test(url) ? url : null;
}

/** Một dòng văn bản → HTML: escape text, [img:url] → <img>. */
function lineToHtml(line: string): string {
  IMG_TOKEN_RE.lastIndex = 0;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = IMG_TOKEN_RE.exec(line)) !== null) {
    out += esc(line.slice(last, m.index));
    const url = sanitizeImgUrl(m[1]);
    out += url
      ? `<img src="${esc(url).replace(/"/g, "&quot;")}" alt="hình" />`
      : esc(m[0]); // URL không hợp lệ → giữ nguyên dạng text
    last = m.index + m[0].length;
  }
  out += esc(line.slice(last));
  return out;
}

function toHtml(s: string): string {
  return s.split("\n").filter(l => l.trim()).map(l => `<p>${lineToHtml(l.trim())}</p>`).join("");
}

// ── Serializer: ParsedQuestion[] → văn bản theo quy ước ──────────────────────
// Cho phép sửa trực tiếp trên preview (bên trái) rồi ghi ngược lại textarea.

export function parsedToText(questions: ParsedQuestion[]): string {
  const blocks = questions.map((q, i) => {
    const lines: string[] = [`Câu ${i + 1}. ${q.content}`.trimEnd()];
    if (q.type === "multiple_choice" && q.options) {
      q.options.forEach((opt, j) => {
        const letter = String.fromCharCode(65 + j); // A, B, C, D
        lines.push(`${j === q.correctOption ? "*" : ""}${letter}. ${opt}`);
      });
    }
    if (q.type === "true_false" && q.statements) {
      q.statements.forEach((st, j) => {
        const letter = String.fromCharCode(97 + j); // a, b, c, d
        lines.push(`${st.correct ? "*" : ""}${letter}) ${st.text}`);
      });
    }
    const hasSolution = q.solution || q.type === "fill_blank";
    if (hasSolution) {
      lines.push("Lời giải");
      if (q.solution) {
        // Với trả lời ngắn, bỏ dòng "Đáp án:" cũ trong solution (sẽ ghi lại bên dưới)
        const sol = q.type === "fill_blank"
          ? q.solution.split("\n").filter(l => !SHORT_ANS_RE.test(l)).join("\n").trim()
          : q.solution;
        if (sol) lines.push(sol);
      }
      if (q.type === "fill_blank") lines.push(`Đáp án: ${q.shortAnswer ?? ""}`);
    }
    return lines.join("\n");
  });
  return blocks.join("\n\n");
}

export function parsedToExamQuestions(parsed: ParsedQuestion[]): ExamQuestion[] {
  return parsed.map((p, i) => {
    const base = {
      id: `q_${Date.now()}_${i}`,
      order: i,
      content_html: toHtml(p.content),
      explanation_html: p.solution ? toHtml(p.solution) : undefined,
      score: 1,
    };
    switch (p.type) {
      case "multiple_choice":
        return {
          ...base, type: "multiple_choice" as const,
          options: p.options ?? [],
          correct_option: p.correctOption ?? 0,
        };
      case "true_false":
        return {
          ...base, type: "true_false" as const,
          statements: p.statements,
        };
      case "fill_blank":
        return {
          ...base, type: "fill_blank" as const,
          correct_value: p.shortAnswer ?? "",
        };
      default:
        return {
          ...base, type: "essay" as const,
          answer_html: p.solution ? toHtml(p.solution) : undefined,
        };
    }
  });
}
