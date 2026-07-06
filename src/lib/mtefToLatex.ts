// ─────────────────────────────────────────────────────────────────────────────
// MTEF v5 (MathType binary equation format) → LaTeX
//
// Dùng để tự chuyển công thức MathType nhúng trong file .docx (OLE object,
// stream "Equation Native") sang LaTeX, tránh việc giáo viên phải gõ lại.
//
// Tham khảo: đặc tả công khai MTEF v5 của Design Science ("MathType's
// equation format") + các cài đặt mã nguồn mở (ruby gem "mathtype",
// python mtef parsers).
//
// Thuần TypeScript, không dùng API của Node — chạy được trong trình duyệt.
// ─────────────────────────────────────────────────────────────────────────────

import * as CFB from "cfb";

// ── Kiểu dữ liệu AST ─────────────────────────────────────────────────────────

interface CharNode {
  kind: "char";
  typeface: number; // 1=text 2=function 3=variable 4/5=greek 6=symbol 7=vector 8=number...
  code: number; // MTCode ≈ Unicode
  embells: number[]; // mã embellishment (mũ, gạch ngang, phẩy...)
  funcStart: boolean;
}
interface LineNode {
  kind: "line";
  isNull: boolean;
  children: Node[];
}
interface TmplNode {
  kind: "tmpl";
  selector: number;
  variation: number;
  lines: Node[]; // các LINE / PILE con
}
interface PileNode {
  kind: "pile";
  lines: Node[];
}
interface MatrixNode {
  kind: "matrix";
  rows: number;
  cols: number;
  lines: Node[];
}
type Node = CharNode | LineNode | TmplNode | PileNode | MatrixNode;

// ── Đọc byte ─────────────────────────────────────────────────────────────────

class Reader {
  pos = 0;
  constructor(private b: Uint8Array) {}
  get eof(): boolean {
    return this.pos >= this.b.length;
  }
  get remaining(): number {
    return this.b.length - this.pos;
  }
  u8(): number {
    if (this.pos >= this.b.length) throw new Error("EOF");
    return this.b[this.pos++];
  }
  peek(): number {
    if (this.pos >= this.b.length) throw new Error("EOF");
    return this.b[this.pos];
  }
  u16(): number {
    const lo = this.u8();
    return lo | (this.u8() << 8);
  }
  cstr(): string {
    let s = "";
    for (;;) {
      const c = this.u8();
      if (c === 0) return s;
      s += String.fromCharCode(c);
    }
  }
  skip(n: number): void {
    if (this.pos + n > this.b.length) throw new Error("EOF");
    this.pos += n;
  }
}

/** Nudge (xfLMOVE): 2 byte; nếu cả hai = 0x80 thì thêm 2 số 16-bit. */
function readNudge(r: Reader): void {
  const dx = r.u8();
  const dy = r.u8();
  if (dx === 0x80 && dy === 0x80) {
    r.u16();
    r.u16();
  }
}

/** Mảng giá trị kích thước mã hoá nibble trong EQN_PREFS (mỗi giá trị kết thúc bằng nibble 0xF). */
function skipNibbleArray(r: Reader, count: number): void {
  let hi = true; // đang ở nửa cao của byte hiện tại?
  let cur = 0;
  let read = 0;
  const nextNibble = (): number => {
    if (hi) {
      cur = r.u8();
      hi = false;
      return (cur >> 4) & 0xf;
    }
    hi = true;
    return cur & 0xf;
  };
  while (read < count) {
    const n = nextNibble();
    if (n === 0xf) read++;
  }
  // phần lẻ nibble cuối được đệm cho tròn byte (hi=true nghĩa là đã tròn)
}

// ── Parser bản ghi MTEF v5 ───────────────────────────────────────────────────

const END = 0,
  REC_LINE = 1,
  REC_CHAR = 2,
  REC_TMPL = 3,
  REC_PILE = 4,
  REC_MATRIX = 5,
  REC_EMBELL = 6,
  REC_RULER = 7,
  REC_FONT_STYLE_DEF = 8,
  REC_SIZE = 9,
  REC_COLOR = 15,
  REC_COLOR_DEF = 16,
  REC_FONT_DEF = 17,
  REC_EQN_PREFS = 18,
  REC_ENCODING_DEF = 19;

