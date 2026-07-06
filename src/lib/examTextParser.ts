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
  // Vị trí tiêu đề phần: đứng trước câu hỏi thứ index (0-based) — để serialize lại đúng chỗ
  sectionsAt: { index: number; text: string }[];
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
  const sectionsAt: { index: number; text: string }[] = [];
  const errors: string[] = [];
  // Gom các dòng thành block theo "Câu N."
  const blocks: { index: number; lines: string[] }[] = [];
  let current: { index: number; lines: string[] } | null = null;

  for (const line of lines) {
    // "Phần ..." ở bất kỳ đâu = ranh giới nhóm: đóng câu hiện tại,
    // không để tiêu đề phần lọt vào lời giải câu trước
    if (SECTION_RE.test(line)) {
      if (current) { blocks.push(current); current = null; }
      sections.push(line.trim());
      sectionsAt.push({ index: blocks.length, text: line.trim() });
      continue;
    }
    const qm = line.match(QUESTION_RE);
    if (qm) {
      if (current) blocks.push(current);
      current = { index: parseInt(qm[1], 10), lines: [qm[2]] };
      continue;
    }
    if (!current) {
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
  return { questions, sections, sectionsAt, errors };
}

// ── Chuyển kết quả parse sang ExamQuestion của hệ thống ─────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Registry tài nguyên (kiểu Azota) ─────────────────────────────────────────
// Văn bản thô giữ token ngắn [m:N] (công thức) / [img:N] (ảnh); nội dung đầy đủ
// (LaTeX dài, URL dài) nằm trong registry — chỉ tồn tại lúc soạn thảo.
// Token là văn bản thuần nên parser/serializer không cần biết đến registry.

export type ExamAssetRegistry = Record<
  string,
  { kind: "math"; tex: string } | { kind: "img"; url: string }
>;

// Token tổng quát: [m:<id>] hoặc [img:<id|url>]
const ANY_TOKEN_RE = /\[(m|img):([^\]\s]+)\]/g;
// Token công thức registry (id là số)
export const MATH_TOKEN_RE = /\[m:(\d+)\]/g;

/** Chỉ cho phép http(s) và data:image — tránh javascript:, file:… */
function sanitizeImgUrl(url: string): string | null {
  return /^(https?:\/\/|data:image\/)/i.test(url) ? url : null;
}

function imgTag(url: string): string {
  return `<img src="${esc(url).replace(/"/g, "&quot;")}" alt="hình" />`;
}

/**
 * Một dòng văn bản → HTML: escape text, [img:url] → <img>.
 * Với registry: [m:N] → $tex$ (mathRender sẽ dựng KaTeX), [img:N] → <img src=url>.
 * Token không tra được → giữ nguyên dạng text hiển thị.
 */
function lineToHtml(line: string, registry?: ExamAssetRegistry): string {
  ANY_TOKEN_RE.lastIndex = 0;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = ANY_TOKEN_RE.exec(line)) !== null) {
    out += esc(line.slice(last, m.index));
    const [tok, kind, id] = m;
    const entry = registry?.[id];
    if (kind === "m") {
      out += entry?.kind === "math" ? esc(`$${entry.tex}$`) : esc(tok);
    } else {
      const url = entry?.kind === "img" ? entry.url : sanitizeImgUrl(id);
      out += url ? imgTag(url) : esc(tok);
    }
    last = m.index + tok.length;
  }
  out += esc(line.slice(last));
  return out;
}

function toHtml(s: string, registry?: ExamAssetRegistry): string {
  return s.split("\n").filter(l => l.trim()).map(l => `<p>${lineToHtml(l.trim(), registry)}</p>`).join("");
}

/**
 * Thay token registry trong TEXT THUẦN: [m:N] → $tex$;
 * [img:N] → [img:url] (imgMode "token") hoặc thẻ <img> (imgMode "html").
 * Token không tra được giữ nguyên. Dùng cho options/statements & preview.
 */
