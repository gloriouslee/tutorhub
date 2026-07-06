"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import "katex/dist/katex.min.css";
import { Button } from "@/components/ui/button";
import type { CurriculumLesson } from "@/lib/storage";
import { uploadClassFile } from "@/lib/upload";
import { parseExamText, parsedToText, parsedToExamQuestions, tokenizeConventionText, resolveRegistryTokens, normalizeConventionText, examQuestionsToText, MATH_TOKEN_RE, type ParseResult, type ParsedQuestion, type ExamAssetRegistry } from "@/lib/examTextParser";
import { renderMathInHtml } from "@/lib/mathRender";
import { docxHtmlToConventionText, stripExamBoilerplate, FORMULA_PLACEHOLDER_SRC, FORMULA_MARKER } from "@/lib/docxToText";
import ConventionEditor from "@/components/teacher/ConventionEditor";
import {
  X, Check, Clock, Eye, EyeOff,
  FileUp, ChevronDown, AlertTriangle, PencilLine, Lightbulb,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid() { return `q_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`; }

// ISO string → value for <input type="datetime-local"> (local time)
function isoToLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Text import panel ("Soạn từ văn bản / Import Word") ──────────────────────

const PARSED_TYPE_META: Record<string, { label: string; cls: string }> = {
  multiple_choice: { label: "Trắc nghiệm", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  true_false:      { label: "Đúng sai",    cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  fill_blank:      { label: "Trả lời ngắn",cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  essay:           { label: "Tự luận",     cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
};

function FormatGuide({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className={`rounded-xl border border-border bg-card shadow-lg ${open ? "" : "hidden"}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors rounded-xl"
      >
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        Hướng dẫn định dạng
      </button>
      {open && (
        <div className="px-4 pb-3 text-xs text-muted-foreground space-y-2 leading-relaxed">
          <p>• Mỗi câu bắt đầu bằng <code className="bg-muted px-1 rounded font-mono">Câu 1.</code>, <code className="bg-muted px-1 rounded font-mono">Câu 2.</code>…</p>
          <p>• Đề bài nằm <strong className="text-foreground">TRÊN</strong> dòng <code className="bg-muted px-1 rounded font-mono">Lời giải</code>, phần giải thích nằm <strong className="text-foreground">DƯỚI</strong>.</p>
          <p>• <strong className="text-foreground">Trắc nghiệm:</strong> các phương án <code className="bg-muted px-1 rounded font-mono">A.</code> <code className="bg-muted px-1 rounded font-mono">B.</code> <code className="bg-muted px-1 rounded font-mono">C.</code> <code className="bg-muted px-1 rounded font-mono">D.</code> — thêm dấu <code className="bg-muted px-1 rounded font-mono">*</code> trước đáp án đúng (VD: <code className="bg-muted px-1 rounded font-mono">*C. 12</code>).</p>
          <p>• <strong className="text-foreground">Đúng sai:</strong> các mệnh đề <code className="bg-muted px-1 rounded font-mono">a)</code> <code className="bg-muted px-1 rounded font-mono">b)</code> <code className="bg-muted px-1 rounded font-mono">c)</code> <code className="bg-muted px-1 rounded font-mono">d)</code> — thêm dấu <code className="bg-muted px-1 rounded font-mono">*</code> trước mệnh đề <strong className="text-foreground">đúng</strong>.</p>
          <p>• <strong className="text-foreground">Trả lời ngắn:</strong> sau dòng <code className="bg-muted px-1 rounded font-mono">Lời giải</code> có dòng <code className="bg-muted px-1 rounded font-mono">Đáp án: &lt;con số&gt;</code>.</p>
          <p>• Câu không khớp định dạng nào → <strong className="text-foreground">tự luận</strong>.</p>
          <p>• Dòng <code className="bg-muted px-1 rounded font-mono">Phần …</code> trước câu hỏi được coi là tiêu đề nhóm.</p>
          <p>• <strong className="text-foreground">Công thức toán:</strong> gõ LaTeX giữa hai dấu <code className="bg-muted px-1 rounded font-mono">$…$</code> (VD: <code className="bg-muted px-1 rounded font-mono">{"$\\frac{1}{2}$"}</code>). Dùng <code className="bg-muted px-1 rounded font-mono">$$…$$</code> cho công thức trên dòng riêng.</p>
          <p>• <strong className="text-foreground">Hình ảnh:</strong> chèn <code className="bg-muted px-1 rounded font-mono">[img:url]</code> (tự động chèn khi nhập từ file Word).</p>
          <p>• <strong className="text-foreground">Token rút gọn:</strong> khi nhập từ Word, công thức dài và ảnh được thay bằng token ngắn <code className="bg-muted px-1 rounded font-mono">[m:1]</code>, <code className="bg-muted px-1 rounded font-mono">[img:2]</code>… để văn bản gọn gàng. Nội dung đầy đủ vẫn hiển thị ở thẻ câu hỏi bên trái — nhấn nút sửa cạnh công thức trong mục &ldquo;Công thức trong câu này&rdquo; để chỉnh LaTeX.</p>
        </div>
      )}
    </div>
  );
}

// Text quy ước → HTML render đầy đủ (token registry + $...$ KaTeX + [img:url])
function fieldToHtml(text: string, registry: ExamAssetRegistry): string {
  const resolved = resolveRegistryTokens(text || "", registry);
  const esc = resolved.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const withImgs = esc.replace(/\[img:(https?:\/\/[^\]\s]+|data:image\/[^\]\s]+)\]/g,
    (_, url) => `<img src="${url.replace(/"/g, "&quot;")}" alt="hình" class="inline-block max-h-48 rounded-lg my-1" />`);
  return renderMathInHtml(withImgs).replace(/\n/g, "<br/>");
}

// Trường "render trước, bấm để sửa" (kiểu Azota): mặc định hiện công thức/ảnh
// đã render; click vào → textarea nguồn; blur → quay lại bản render.
function RenderedField({ value, onChange, registry, placeholder, className = "", textClassName = "" }: {
  value: string; onChange: (v: string) => void; registry: ExamAssetRegistry;
  placeholder?: string; className?: string; textClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <AutoGrowTextarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${textClassName} border-primary/40 bg-background`}
        autoFocus
        onBlur={() => setEditing(false)}
      />
    );
  }
  return (
    <div
      onClick={() => setEditing(true)}
      title="Nhấn để sửa"
      className={`min-h-[30px] px-2 py-1.5 rounded-lg border border-transparent hover:border-border hover:bg-background/60 cursor-text text-sm leading-relaxed text-foreground transition-colors ${className}`}
    >
      {value.trim()
        ? <span dangerouslySetInnerHTML={{ __html: fieldToHtml(value, registry) }} />
        : <span className="text-muted-foreground">{placeholder}</span>}
    </div>
  );
}

function AutoGrowTextarea({ value, onChange, placeholder, className, autoFocus, onBlur }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
  autoFocus?: boolean; onBlur?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={2}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      spellCheck={false}
      autoFocus={autoFocus}
      onBlur={onBlur}
      className={`w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm leading-relaxed text-foreground outline-none focus:border-border focus:bg-background transition-colors ${className ?? ""}`}
    />
  );
}

// Thu thập id token [m:N] xuất hiện trong một câu (đề, phương án, mệnh đề, lời giải)
function collectMathTokenIds(q: ParsedQuestion): string[] {
  const parts = [q.content, ...(q.options ?? []), ...(q.statements ?? []).map(s => s.text), q.solution ?? ""];
  const ids: string[] = [];
  for (const p of parts) {
    MATH_TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MATH_TOKEN_RE.exec(p)) !== null) {
      if (!ids.includes(m[1])) ids.push(m[1]);
    }
  }
  return ids;
}

function renderTexPreview(tex: string): string {
  const escaped = `$${tex}$`.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return renderMathInHtml(escaped);
}

// Danh sách "Công thức trong câu này": mỗi token [m:N] = chip KaTeX đã render,
// nhấn nút sửa → textarea LaTeX + preview trực tiếp, thay đổi ghi thẳng vào registry.
function TokenFormulaList({ ids, registry, onUpdateTex }: {
  ids: string[];
  registry: ExamAssetRegistry;
  onUpdateTex: (id: string, tex: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  if (ids.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5 space-y-1">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Công thức trong câu này</p>
      {ids.map(id => {
        const entry = registry[id];
        const tex = entry?.kind === "math" ? entry.tex : "";
        const editing = editingId === id;
        return (
          <div key={id} className="space-y-1">
            <div className="flex items-center gap-2">
              <code className="text-[10px] font-mono text-muted-foreground shrink-0 bg-muted px-1 rounded">[m:{id}]</code>
              {entry?.kind === "math" ? (
                <button
                  onClick={() => setEditingId(editing ? null : id)}
                  title="Nhấn để sửa LaTeX"
                  className={`flex-1 min-w-0 text-left px-2 py-0.5 rounded-md text-sm text-foreground overflow-x-auto border transition-colors ${editing ? "border-primary bg-primary/5" : "border-transparent hover:border-border hover:bg-background"}`}
                  dangerouslySetInnerHTML={{ __html: renderTexPreview(tex) }}
                />
              ) : (
                <span className="text-[11px] text-amber-600 dark:text-amber-400">Không tìm thấy công thức trong registry</span>
              )}
              {entry?.kind === "math" && (
                <button
                  onClick={() => setEditingId(editing ? null : id)}
                  className={`p-1 rounded shrink-0 transition-colors ${editing ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                  title="Sửa LaTeX"
                >
                  <PencilLine className="h-3 w-3" />
                </button>
              )}
            </div>
            {editing && entry?.kind === "math" && (
              <textarea
                value={tex}
                onChange={e => onUpdateTex(id, e.target.value)}
                rows={2}
                spellCheck={false}
                placeholder="LaTeX…"
                className="w-full resize-y rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Một thẻ câu hỏi có thể chỉnh sửa trực tiếp (kiểu Azota)
function ParsedQuestionCard({ q, num, update, registry, onUpdateTex }: {
  q: ParsedQuestion; num: number;
  update: (patch: Partial<ParsedQuestion>) => void;
  registry: ExamAssetRegistry;
  onUpdateTex: (id: string, tex: string) => void;
}) {
  const meta = PARSED_TYPE_META[q.type];
  const [solutionOpen, setSolutionOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-primary/10 text-primary">Câu {num}</span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
        {q.warnings.map((w, wi) => (
          <span key={wi} className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3 shrink-0" />{w}
          </span>
        ))}
      </div>

      {/* Nội dung câu hỏi — render sẵn, nhấn để sửa nguồn */}
      <RenderedField
        value={q.content}
        onChange={v => update({ content: v })}
        registry={registry}
        placeholder="Nội dung câu hỏi…"
        className="font-medium"
        textClassName="font-medium"
      />

      {/* Trắc nghiệm A-D */}
      {q.type === "multiple_choice" && q.options && (
        <div className="space-y-1">
          {q.options.map((opt, oi) => {
            const correct = q.correctOption === oi;
            return (
              <div key={oi}>
              <div className={`flex items-center gap-2 px-2 py-1 rounded-lg border transition-colors ${correct ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "border-border bg-background"}`}>
                <button
                  onClick={() => update({ correctOption: oi })}
                  title="Nhấn để chọn đáp án đúng"
                  className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 text-[11px] font-bold transition-colors ${correct ? "border-emerald-500 bg-emerald-500 text-white" : "border-border text-muted-foreground hover:border-emerald-400"}`}
                >
                  {["A", "B", "C", "D"][oi] ?? String(oi + 1)}
                </button>
                <div className="flex-1 min-w-0">
                  <RenderedField
                    value={opt}
                    onChange={v => {
                      const opts = [...q.options!];
                      opts[oi] = v;
                      update({ options: opts });
                    }}
                    registry={registry}
                    placeholder={`Lựa chọn ${["A", "B", "C", "D"][oi] ?? oi + 1}…`}
                    className="min-h-[26px] py-0.5"
                  />
                </div>
              </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Đúng sai a-d */}
      {q.type === "true_false" && q.statements && (
        <div className="space-y-1">
          {q.statements.map((st, si) => (
            <div key={si}>
            <div className={`flex items-center gap-2 px-2 py-1 rounded-lg border transition-colors ${st.correct ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "border-border bg-background"}`}>
              <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{String.fromCharCode(97 + si)})</span>
              <div className="flex-1 min-w-0">
                <RenderedField
                  value={st.text}
                  onChange={v => update({ statements: q.statements!.map((s, idx) => idx === si ? { ...s, text: v } : s) })}
                  registry={registry}
                  placeholder={`Mệnh đề ${String.fromCharCode(97 + si)}…`}
                  className="min-h-[26px] py-0.5"
                />
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => update({ statements: q.statements!.map((s, idx) => idx === si ? { ...s, correct: true } : s) })}
                  className={`px-2 h-6 rounded-full text-[11px] font-semibold border transition-colors ${st.correct ? "border-emerald-500 bg-emerald-500 text-white" : "border-border text-muted-foreground hover:border-emerald-400"}`}
                >Đ</button>
                <button
                  onClick={() => update({ statements: q.statements!.map((s, idx) => idx === si ? { ...s, correct: false } : s) })}
                  className={`px-2 h-6 rounded-full text-[11px] font-semibold border transition-colors ${!st.correct ? "border-red-500 bg-red-500 text-white" : "border-border text-muted-foreground hover:border-red-400"}`}
                >S</button>
              </div>
            </div>
            </div>
          ))}
        </div>
      )}

      {/* Trả lời ngắn */}
      {q.type === "fill_blank" && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground shrink-0">Đáp án:</span>
          <input
            value={q.shortAnswer ?? ""}
            onChange={e => update({ shortAnswer: e.target.value })}
            placeholder="Đáp án…"
            className="w-40 h-7 px-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-sm text-emerald-700 dark:text-emerald-400 font-medium outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        </div>
      )}

      {/* Lời giải (collapsible) */}
      <div className="border-t border-border/60 pt-1.5">
        <button
          onClick={() => setSolutionOpen(o => !o)}
          className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${solutionOpen ? "" : "-rotate-90"}`} />
          Lời giải{q.solution ? "" : " (trống)"}
        </button>
        {solutionOpen ? (
          <RenderedField
            value={q.solution ?? ""}
            onChange={v => update({ solution: v || undefined })}
            registry={registry}
            placeholder="Lời giải / giải thích…"
            className="mt-1 text-xs"
            textClassName="text-xs"
          />
        ) : q.solution ? (
          <p className="text-[11px] text-muted-foreground mt-0.5 px-2 line-clamp-1">
            💡 <span dangerouslySetInnerHTML={{ __html: fieldToHtml(q.solution, registry) }} />
          </p>
        ) : null}
      </div>

      {/* Công thức token hoá [m:N] trong câu — nhấn để sửa LaTeX */}
      <TokenFormulaList ids={collectMathTokenIds(q)} registry={registry} onUpdateTex={onUpdateTex} />
    </div>
  );
}

function TextImportPanel({ text, setText, registry, setRegistry, parsed, setParsed, classId }: {
  text: string;
  setText: (t: string) => void;
  registry: ExamAssetRegistry;
  setRegistry: React.Dispatch<React.SetStateAction<ExamAssetRegistry>>;
  parsed: ParseResult | null;
  setParsed: (p: ParseResult | null) => void;
  classId: string;
}) {
  const [importing, setImporting] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  // Số công thức dạng ảnh (MathType/WMF) không tự chuyển được trong lần import gần nhất
  const [formulaCount, setFormulaCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  // Nguồn thay đổi gần nhất: "text" (gõ bên phải) hay "cards" (sửa thẻ bên trái).
  // Khi sửa từ thẻ, text đã được serialize từ parsed → bỏ qua lượt parse kế tiếp để tránh vòng lặp.
  const sourceRef = useRef<"text" | "cards">("text");

  // Phải → trái: gõ ở textarea → debounce 350ms → parse → cập nhật thẻ
  useEffect(() => {
    if (sourceRef.current === "cards") {
      sourceRef.current = "text";
      return;
    }
    const t = setTimeout(() => {
      setParsed(text.trim() ? parseExamText(text) : null);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Trái → phải: sửa thẻ → cập nhật parsed ngay + serialize vào textarea
  const updateQuestion = (i: number, patch: Partial<ParsedQuestion>) => {
    if (!parsed) return;
    const questions = parsed.questions.map((q, idx) => idx === i ? { ...q, ...patch } : q);
    setParsed({ ...parsed, questions });
    sourceRef.current = "cards";
    setText(parsedToText(questions));
  };

  const handleDocx = async (file: File) => {
    setImporting(true);
    setFormulaCount(0);
    try {
      let arrayBuffer = await file.arrayBuffer();
      // Tự chuyển công thức MathType (OLE/MTEF) → $LaTeX$ trước khi mammoth xử lý.
      // Công thức không chuyển được vẫn đi theo đường placeholder WMF bên dưới.
      try {
        const { preprocessDocxEquations } = await import("@/lib/docxToText");
        arrayBuffer = await preprocessDocxEquations(arrayBuffer);
      } catch {
        // bỏ qua — dùng file gốc
      }
      const mammoth = await import("mammoth");
      // Ảnh PNG/JPEG/GIF/WebP → upload lên storage, trả về URL công khai.
      // WMF/EMF (công thức MathType) hoặc upload lỗi → placeholder để đánh dấu.
      const convertImage = mammoth.images.imgElement(async img => {
        const ct = (img.contentType || "").toLowerCase();
        if (/^image\/(png|jpe?g|gif|webp)$/.test(ct)) {
          try {
            const b64 = await img.readAsBase64String();
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const ext = ct.split("/")[1].replace("jpeg", "jpg");
            const f = new File([bytes], `docx_img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`, { type: ct });
            const up = await uploadClassFile(f, classId, "materials");
            return { src: up.url };
          } catch {
            return { src: FORMULA_PLACEHOLDER_SRC };
          }
        }
        return { src: FORMULA_PLACEHOLDER_SRC };
      });
      const { value } = await mammoth.convertToHtml({ arrayBuffer }, { convertImage });
      // Bỏ phần rác đầu đề (tên trường, "Thời gian làm bài…", "Họ tên thí sinh…"…)
      const converted = stripExamBoilerplate(docxHtmlToConventionText(value));
      setFormulaCount(converted.split(FORMULA_MARKER).length - 1);
      // Token hoá: $LaTeX$ dài → [m:N], [img:url] → [img:N]; nội dung đầy đủ vào registry
      const tokenized = tokenizeConventionText(converted);
      setRegistry(tokenized.registry);
      // Chuẩn hoá bố cục (mỗi phương án một dòng, đánh số nhất quán) — an toàn với token
      setText(normalizeConventionText(tokenized.text));
    } catch {
      alert("Không đọc được file Word. Vui lòng kiểm tra file .docx.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const questions = parsed?.questions ?? [];
  const typeCounts = questions.reduce<Record<string, number>>((acc, q) => {
    acc[q.type] = (acc[q.type] ?? 0) + 1;
    return acc;
  }, {});

  const updateTex = (id: string, tex: string) =>
    setRegistry(r => ({ ...r, [id]: { kind: "math", tex } }));

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* ── LEFT: thẻ câu hỏi live (≈55%) ── */}
        <div className="lg:w-[55%] w-full flex flex-col min-h-0 border-r border-border bg-muted/10">
          <div className="px-4 py-2.5 border-b border-border shrink-0 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Câu hỏi ({questions.length})
            </span>
            {Object.entries(typeCounts).map(([t, n]) => (
              <span key={t} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PARSED_TYPE_META[t].cls}`}>
                {PARSED_TYPE_META[t].label}: {n}
              </span>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {parsed?.errors.map((err, i) => (
              <div key={"err" + i} className="flex items-start gap-2 px-3 py-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800/50 text-xs text-red-700 dark:text-red-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{err}</span>
              </div>
            ))}
            {(parsed?.sections.length ?? 0) > 0 && (
              <p className="text-[10px] text-muted-foreground px-1">Tiêu đề nhóm: {parsed!.sections.join(" · ")}</p>
            )}
            {!parsed && (
              <p className="text-xs text-muted-foreground text-center py-10">
                Dán văn bản vào ô bên phải hoặc nhập file Word — câu hỏi sẽ hiện ở đây và có thể sửa trực tiếp.
              </p>
            )}
            {questions.map((pq, i) => (
              <ParsedQuestionCard key={i} q={pq} num={i + 1} update={patch => updateQuestion(i, patch)} registry={registry} onUpdateTex={updateTex} />
            ))}
          </div>
        </div>

        {/* ── RIGHT: soạn thảo văn bản thô (≈45%) ── */}
        <div className="lg:w-[45%] w-full flex flex-col min-h-0 relative">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleDocx(f); }}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
              <FileUp className="h-3.5 w-3.5 mr-1.5" />
              {importing ? "Đang đọc file…" : "Nhập từ file Word (.docx)"}
            </Button>
            <button
              onClick={() => {
                const normalized = normalizeConventionText(text);
                if (normalized !== text) {
                  // Cùng cơ chế cờ nguồn như khi sửa thẻ: text đã ở dạng chuẩn,
                  // parse ngay lập tức để hai bên đồng bộ, khỏi chờ debounce
                  sourceRef.current = "cards";
                  setParsed(normalized.trim() ? parseExamText(normalized) : null);
                  setText(normalized);
                }
              }}
              disabled={!text.trim()}
              title="Sắp xếp lại văn bản về bố cục chuẩn (mỗi phương án một dòng, đánh số nhất quán)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              <Check className="h-3.5 w-3.5" />
              Chuẩn hóa
            </button>
            <button
              onClick={() => setGuideOpen(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${guideOpen ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${guideOpen ? "" : "-rotate-90"}`} />
              Hướng dẫn định dạng
            </button>
          </div>

          {/* Guide overlay */}
          {guideOpen && (
            <div className="absolute top-12 left-3 right-3 z-10">
              <FormatGuide open onToggle={() => setGuideOpen(false)} />
            </div>
          )}

          {formulaCount > 0 && (
            <div className="flex items-start gap-2 mx-3 mt-2 px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/50 text-xs text-amber-700 dark:text-amber-400 shrink-0">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                File chứa {formulaCount} công thức dạng ảnh (MathType) không thể tự chuyển — hãy gõ lại công thức (dạng LaTeX giữa hai dấu $) tại các vị trí có marker &ldquo;{FORMULA_MARKER}&rdquo;.
              </span>
              <button onClick={() => setFormulaCount(0)} className="ml-auto shrink-0 p-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          <ConventionEditor
            value={text}
            onChange={setText}
            placeholder={"Câu 1. Giá trị của 2 + 2 là\nA. 3   *B. 4   C. 5   D. 6\nLời giải\n2 + 2 = 4 nên chọn B.\n\nCâu 2. Cho hàm số y = x². Xét các mệnh đề:\n*a) Hàm số đồng biến trên (0; +∞)\nb) Hàm số đồng biến trên R\n…"}
            questionCount={questions.length}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function ExamEditorModal({
  classId,
  initial,
  onSave,
  onClose,
}: {
  classId: string;
  initial?: Partial<CurriculumLesson>;
  onSave: (lesson: CurriculumLesson) => void | Promise<unknown>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [title,     setTitle]     = useState(initial?.title ?? "");
  const [timeLimit, setTimeLimit] = useState(initial?.exam_content?.time_limit?.toString() ?? "");
  const [opensAt,   setOpensAt]   = useState(isoToLocalInput(initial?.exam_opens_at));
  const [published, setPublished] = useState(initial?.is_published ?? true);
  // Cho học sinh xem lời giải sau khi nộp bài (mặc định: bật)
  const [showSolution, setShowSolution] = useState(initial?.exam_content?.show_solution_after_submit ?? true);

  // Đề đã lưu → văn bản quy ước + registry token (chỉ tính một lần khi mở modal)
  const [initialText] = useState(() => {
    const qs = initial?.exam_content?.questions;
    return qs?.length ? examQuestionsToText(qs) : { text: "", registry: {} as ExamAssetRegistry };
  });
  const [text,     setText]     = useState(initialText.text);
  const [registry, setRegistry] = useState<ExamAssetRegistry>(initialText.registry);
  const [parsed,   setParsed]   = useState<ParseResult | null>(
    () => initialText.text.trim() ? parseExamText(initialText.text) : null
  );

  const questions = parsed?.questions ?? [];
  const hasErrors = (parsed?.errors.length ?? 0) > 0;
  const canSave   = !!title.trim() && !hasErrors && questions.length > 0;

  // QUAN TRỌNG: phải CHỜ ghi xong lên server rồi mới đóng modal — nếu đóng/
  // điều hướng ngay, request ghi bị hủy giữa chừng và bài thi mất trên prod.
  const handleSave = async () => {
    if (!canSave || !parsed || saving) return;
    setSaving(true);
    try {
      await onSave({
        ...(initial as CurriculumLesson | undefined),
        id:           initial?.id ?? uid(),
        type:         "exam",
        title:        title.trim(),
        is_published: published,
        exam_opens_at: opensAt ? new Date(opensAt).toISOString() : undefined,
        exam_content: {
          // Giữ id câu hỏi cũ theo vị trí — bài học sinh đã nộp (chấm theo id)
          // không bị mồ côi sau mỗi lần giáo viên sửa đề
          questions: parsedToExamQuestions(parsed.questions, registry).map((q, i) => ({
            ...q,
            id: initial?.exam_content?.questions?.[i]?.id ?? q.id,
          })),
          time_limit: timeLimit ? parseInt(timeLimit) : undefined,
          show_solution_after_submit: showSolution,
        },
      });
      onClose();
    } catch {
      alert("Lưu bài thi thất bại — kiểm tra kết nối mạng rồi thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Tên bài thi… (VD: Kiểm tra 15 phút – Chương 3)"
          className="flex-1 font-semibold text-base bg-transparent outline-none text-foreground placeholder:text-muted-foreground min-w-0"
        />
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 border border-border rounded-lg px-2.5 py-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="number" min={1} value={timeLimit}
              onChange={e => setTimeLimit(e.target.value)}
              placeholder="--"
              className="w-10 text-xs bg-transparent outline-none text-center text-foreground"
            />
            <span className="text-xs text-muted-foreground">phút</span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 border border-border rounded-lg px-2.5 py-1.5" title="Tự động mở lúc">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Tự động mở lúc</span>
            <input
              type="datetime-local"
              value={opensAt}
              onChange={e => setOpensAt(e.target.value)}
              className="text-xs bg-transparent outline-none text-foreground"
            />
            {opensAt && (
              <button onClick={() => setOpensAt("")} className="p-0.5 rounded hover:bg-muted text-muted-foreground" title="Xoá giờ mở tự động">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-1.5 border border-border rounded-lg px-2.5 py-1.5" title="Mỗi câu 1 điểm">
            <span className="text-xs text-muted-foreground">Tổng:</span>
            <span className="text-xs font-semibold text-foreground">{questions.length}đ</span>
          </div>
          <button
            onClick={() => setShowSolution(s => !s)}
            title="Cho học sinh xem lời giải sau khi nộp bài"
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${showSolution ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Cho xem lời giải sau khi nộp</span>
            <span className={`inline-block h-3.5 w-6 rounded-full relative transition-colors ${showSolution ? "bg-amber-500" : "bg-muted-foreground/30"}`}>
              <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all ${showSolution ? "left-3" : "left-0.5"}`} />
            </span>
          </button>
          <button
            onClick={() => setPublished(p => !p)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${published ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            {published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{published ? "Hiển thị" : "Ẩn"}</span>
          </button>
          <Button variant="gradient" size="sm" onClick={handleSave} disabled={!canSave || saving}>
            {saving
              ? <><span className="h-3.5 w-3.5 mr-1.5 inline-block animate-spin rounded-full border-2 border-white border-t-transparent" />Đang lưu…</>
              : <><Check className="h-3.5 w-3.5 mr-1.5" />Lưu bài thi</>}
          </Button>
        </div>
      </div>

      {/* ── Body: trình soạn từ văn bản / import Word ── */}
      <div className="flex-1 min-h-0">
        <TextImportPanel
          text={text}
          setText={setText}
          registry={registry}
          setRegistry={setRegistry}
          parsed={parsed}
          setParsed={setParsed}
          classId={classId}
        />
      </div>
    </div>,
    document.body
  );
}