function parseRuler(r: Reader): void {
  const nStops = r.u8();
  for (let i = 0; i < nStops; i++) {
    r.u8(); // loại tab
    r.u16(); // offset
  }
}

function parseEmbellList(r: Reader): number[] {
  const out: number[] = [];
  for (;;) {
    const tag = r.u8();
    if (tag === END) return out;
    if (tag !== REC_EMBELL) throw new Error(`embell list: tag ${tag}`);
    const opts = r.u8();
    if (opts & 0x08) readNudge(r);
    out.push(r.u8());
  }
}

/** Đọc danh sách object cho tới END; trả về các node có nghĩa. */
function parseObjectList(r: Reader): Node[] {
  const out: Node[] = [];
  for (;;) {
    if (r.eof) return out; // dung sai: thiếu END cuối stream
    const tag = r.u8();
    switch (tag) {
      case END:
        return out;

      case REC_LINE: {
        const opts = r.u8();
        if (opts & 0x08) readNudge(r);
        if (opts & 0x04) r.u8(); // line spacing
        const isNull = (opts & 0x01) !== 0;
        const children = isNull ? [] : parseObjectList(r);
        out.push({ kind: "line", isNull, children });
        break;
      }

      case REC_CHAR: {
        const opts = r.u8();
        if (opts & 0x08) readNudge(r);
        const typeface = r.u8() - 128;
        let code = 0;
        if (!(opts & 0x20)) code = r.u16(); // MTCode 16-bit
        if (opts & 0x04) {
          const fp = r.u8(); // vị trí 8-bit trong font
          if (!code) code = fp;
        }
        if (opts & 0x10) {
          const fp = r.u16(); // vị trí 16-bit trong font
          if (!code) code = fp;
        }
        const embells = opts & 0x01 ? parseEmbellList(r) : [];
        out.push({
          kind: "char",
          typeface,
          code,
          embells,
          funcStart: (opts & 0x02) !== 0,
        });
        break;
      }

      case REC_TMPL: {
        const opts = r.u8();
        if (opts & 0x08) readNudge(r);
        const selector = r.u8();
        let variation = r.u8();
        if (variation & 0x80) variation = (variation & 0x7f) | (r.u8() << 8);
        r.u8(); // options riêng của template
        const lines = parseObjectList(r);
        out.push({ kind: "tmpl", selector, variation, lines });
        break;
      }

      case REC_PILE: {
        const opts = r.u8();
        if (opts & 0x08) readNudge(r);
        r.u8(); // halign
        r.u8(); // valign
        const lines = parseObjectList(r);
        out.push({ kind: "pile", lines });
        break;
      }

      case REC_MATRIX: {
        const opts = r.u8();
        if (opts & 0x08) readNudge(r);
        r.u8(); // valign
        r.u8(); // h_just
        r.u8(); // v_just
        const rows = r.u8();
        const cols = r.u8();
        // đường kẻ phân vùng: 2 bit cho mỗi (rows+1) và (cols+1) dòng/cột
        r.skip(Math.ceil((2 * (rows + 1)) / 8));
        r.skip(Math.ceil((2 * (cols + 1)) / 8));
        const lines = parseObjectList(r);
        out.push({ kind: "matrix", rows, cols, lines });
        break;
      }

      case REC_EMBELL: {
        // embellishment "mồ côi" (thường nằm trong list của CHAR) — bỏ qua
        const opts = r.u8();
        if (opts & 0x08) readNudge(r);
        r.u8();
        break;
      }

      case REC_RULER:
        parseRuler(r);
        break;

      case REC_FONT_STYLE_DEF:
        r.u8(); // số font
        r.u8(); // kiểu chữ
        break;

      case REC_SIZE: {
        // SIZE: [lsize]; lsize=100 → thêm dsize 1 byte; lsize=101 → point size 16-bit
        const b0 = r.u8();
        if (b0 === 100) {
          r.u8();
          r.u8();
        } else if (b0 === 101) {
          r.u16();
        } else {
          r.u8(); // dsize
        }
        break;
      }

      case 10: // FULL
      case 11: // SUB
      case 12: // SUB2
      case 13: // SYM
      case 14: // SUBSYM
        break;

      case REC_COLOR:
        r.u8();
        break;

      case REC_COLOR_DEF: {
        const flags = r.u8();
        const n = flags & 0x01 ? 4 : 3; // CMYK : RGB
        for (let i = 0; i < n; i++) r.u16();
        if (flags & 0x02) r.cstr();
        break;
      }

      case REC_FONT_DEF:
        r.u8(); // chỉ số encoding
        r.cstr(); // tên font
        break;

      case REC_EQN_PREFS: {
        r.u8(); // options
        skipNibbleArray(r, r.u8()); // sizes
        skipNibbleArray(r, r.u8()); // spacing
        const nStyles = r.u8();
        for (let i = 0; i < nStyles; i++) {
          const font = r.u8();
          if (font !== 0) r.u8();
        }
        break;
      }

      case REC_ENCODING_DEF:
        r.cstr();
        break;

      default:
        if (tag >= 100) {
          // bản ghi "future": [tag][độ dài 16-bit][dữ liệu]
          r.skip(r.u16());
          break;
        }
        throw new Error(`record tag không hỗ trợ: ${tag} @${r.pos - 1}`);
    }
  }
}

