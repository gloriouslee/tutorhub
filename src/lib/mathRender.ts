// ─────────────────────────────────────────────────────────────────────────────
// Render công thức LaTeX ($...$ và $$...$$) trong chuỗi HTML bằng KaTeX.
// Chỉ thay thế trong TEXT node (không đụng vào thuộc tính bên trong thẻ):
// tách chuỗi theo thẻ HTML rồi chỉ xử lý các đoạn văn bản.
// Nhớ import "katex/dist/katex.min.css" ở nơi hiển thị.
// ─────────────────────────────────────────────────────────────────────────────

import katex from "katex";

const DISPLAY_RE = /\$\$([\s\S]+?)\$\$/g;   // $$...$$ — display math (xử lý trước)
const INLINE_RE  = /\$([^$\n]+?)\$/g;        // $...$   — inline math

/** Có dấu hiệu chứa công thức $...$ hay không (kiểm tra nhanh, không parse). */
export function hasMath(html: string): boolean {
  return /\$[^$]+\$/.test(html);
}

/** Text node trong HTML đã được escape — giải mã entity trước khi đưa vào KaTeX. */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function renderTex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(decodeEntities(tex.trim()), {
      throwOnError: false,
      output: "html",
      displayMode,
    });
  } catch {
    return tex; // an toàn: giữ nguyên nếu KaTeX lỗi bất ngờ
  }
}

function renderTextSegment(text: string): string {
  if (!text.includes("$")) return text;
  // Display math trước để $$...$$ không bị regex inline "ăn" mất
  let out = text.replace(DISPLAY_RE, (_m, tex) => renderTex(tex, true));
  out = out.replace(INLINE_RE, (_m, tex) => renderTex(tex, false));
  return out;
}

/**
 * Thay các đoạn $...$ / $$...$$ trong TEXT node của chuỗi HTML
 * bằng markup KaTeX đã render. Thuộc tính trong thẻ không bị ảnh hưởng.
 */
export function renderMathInHtml(html: string): string {
  if (!html || !html.includes("$")) return html;
  return html
    .split(/(<[^>]*>)/g)
    .map(part => (part.startsWith("<") ? part : renderTextSegment(part)))
    .join("");
}
