"use client";

import { useRef, useState, useCallback, useMemo } from "react";

// ── ConventionEditor ───────────────────────────────────────────────────────────
// Trình soạn thảo văn bản quy ước kiểu code-editor (tham khảo Azota):
// - Số dòng ở lề trái, tô màu cú pháp (Câu N., Phần, Lời giải, A-D, a-d, $math$, token…)
// - Kỹ thuật overlay: <pre> tô màu bên dưới + <textarea> chữ trong suốt bên trên,
//   hai lớp dùng CHÍNH XÁC cùng font/padding/wrap để con trỏ không bị lệch.
// - textarea là chủ scroll; lớp highlight dịch theo bằng translateY.

const FORMULA_MARKER = "[công thức — cần gõ lại]";

// Các lớp quyết định metrics — PHẢI giống hệt nhau giữa <pre> và <textarea>
const METRIC_CLS =
  "font-mono text-xs leading-relaxed whitespace-pre-wrap break-words py-4 pr-4 pl-14";

// Token inline: thứ tự alternation quan trọng (marker công thức trước [img:…])
const INLINE_RE = new RegExp(
  [
    /\[công thức — cần gõ lại\]/.source,        // marker công thức cần gõ lại
    /\[(?:m|img):[^\]\n]*\]/.source,            // [m:N] / [img:N] / [img:url]
    /\$[^$\n]+\$/.source,                       // $math$
    /(?:^|(?<=\s))\*?[A-D]\.(?=\s)/.source,     // A. B. C. D. (± dấu * đúng)
    /(?:^|(?<=\s))\*?[a-d]\)(?=\s|$)/.source,   // a) b) c) d) (± dấu * đúng)
  ].join("|"),
  "g"
);

function inlineTokens(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  INLINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    let cls: string;
    if (tok === FORMULA_MARKER) {
      // px-px -mx-px: nền lan ra 1px mỗi bên mà KHÔNG làm lệch layout so với textarea
      cls = "text-red-500 bg-red-500/10 rounded px-px -mx-px";
    } else if (tok.startsWith("[")) {
      cls = "text-orange-600 dark:text-orange-400 bg-orange-500/10 rounded px-px -mx-px";
    } else if (tok.startsWith("$")) {
      cls = "text-teal-600 dark:text-teal-400";
    } else if (tok.startsWith("*")) {
      cls = "text-emerald-600 dark:text-emerald-400 font-bold";
    } else {
      cls = "text-amber-600 dark:text-amber-400 font-semibold";
    }
    out.push(<span key={`${keyBase}_${k++}`} className={cls}>{tok}</span>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function highlightLine(line: string, key: string): { cls: string; nodes: React.ReactNode[] } {
  if (/^\s*Lời giải\s*:?\s*$/i.test(line)) {
    return { cls: "font-semibold text-violet-600 dark:text-violet-400 bg-violet-500/10 rounded", nodes: [line] };
  }
  if (/^\s*Phần\s/i.test(line)) {
    return { cls: "font-semibold text-purple-600 dark:text-purple-400", nodes: [line] };
  }
  if (/^\s*Đáp án\s*:/i.test(line)) {
    return { cls: "text-emerald-600 dark:text-emerald-400", nodes: [line] };
  }
  const cau = line.match(/^(\s*Câu\s+\d+\s*[.:])/);
  if (cau) {
    const head = cau[1];
    return {
      cls: "",
      nodes: [
        <span key={key + "_cau"} className="font-bold text-blue-600 dark:text-blue-400">{head}</span>,
        ...inlineTokens(line.slice(head.length), key),
      ],
    };
  }
  return { cls: "", nodes: inlineTokens(line, key) };
}

export default function ConventionEditor({ value, onChange, placeholder, questionCount }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  questionCount: number;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const hlRef = useRef<HTMLDivElement>(null);
  const [caretLine, setCaretLine] = useState(0);

  const lines = useMemo(() => value.split("\n"), [value]);

  const syncScroll = useCallback(() => {
    const ta = taRef.current, hl = hlRef.current;
    if (ta && hl) hl.style.transform = `translateY(${-ta.scrollTop}px)`;
  }, []);

  const updateCaret = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    setCaretLine(ta.value.slice(0, ta.selectionStart).split("\n").length - 1);
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const { selectionStart: s, selectionEnd: en } = ta;
      const next = ta.value.slice(0, s) + "  " + ta.value.slice(en);
      onChange(next);
      requestAnimationFrame(() => {
        const el = taRef.current;
        if (el) { el.selectionStart = el.selectionEnd = s + 2; }
      });
    }
  }, [onChange]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="relative flex-1 min-h-0 overflow-hidden bg-background">
        {/* Nền gutter số dòng (đứng yên) */}
        <div aria-hidden className="absolute left-0 top-0 bottom-0 w-11 bg-muted/30 border-r border-border/60 pointer-events-none" />

        {/* Lớp highlight (dịch theo scroll của textarea) */}
        <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
          <div ref={hlRef} className={`${METRIC_CLS} text-foreground will-change-transform`}>
            {lines.map((line, i) => {
              const { cls, nodes } = highlightLine(line, `l${i}`);
              return (
                <div key={i} className={`relative ${i === caretLine ? "bg-primary/[0.06]" : ""}`}>
                  <span className={`absolute -left-14 w-11 pr-2 text-right select-none tabular-nums ${i === caretLine ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                    {i + 1}
                  </span>
                  <span className={cls}>{nodes}</span>
                  {line === "" && "​"}
                </div>
              );
            })}
          </div>
        </div>

        {/* textarea trong suốt — chủ scroll, con trỏ hiển thị */}
        <textarea
          ref={taRef}
          value={value}
          onChange={e => { onChange(e.target.value); updateCaret(); }}
          onScroll={syncScroll}
          onSelect={updateCaret}
          onKeyDown={onKeyDown}
          onClick={updateCaret}
          spellCheck={false}
          placeholder={placeholder}
          style={{ caretColor: "rgb(var(--foreground))" }}
          className={`absolute inset-0 z-10 w-full h-full resize-none outline-none bg-transparent text-transparent selection:bg-primary/20 placeholder:text-muted-foreground/60 overflow-y-auto ${METRIC_CLS}`}
        />
      </div>

      {/* Thanh trạng thái */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1 border-t border-border/60 bg-muted/20 text-[10px] text-muted-foreground">
        <span>{lines.length} dòng</span>
        <span>·</span>
        <span>{questionCount} câu nhận diện</span>
        <span className="ml-auto hidden sm:inline">Tab = 2 dấu cách</span>
      </div>
    </div>
  );
}