/** Parse toàn bộ MTEF body (sau header EQNOLEFILEHDR). Ném lỗi nếu hỏng. */
export function parseMtef(body: Uint8Array): Node[] {
  const r = new Reader(body);
  const version = r.u8();
  if (version !== 5) throw new Error(`MTEF version ${version} không hỗ trợ`);
  r.u8(); // platform
  r.u8(); // product
  r.u8(); // version
  r.u8(); // subversion
  r.cstr(); // application key ("DSMT7")
  r.u8(); // equation options
  return parseObjectList(r);
}

// ── Bảng ký hiệu Unicode → LaTeX ─────────────────────────────────────────────

const SYMBOLS: Record<number, string> = {
  0x00b0: "^\\circ ",
  0x00b1: "\\pm ",
  0x00b7: "\\cdot ",
  0x00d7: "\\times ",
  0x00f7: "\\div ",
  0x2010: "-",
  0x2013: "-",
  0x2026: "\\ldots ",
  0x2032: "'",
  0x2033: "''",
  0x2044: "/",
  0x2061: "", // function application (vô hình)
  0x2062: "", // invisible times
  0x2063: "",
  0x2111: "\\Im ",
  0x2115: "\\mathbb{N}",
  0x2119: "\\mathbb{P}",
  0x211a: "\\mathbb{Q}",
  0x211c: "\\Re ",
  0x211d: "\\mathbb{R}",
  0x2124: "\\mathbb{Z}",
  0x2102: "\\mathbb{C}",
  0x2190: "\\leftarrow ",
  0x2191: "\\uparrow ",
  0x2192: "\\to ",
  0x2193: "\\downarrow ",
  0x2194: "\\leftrightarrow ",
  0x21d0: "\\Leftarrow ",
  0x21d2: "\\Rightarrow ",
  0x21d4: "\\Leftrightarrow ",
  0x2200: "\\forall ",
  0x2202: "\\partial ",
  0x2203: "\\exists ",
  0x2205: "\\varnothing ",
  0x2206: "\\Delta ",
  0x2207: "\\nabla ",
  0x2208: "\\in ",
  0x2209: "\\notin ",
  0x220b: "\\ni ",
  0x2211: "\\sum ",
  0x220f: "\\prod ",
  0x2212: "-",
  0x2213: "\\mp ",
  0x2215: "/",
  0x2217: "*",
  0x2218: "\\circ ",
  0x221a: "\\surd ",
  0x221d: "\\propto ",
  0x221e: "\\infty ",
  0x2220: "\\angle ",
  0x2225: "\\parallel ",
  0x2226: "\\nparallel ",
  0x2227: "\\wedge ",
  0x2228: "\\vee ",
  0x2229: "\\cap ",
  0x222a: "\\cup ",
  0x222b: "\\int ",
  0x2234: "\\therefore ",
  0x2235: "\\because ",
  0x223c: "\\sim ",
  0x2243: "\\simeq ",
  0x2245: "\\cong ",
  0x2248: "\\approx ",
  0x2260: "\\ne ",
  0x2261: "\\equiv ",
  0x2264: "\\le ",
  0x2265: "\\ge ",
  0x226a: "\\ll ",
  0x226b: "\\gg ",
  0x2282: "\\subset ",
  0x2283: "\\supset ",
  0x2284: "\\not\\subset ",
  0x2286: "\\subseteq ",
  0x2287: "\\supseteq ",
  0x2295: "\\oplus ",
  0x2297: "\\otimes ",
  0x22a5: "\\perp ",
  0x22c5: "\\cdot ",
  0x22ee: "\\vdots ",
  0x22ef: "\\cdots ",
  0x2308: "\\lceil ",
  0x2309: "\\rceil ",
  0x230a: "\\lfloor ",
  0x230b: "\\rfloor ",
  0x25b3: "\\triangle ",
  0x00ac: "\\neg ",
  0x2118: "\\wp ",
  0x2135: "\\aleph ",
  0x2113: "\\ell ",
  0x210f: "\\hbar ",
};