export function resolveRegistryTokens(
  text: string,
  registry?: ExamAssetRegistry,
  imgMode: "token" | "html" = "token"
): string {
  if (!registry) return text;
  return text.replace(ANY_TOKEN_RE, (tok, kind: string, id: string) => {
    const entry = registry[id];
    if (kind === "m") return entry?.kind === "math" ? `$${entry.tex}$` : tok;
    if (entry?.kind === "img") return imgMode === "html" ? imgTag(entry.url) : `[img:${entry.url}]`;
    return tok;
  });
}

/** Độ dài LaTeX tối đa vẫn giữ inline khi token hoá (công thức ngắn dễ đọc). */
const INLINE_TEX_MAX = 12;

/**
 * Token hoá văn bản quy ước (thường là kết quả import Word):
 * mọi $LaTeX$ dài hơn INLINE_TEX_MAX ký tự → [m:N], mọi [img:http(s)/data-url] → [img:N],
 * nội dung đầy đủ đưa vào registry với id tuần tự.
 */
export function tokenizeConventionText(raw: string): { text: string; registry: ExamAssetRegistry } {
  const registry: ExamAssetRegistry = {};
  let n = 0;
  let text = raw.replace(/\$([^$\n]+)\$/g, (m0, tex: string) => {
    const t = tex.trim();
    if (t.length <= INLINE_TEX_MAX) return m0;
    n += 1;
    registry[String(n)] = { kind: "math", tex: t };
    return `[m:${n}]`;
  });
  text = text.replace(/\[img:([^\]\s]+)\]/g, (m0, url: string) => {
    if (!sanitizeImgUrl(url)) return m0; // đã là id hoặc không hợp lệ → giữ nguyên
    n += 1;
    registry[String(n)] = { kind: "img", url };
    return `[img:${n}]`;
  });
  return { text, registry };
}

// ── Serializer: ParsedQuestion[] → văn bản theo quy ước ──────────────────────
// Cho phép sửa trực tiếp trên preview (bên trái) rồi ghi ngược lại textarea.

export function parsedToText(
  questions: ParsedQuestion[],
  sectionsAt?: { index: number; text: string }[]
): string {
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
  // Chèn lại tiêu đề phần đúng vị trí (trước câu hỏi thứ index)
  if (sectionsAt?.length) {
    const out: string[] = [];
    for (let i = 0; i < blocks.length; i++) {
      sectionsAt.filter(s => s.index === i).forEach(s => out.push(s.text));
      out.push(blocks[i]);
    }
    sectionsAt.filter(s => s.index >= blocks.length).forEach(s => out.push(s.text));
    return out.join("\n\n");
  }
  return blocks.join("\n\n");
}

/**
 * Chuẩn hoá văn bản quy ước: parse rồi serialize lại theo cấu trúc chuẩn —
 * mỗi phương án một dòng, đánh số câu liên tục, tiêu đề phần đúng vị trí.
 * Nếu parse lỗi hoặc không có câu nào, trả nguyên văn bản gốc.
 */
export function normalizeConventionText(raw: string): string {
  const r = parseExamText(raw);
  if (r.errors.length > 0 || r.questions.length === 0) return raw;
  return parsedToText(r.questions, r.sectionsAt);
}

// ── Reverse converter: ExamQuestion[] → ParsedQuestion[] (để sửa lại đề đã lưu) ──

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * HTML đã lưu (content_html/explanation_html/options) → text quy ước:
 * <p>/<br> → xuống dòng, <img src=URL> → [img:URL], bỏ thẻ khác, decode entity.
 * $...$ vốn là text nên tự sống sót.
 */
export function htmlToConventionText(html: string): string {
  if (!html) return "";
  let s = html
    // <img …src="URL"…> → [img:URL] (src có thể đứng ở bất kỳ vị trí attribute nào)
    .replace(/<img\b[^>]*\bsrc\s*=\s*"([^"]*)"[^>]*>/gi, (_, url: string) => `[img:${decodeEntities(url)}]`)
    .replace(/<img\b[^>]*\bsrc\s*=\s*'([^']*)'[^>]*>/gi, (_, url: string) => `[img:${decodeEntities(url)}]`)
    // Ranh giới block → xuống dòng
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    // Bỏ mọi thẻ còn lại
    .replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  // Gọn khoảng trắng: trim từng dòng, bỏ dòng trống thừa
  return s
    .split("\n")
    .map(l => l.replace(/\s+/g, " ").trim())
    .filter(l => l.length > 0)
    .join("\n");
}

