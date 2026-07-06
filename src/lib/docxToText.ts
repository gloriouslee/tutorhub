// ─────────────────────────────────────────────────────────────────────────────
// Chuyển HTML từ mammoth.convertToHtml() sang văn bản theo quy ước soạn đề:
//   • Phần tử khối (p, tr, li, h1-h6, br...) → xuống dòng
//   • <img src="..."> → token " [img:SRC] " (parser sẽ dựng lại thẻ <img>)
//   • <img src="placeholder:formula"> (WMF/EMF MathType không chuyển được)
//     → marker văn bản để giáo viên gõ lại bằng $LaTeX$
//   • Bỏ các thẻ còn lại, giải mã entity, gộp dòng trống thừa
// Hàm thuần (không side effect) để dễ test.
// ─────────────────────────────────────────────────────────────────────────────

/** src đặc biệt do handler ảnh của mammoth trả về khi gặp công thức dạng ảnh. */
export const FORMULA_PLACEHOLDER_SRC = "placeholder:formula";

/** Marker chèn vào văn bản tại vị trí công thức không tự chuyển được. */
export const FORMULA_MARKER = "[công thức — gõ lại bằng $LaTeX$]";

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export function docxHtmlToConventionText(html: string): string {
  let s = html;

  // <img> → token [img:src] hoặc marker công thức
  s = s.replace(/<img\b[^>]*>/gi, tag => {
    const m = tag.match(/\bsrc\s*=\s*"([^"]*)"/i) ?? tag.match(/\bsrc\s*=\s*'([^']*)'/i);
    const src = m ? decodeEntities(m[1]).trim() : "";
    if (!src) return " ";
    if (src === FORMULA_PLACEHOLDER_SRC) return ` ${FORMULA_MARKER} `;
    return ` [img:${src}] `;
  });

  // Ranh giới khối → xuống dòng; ô bảng → khoảng trắng
  s = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table|ul|ol|blockquote)\s*>/gi, "\n")
    .replace(/<\/(td|th)\s*>/gi, " ");

  // Bỏ mọi thẻ còn lại
  s = s.replace(/<[^>]+>/g, "");

  // Giải mã entity (sau khi đã bỏ thẻ nên an toàn)
  s = decodeEntities(s);

  // Gộp khoảng trắng trong dòng + gộp các dòng trống liên tiếp
  return s
    .split("\n")
    .map(l => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