const GREEK: Record<number, string> = {
  0x0391: "A", 0x0392: "B", 0x0393: "\\Gamma ", 0x0394: "\\Delta ",
  0x0395: "E", 0x0396: "Z", 0x0397: "H", 0x0398: "\\Theta ",
  0x0399: "I", 0x039a: "K", 0x039b: "\\Lambda ", 0x039c: "M",
  0x039d: "N", 0x039e: "\\Xi ", 0x039f: "O", 0x03a0: "\\Pi ",
  0x03a1: "P", 0x03a3: "\\Sigma ", 0x03a4: "T", 0x03a5: "\\Upsilon ",
  0x03a6: "\\Phi ", 0x03a7: "X", 0x03a8: "\\Psi ", 0x03a9: "\\Omega ",
  0x03b1: "\\alpha ", 0x03b2: "\\beta ", 0x03b3: "\\gamma ",
  0x03b4: "\\delta ", 0x03b5: "\\varepsilon ", 0x03b6: "\\zeta ",
  0x03b7: "\\eta ", 0x03b8: "\\theta ", 0x03b9: "\\iota ",
  0x03ba: "\\kappa ", 0x03bb: "\\lambda ", 0x03bc: "\\mu ",
  0x03bd: "\\nu ", 0x03be: "\\xi ", 0x03bf: "o", 0x03c0: "\\pi ",
  0x03c1: "\\rho ", 0x03c2: "\\varsigma ", 0x03c3: "\\sigma ",
  0x03c4: "\\tau ", 0x03c5: "\\upsilon ", 0x03c6: "\\varphi ",
  0x03c7: "\\chi ", 0x03c8: "\\psi ", 0x03c9: "\\omega ",
  0x03d1: "\\vartheta ", 0x03d5: "\\phi ", 0x03d6: "\\varpi ",
  0x03f5: "\\epsilon ",
};

/** Tên hàm quen thuộc → lệnh LaTeX có sẵn. */
const KNOWN_FUNCS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan",
  "sinh", "cosh", "tanh", "coth", "log", "ln", "lg", "lim", "exp", "min",
  "max", "gcd", "det", "arg", "deg", "dim", "hom", "ker", "inf", "sup",
]);

const EMBELL_LATEX: Record<number, string> = {
  2: "\\dot", // embDOT
  3: "\\ddot",
  4: "\\dddot",
  8: "\\tilde", // embTILDE
  9: "\\hat",
  10: "\\cancel", // embNOT (gạch chéo phủ định)
  11: "\\vec", // mũi tên phải
  12: "\\overleftarrow",
  13: "\\overleftrightarrow",
  17: "\\bar",
};