/** Như htmlToConventionText nhưng ép về một dòng (dùng cho phương án/mệnh đề). */
function htmlToInlineText(html: string): string {
  return htmlToConventionText(html).replace(/\n+/g, " ").trim();
}

/**
 * ExamQuestion[] đã lưu → dạng ParsedQuestion[] có thể sửa tiếp + registry
 * (công thức dài / ảnh được token hoá qua tokenizeConventionText).
 */
export function examQuestionsToParsed(questions: ExamQuestion[]): { parsed: ParsedQuestion[]; registry: ExamAssetRegistry } {
  const { text, registry } = examQuestionsToText(questions);
  return { parsed: parseExamText(text).questions, registry };
}

/**
 * ExamQuestion[] đã lưu → văn bản quy ước + registry token [m:N]/[img:N].
 * Dùng khi mở lại đề đã lưu trong trình soạn văn bản.
 */
export function examQuestionsToText(questions: ExamQuestion[]): { text: string; registry: ExamAssetRegistry } {
  const parsed: ParsedQuestion[] = questions.map((q, i) => {
    const content = htmlToConventionText(q.content_html);
    const solution = htmlToConventionText(q.explanation_html ?? "") || undefined;
    const base = { index: i + 1, content, solution, warnings: [] as string[] };

    switch (q.type) {
      case "multiple_choice":
        return {
          ...base, type: "multiple_choice" as const,
          options: (q.options ?? []).map(htmlToInlineText),
          correctOption: q.correct_option ?? 0,
        };
      case "true_false":
        if (q.statements && q.statements.length > 0) {
          return { ...base, type: "true_false" as const, statements: q.statements.map(st => ({ ...st })) };
        }
        // Legacy đúng/sai một lựa chọn → trắc nghiệm 2 phương án (vẫn chấm được)
        return {
          ...base, type: "multiple_choice" as const,
          options: ["Đúng", "Sai"],
          correctOption: q.correct_value === "false" ? 1 : 0,
        };
      case "fill_blank":
        return { ...base, type: "fill_blank" as const, shortAnswer: q.correct_value ?? "" };
      default: {
        // Tự luận: nếu không có giải thích, dùng answer_html làm lời giải
        const sol = base.solution ?? (htmlToConventionText(q.answer_html ?? "") || undefined);
        return { ...base, type: "essay" as const, solution: sol };
      }
    }
  });

  return tokenizeConventionText(parsedToText(parsed));
}

export function parsedToExamQuestions(parsed: ParsedQuestion[], registry?: ExamAssetRegistry): ExamQuestion[] {
  return parsed.map((p, i) => {
    const base = {
      id: `q_${Date.now()}_${i}`,
      order: i,
      content_html: toHtml(p.content, registry),
      explanation_html: p.solution ? toHtml(p.solution, registry) : undefined,
      score: 1,
    };
    switch (p.type) {
      case "multiple_choice":
        return {
          ...base, type: "multiple_choice" as const,
          // options được render như HTML (TipTap/preview) → ảnh resolve thành <img>
          options: (p.options ?? []).map(o => resolveRegistryTokens(o, registry, "html")),
          correct_option: p.correctOption ?? 0,
        };
      case "true_false":
        return {
          ...base, type: "true_false" as const,
          // statements là text thuần → math inline $tex$, ảnh giữ dạng [img:url]
          statements: p.statements?.map(st => ({ ...st, text: resolveRegistryTokens(st.text, registry, "token") })),
        };
      case "fill_blank":
        return {
          ...base, type: "fill_blank" as const,
          correct_value: p.shortAnswer ?? "",
        };
      default:
        return {
          ...base, type: "essay" as const,
          answer_html: p.solution ? toHtml(p.solution, registry) : undefined,
        };
    }
  });
}
