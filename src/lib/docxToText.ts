// ─────────────────────────────────────────────────────────────────────────────
// Chuyển HTML từ mammoth.convertToHtml() sang văn bản theo quy ước soạn đề:
//   • Phần tử khối (p, tr, li, h1-h6, br...) → xuống dòng
//   • <img src="..."> → token " [img:SRC] " (parser sẽ dựng lại thẻ <img>)
//   • <img src="placeholder:formula"> (WMF/EMF MathType không chuyển được)
//     → marker văn bản để giáo viên gõ lại
// Kèm preprocessDocxEquations(): tự chuyển công thức MathType (MTEF) → LaTeX
// ngay trong file .docx trước khi mammoth xử lý.
//   • Bỏ các thẻ còn lại, giải mã entity, gộp dòng trống thừa
// Hàm thuần (không side effect) để dễ test.
// ─────────────────────────────────────────────────────────────────────────────

// Các dòng boilerplate đầu đề thi (header trường/môn/thí sinh...) — loại bỏ
// khi import vì không thuộc nội dung câu hỏi.
const BOILERPLATE_RES: RegExp[] = [
  /^\{[^}]*\}$/,                                   // {thông tin trường}, {môn thi}
  /\.docx?\s*$/i,                                   // dòng tên file
  /^Thời gian làm bài/i,
  /^-{3,}\s*$/,                                     // dòng gạch ngang
  /^Họ\s*(và)?\s*tên\s*(thí sinh|học sinh)/i,
  /^Số báo danh/i,
  /^Mã đề/i,
  /^(ĐỀ|Đề)\s+(THI|thi|KIỂM TRA|kiểm tra|SỐ|số)/,
  /^(SỞ|TRƯỜNG|PHÒNG)\s/i,                          // Sở GD&ĐT, Trường THPT...
  /^\(?Không kể thời gian/i,
  /^[.…]{5,}\s*$/,                             // dòng toàn dấu chấm
];

/** Bỏ các dòng boilerplate TRƯỚC câu hỏi/phần đầu tiên (nội dung đề giữ nguyên). */
export function stripExamBoilerplate(text: string): string {
  const lines = text.split("\n");
  const firstContent = lines.findIndex(l => /^\s*(Câu\s+\d|Phần\s|PHẦN\s)/.test(l));
  if (firstContent <= 0) return text;
  const head = lines.slice(0, firstContent).filter(l => {
    const t = l.trim();
    if (!t) return false;
    return !BOILERPLATE_RES.some(re => re.test(t));
  });
  return [...head, ...lines.slice(firstContent)].join("\n");
}

/** src đặc biệt do handler ảnh của mammoth trả về khi gặp công thức dạng ảnh. */
export const FORMULA_PLACEHOLDER_SRC = "placeholder:formula";

/** Marker chèn vào văn bản tại vị trí công thức không tự chuyển được. */
export const FORMULA_MARKER = "[công thức — cần gõ lại]";

/** Escape ký tự đặc biệt XML khi chèn text vào document.xml. */
function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Tiền xử lý file .docx TRƯỚC khi đưa vào mammoth: tìm các công thức MathType
 * nhúng dạng OLE (<w:object> chứa <o:OLEObject r:id="...">), chuyển sang LaTeX
 * bằng mtefToLatex, rồi thay cả khối object bằng run văn bản " $LaTeX$ ".
 * Công thức không chuyển được thì giữ nguyên (đi theo đường placeholder WMF cũ).
 */
export async function preprocessDocxEquations(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const [{ default: JSZip }, { oleBinToLatex }] = await Promise.all([
    import("jszip"),
    import("./mtefToLatex"),
  ]);
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docFile = zip.file("word/document.xml");
  const relsFile = zip.file("word/_rels/document.xml.rels");
  if (!docFile || !relsFile) return arrayBuffer;

  const relsXml = await relsFile.async("string");
  // r:id → target (đường dẫn file nhúng)
  const relTargets = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const tag = m[0];
    const id = tag.match(/\bId="([^"]+)"/)?.[1];
    const target = tag.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) relTargets.set(id, target);
  }

  let docXml = await docFile.async("string");
  let changed = false;

  // Xử lý tuần tự từng khối <w:object>…</w:object>
  const blocks = [...docXml.matchAll(/<w:object\b[^>]*>[\s\S]*?<\/w:object>/g)];
  for (const b of blocks) {
    const block = b[0];
    const rid = block.match(/<o:OLEObject\b[^>]*\br:id="([^"]+)"/)?.[1];
    if (!rid) continue;
    const target = relTargets.get(rid);
    if (!target) continue;
    const path = "word/" + target.replace(/^\.?\//, "").replace(/^\/word\//, "");
    const binFile = zip.file(path) ?? zip.file(target.replace(/^\//, ""));
    if (!binFile) continue;
    try {
      const bytes = new Uint8Array(await binFile.async("arraybuffer"));
      const latex = oleBinToLatex(bytes);
      if (!latex) continue;
      const run = `<w:r><w:t xml:space="preserve"> $${escapeXml(latex)}$ </w:t></w:r>`;
      // dùng hàm thay thế để "$" trong LaTeX không bị hiểu là nhóm thay thế ($&, $'...)
      docXml = docXml.replace(block, () => run);
      changed = true;
    } catch {
      // giữ nguyên khối — placeholder WMF sẽ xử lý
    }
  }

  if (!changed) return arrayBuffer;
  zip.file("word/document.xml", docXml);
  return zip.generateAsync({ type: "arraybuffer" });
}

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