// ── Sinh LaTeX ───────────────────────────────────────────────────────────────

function escapeCharLatex(code: number, typeface: number): string {
  if (GREEK[code] !== undefined) return GREEK[code];
  if (SYMBOLS[code] !== undefined) return SYMBOLS[code];
  const ch = String.fromCodePoint(code);
  if (/[A-Za-z0-9]/.test(ch)) return ch;
  switch (ch) {
    case "{": return "\\{";
    case "}": return "\\}";
    case "%": return "\\%";
    case "&": return "\\&";
    case "#": return "\\#";
    case "$": return "\\$";
    case "_": return "\\_";
    case "\\": return "\\backslash ";
    case "~": return "\\sim ";
    case "^": return "\\hat{}";
  }
  if (code >= 0x20 && code < 0x7f) return ch;
  if (code === 0xa0 || code === 0x2009 || code === 0x200a || code === 0x2005)
    return " ";
  // ký tự lạ: giữ nguyên Unicode (KaTeX hiển thị được khá nhiều) + đánh dấu mềm
  if (typeface >= 0 && code >= 0xe000 && code <= 0xf8ff) return "??"; // private use — chịu
  return ch;
}

function wrapEmbells(base: string, embells: number[]): string {
  let out = base;
  for (const e of embells) {
    if (e === 5) out = `${out}'`;
    else if (e === 6) out = `${out}''`;
    else if (e === 7) out = `${out}'''`;
    else if (EMBELL_LATEX[e]) out = `${EMBELL_LATEX[e]}{${out.trim()}}`;
    // các embellishment khác (nudge nét...) bỏ qua
  }
  return out;
}

/** Nội dung của node LINE thứ i trong danh sách con của template (bỏ qua node phi-line). */
function tmplSlots(t: TmplNode): string[] {
  const slots: string[] = [];
  for (const n of t.lines) {
    if (n.kind === "line" || n.kind === "pile") slots.push(emitNode(n));
    // CHAR ở mức template = ký tự trang trí của fence — bỏ qua
  }
  return slots;
}

function emitFence(left: string, right: string, t: TmplNode): string {
  // variation của fence: bit 0x01 = có ngoặc trái, 0x02 = có ngoặc phải
  const v = t.variation;
  const l = v & 0x01 ? left : ".";
  const rr = v & 0x02 ? right : ".";
  const body = tmplSlots(t).join("");
  return `\\left${l} ${body} \\right${rr}`;
}

const BIG_OPS: Record<number, string> = {
  16: "\\sum", 17: "\\prod", 18: "\\coprod", 19: "\\bigcup", 20: "\\bigcap",
  21: "\\int", 22: "\\sum",
};

function emitTmpl(t: TmplNode): string {
  const s = tmplSlots(t);
  const sel = t.selector;
  switch (sel) {
    case 0: return emitFence("\\langle", "\\rangle", t);
    case 1: return emitFence("(", ")", t);
    case 2: return emitFence("\\{", "\\}", t);
    case 3: return emitFence("[", "]", t);
    case 4: return emitFence("|", "|", t);
    case 5: return emitFence("\\|", "\\|", t);
    case 6: return emitFence("\\lfloor", "\\rfloor", t);
    case 7: return emitFence("\\lceil", "\\rceil", t);
    case 8: return emitFence("[", "]", t); // ngoặc đơn lẻ
    case 9: {
      // interval: các bit variation chọn kiểu ngoặc trái/phải
      const v = t.variation;
      const left = v & 0x01 ? "(" : "[";
      const right = v & 0x02 ? ")" : "]";
      return `\\left${left} ${s.join("")} \\right${right}`;
    }
    case 10: {
      // căn thức: slot[0] = biểu thức, slot[1] = bậc căn
      const idx = (s[1] ?? "").trim();
      return idx && t.variation ? `\\sqrt[${idx}]{${s[0] ?? ""}}` : `\\sqrt{${s[0] ?? ""}}`;
    }
    case 11: // phân số
      return `\\frac{${(s[0] ?? "").trim()}}{${(s[1] ?? "").trim()}}`;
    case 12: return `\\underline{${s[0] ?? ""}}`;
    case 13: return `\\overline{${s[0] ?? ""}}`;
    case 14: {
      // mũi tên có chữ trên/dưới
      const body = (s[0] ?? "").trim();
      const arrow = t.variation & 0x04 ? "\\xleftarrow" : "\\xrightarrow";
      return body ? `${arrow}{${body}}` : (t.variation & 0x04 ? "\\leftarrow " : "\\to ");
    }
    case 15: {
      // tích phân: slot[0]=biểu thức dưới dấu ∫, slot[1]=cận dưới, slot[2]=cận trên
      const lo = (s[1] ?? "").trim();
      const hi = (s[2] ?? "").trim();
      let out = "\\int";
      if (lo) out += `_{${lo}}`;
      if (hi) out += `^{${hi}}`;
      return `${out} ${s[0] ?? ""}`;
    }
    case 16: case 17: case 18: case 19: case 20: {
      const op = BIG_OPS[sel];
      const lo = (s[1] ?? "").trim();
      const hi = (s[2] ?? "").trim();
      let out = op;
      if (lo) out += `_{${lo}}`;
      if (hi) out += `^{${hi}}`;
      return `${out} ${s[0] ?? ""}`;
    }
    case 21: case 22: {
      // tmINTOP/tmSUMOP: toán tử lớn do người dùng gõ (lim, min, max...)
      // slot: [main, cận dưới, cận trên, ký tự toán tử]
      const op = (s[3] ?? "").trim() || (sel === 21 ? "\\int" : "\\sum");
      const lo = (s[1] ?? "").trim();
      const hi = (s[2] ?? "").trim();
      let out = op;
      if (lo) out += `_{${lo}}`;
      if (hi) out += `^{${hi}}`;
      return `${out} ${s[0] ?? ""}`;
    }
    case 23: {
      // limit: slot[0] = "lim" (main), slot[1] = biểu thức bên dưới
      const under = (s[1] ?? "").trim();
      const main = (s[0] ?? "").trim() || "\\lim";
      return under ? `${main}_{${under}} ` : `${main} `;
    }
    case 24: return `\\underbrace{${s[0] ?? ""}}${s[1] ? `_{${s[1].trim()}}` : ""}`;
    case 25: return `\\underbracket{${s[0] ?? ""}}`;
    case 26: return `\\overline{)${s[0] ?? ""}}`; // chia dài — hiếm gặp
    case 27:
    case 28:
    case 29: {
      // slot[0] = chỉ số dưới, slot[1] = chỉ số trên (slot rỗng nếu không có)
      const sub = (s[0] ?? "").trim();
      const sup = (s[1] ?? "").trim();
      let out = "";
      if (sub) out += `_{${sub}}`;
      if (sup) out += `^{${sup}}`;
      return out;
    }
    case 30: return `\\left\\langle ${s.join(" | ")} \\right\\rangle `; // Dirac
    case 31: {
      const body = (s[0] ?? "").trim();
      return body.length > 1 ? `\\overrightarrow{${body}}` : `\\vec{${body}}`;
    }
    case 32: return `\\tilde{${(s[0] ?? "").trim()}}`;
    case 33: return `\\hat{${(s[0] ?? "").trim()}}`;
    case 34: return `\\overset{\\frown}{${(s[0] ?? "").trim()}}`; // cung
    case 35: return s.join(""); // joint status — bỏ
    case 36: return `\\cancel{${(s[0] ?? "").trim()}}`; // gạch bỏ
    case 37: return `\\boxed{${(s[0] ?? "").trim()}}`;
    default:
      return s.join("");
  }
}

function emitPileLines(lines: Node[]): string {
  const rows = lines
    .filter(n => n.kind === "line")
    .map(n => emitNode(n).trim());
  return rows.join(" \\\\ ");
}

function emitNode(node: Node): string {
  switch (node.kind) {
    case "line":
      return emitChildren(node.children);
    case "pile":
      return `\\begin{array}{l} ${emitPileLines(node.lines)} \\end{array}`;
    case "matrix": {
      const cells = node.lines
        .filter(n => n.kind === "line")
        .map(n => emitNode(n).trim());
      // bỏ những cột trống hoàn toàn (MathType hay chèn cột rỗng đầu dòng)
      const keep: number[] = [];
      for (let c = 0; c < node.cols; c++)
        if (cells.some((cell, idx) => idx % node.cols === c && cell !== "")) keep.push(c);
      const rows: string[] = [];
      for (let i = 0; i < node.rows; i++)
        rows.push(keep.map(c => cells[i * node.cols + c] ?? "").join(" & "));
      return `\\begin{matrix} ${rows.join(" \\\\ ")} \\end{matrix}`;
    }
    case "tmpl":
      return emitTmpl(node);
    case "char":
      return wrapEmbells(escapeCharLatex(node.code, node.typeface), node.embells);
  }
}

/** Ghép các node con của một LINE, gom cụm ký tự "function" thành \sin, \log... */
function emitChildren(children: Node[]): string {
  let out = "";
  let i = 0;
  while (i < children.length) {
    const n = children[i];
    if (n.kind === "char" && n.typeface === 2 && /[A-Za-z]/.test(String.fromCodePoint(n.code))) {
      // gom cả cụm ký tự kiểu "hàm số"
      let name = "";
      let j = i;
      const embells: number[] = [];
      while (
        j < children.length &&
        children[j].kind === "char" &&
        (children[j] as CharNode).typeface === 2 &&
        /[A-Za-z]/.test(String.fromCodePoint((children[j] as CharNode).code))
      ) {
        const c = children[j] as CharNode;
        if (c.funcStart && j > i) break; // hàm mới bắt đầu
        name += String.fromCodePoint(c.code);
        embells.push(...c.embells);
        j++;
      }
      const cmd = KNOWN_FUNCS.has(name.toLowerCase())
        ? `\\${name.toLowerCase()} `
        : name.length > 1
          ? `\\operatorname{${name}} `
          : name;
      out += wrapEmbells(cmd, embells);
      i = j;
      continue;
    }
    out += emitNode(n);
    i++;
  }
  return out;
}

function tidy(latex: string): string {
  return latex
    .replace(/\s+/g, " ")
    .replace(/ ([_^])/g, "$1")
    .trim();
}

// ── API công khai ────────────────────────────────────────────────────────────

/**
 * Chuyển stream "Equation Native" (gồm header EQNOLEFILEHDR 28 byte + MTEF)
 * sang LaTeX. Trả về null nếu không phân tích được.
 */
export function equationNativeToLatex(streamBytes: Uint8Array): string | null {
  try {
    if (streamBytes.length < 33) return null;
    // EQNOLEFILEHDR: u16 cbHdr (=28) ... ; MTEF ngay sau header
    const cbHdr = streamBytes[0] | (streamBytes[1] << 8);
    const start = cbHdr >= 8 && cbHdr <= 40 ? cbHdr : 28;
    const nodes = parseMtef(streamBytes.subarray(start));
    const latex = tidy(emitChildren(nodes.flatMap(n => (n.kind === "line" ? n.children : [n]))));
    if (!latex || latex.includes("??")) return null;
    return latex;
  } catch {
    return null;
  }
}

/**
 * Tiện ích: nhận nguyên file OLE (.bin trong word/embeddings của .docx),
 * tìm stream "Equation Native" rồi chuyển sang LaTeX.
 */
export function oleBinToLatex(oleBytes: Uint8Array): string | null {
  try {
    const cfb = CFB.read(oleBytes, { type: "buffer" });
    const entry = CFB.find(cfb, "Equation Native");
    if (!entry || !entry.content) return null;
    const content = entry.content as unknown as ArrayLike<number>;
    return equationNativeToLatex(Uint8Array.from(content));
  } catch {
    return null;
  }
}
