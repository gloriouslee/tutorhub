"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExt from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Mathematics from "@tiptap/extension-mathematics";
import "katex/dist/katex.min.css";
import { Button } from "@/components/ui/button";
import type { ExamContent, ExamQuestion, CurriculumLesson } from "@/lib/storage";
import { uploadClassFile } from "@/lib/upload";
import { parseExamText, parsedToText, parsedToExamQuestions, tokenizeConventionText, resolveRegistryTokens, normalizeConventionText, MATH_TOKEN_RE, type ParseResult, type ParsedQuestion, type ExamAssetRegistry } from "@/lib/examTextParser";
import { renderMathInHtml, hasMath } from "@/lib/mathRender";
import { docxHtmlToConventionText, stripExamBoilerplate, FORMULA_PLACEHOLDER_SRC, FORMULA_MARKER } from "@/lib/docxToText";
import ConventionEditor from "@/components/teacher/ConventionEditor";
import {
  X, Check, Clock, Eye, EyeOff, Plus, Trash2,
  Bold, Italic, List, ListOrdered, AlignLeft, AlignCenter,
  AlignRight, Image as ImageIcon, Sigma, Heading2, Heading3,
  Minus, Undo, Redo, GripVertical, Tag, FileUp, ChevronDown,
  AlertTriangle, FileText, PencilLine,
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

function emptyQuestion(order: number): ExamQuestion {
  return {
    id: uid(),
    order,
    type: "multiple_choice",
    content_html: "",
    options: ["", "", "", ""],
    correct_option: 0,
    explanation_html: "",
    score: 1,
    difficulty: "medium",
    tags: [],
  };
}

const DIFFICULTY_META = {
  easy:   { label: "Dễ",        cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  medium: { label: "Trung bình",cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  hard:   { label: "Khó",       cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const TYPE_META = {
  multiple_choice: { label: "Trắc nghiệm" },
  essay:           { label: "Tự luận" },
  true_false:      { label: "Đúng / Sai" },
  fill_blank:      { label: "Điền khuyết" },
};

// ── Toolbar ────────────────────────────────────────────────────────────────────

function TbBtn({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`h-7 w-7 flex items-center justify-center rounded text-xs transition-colors
        ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

function Sep() { return <div className="w-px h-4 bg-border mx-0.5 shrink-0" />; }

function EditorToolbar({ editor, classId }: { editor: ReturnType<typeof useEditor>; classId: string }) {
  const insertImage = useCallback(async () => {
    if (!editor) return;
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      try {
        const up = await uploadClassFile(file as any, classId, "materials");
        editor.chain().focus().setImage({ src: up.url, alt: file.name }).run();
      } catch {
        editor.chain().focus().setImage({ src: URL.createObjectURL(file) }).run();
      }
    };
    input.click();
  }, [editor, classId]);

  if (!editor) return null;
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/20">
      <TbBtn onClick={() => editor.chain().focus().undo().run()} title="Hoàn tác"><Undo className="h-3.5 w-3.5" /></TbBtn>
      <TbBtn onClick={() => editor.chain().focus().redo().run()} title="Làm lại"><Redo className="h-3.5 w-3.5" /></TbBtn>
      <Sep />
      <TbBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Tiêu đề lớn"><Heading2 className="h-3.5 w-3.5" /></TbBtn>
      <TbBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Tiêu đề nhỏ"><Heading3 className="h-3.5 w-3.5" /></TbBtn>
      <Sep />
      <TbBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Đậm"><Bold className="h-3.5 w-3.5" /></TbBtn>
      <TbBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Nghiêng"><Italic className="h-3.5 w-3.5" /></TbBtn>
      <Sep />
      <TbBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Danh sách"><List className="h-3.5 w-3.5" /></TbBtn>
      <TbBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Danh sách có số"><ListOrdered className="h-3.5 w-3.5" /></TbBtn>
      <Sep />
      <TbBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Căn trái"><AlignLeft className="h-3.5 w-3.5" /></TbBtn>
      <TbBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Căn giữa"><AlignCenter className="h-3.5 w-3.5" /></TbBtn>
      <TbBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Căn phải"><AlignRight className="h-3.5 w-3.5" /></TbBtn>
      <Sep />
      <TbBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Kẻ ngang"><Minus className="h-3.5 w-3.5" /></TbBtn>
      <Sep />
      <TbBtn onClick={() => editor.commands.insertContent("$x^2$")} title="Công thức inline ($...$)"><Sigma className="h-3.5 w-3.5" /></TbBtn>
      <button
        onMouseDown={e => { e.preventDefault(); editor.commands.insertContent("$$\n\n$$"); }}
        className="px-1.5 h-7 flex items-center gap-1 rounded text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-mono"
        title="Công thức khối ($$...$$)"
      >$$</button>
      <Sep />
      <TbBtn onClick={insertImage} title="Chèn ảnh"><ImageIcon className="h-3.5 w-3.5" /></TbBtn>
    </div>
  );
}

// ── Rich text editor panel ────────────────────────────────────────────────────

function RichEditor({ content, onChange, placeholder, classId, minHeight = 160 }: {
  content: string; onChange: (html: string) => void;
  placeholder: string; classId: string; minHeight?: number;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ImageExt.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder }),
      Mathematics,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: { attributes: { class: "outline-none" } },
  });

  return (
    <div className="rich-editor border border-border rounded-xl overflow-hidden bg-background">
      <EditorToolbar editor={editor!} classId={classId} />
      <EditorContent
        editor={editor}
        style={{ minHeight }}
        className="px-4 py-3 text-sm text-foreground [&_.tiptap]:outline-none [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_h2]:text-xl [&_.tiptap_h2]:font-bold [&_.tiptap_h2]:my-2 [&_.tiptap_h3]:text-base [&_.tiptap_h3]:font-semibold [&_.tiptap_h3]:my-1.5 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5 [&_.tiptap_hr]:border-border [&_.tiptap_hr]:my-3 [&_.tiptap_img]:max-w-full [&_.tiptap_img]:rounded-lg [&_.tiptap_img]:my-2 [&_.tiptap_strong]:font-bold [&_.tiptap_em]:italic [&_.tiptap_p]:my-1"
      />
    </div>
  );
}

// ── Mini option editor (TipTap, no heading/lists — inline math + bold + italic + image) ──

function OptionEditor({ content, onChange, placeholder, classId, correct }: {
  content: string; onChange: (html: string) => void;
  placeholder: string; classId: string; correct: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, bulletList: false, orderedList: false, blockquote: false, codeBlock: false, horizontalRule: false }),
      ImageExt.configure({ inline: true, allowBase64: true }),
      Placeholder.configure({ placeholder }),
      Mathematics,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: { attributes: { class: "outline-none" } },
  });

  const insertImage = useCallback(async () => {
    if (!editor) return;
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      try {
        const up = await uploadClassFile(file as any, classId, "materials");
        editor.chain().focus().setImage({ src: up.url }).run();
      } catch {
        editor.chain().focus().setImage({ src: URL.createObjectURL(file) }).run();
      }
    };
    input.click();
  }, [editor, classId]);

  return (
    <div className="option-editor flex-1 min-w-0">
      {/* mini toolbar — shown on focus */}
      <div className={`flex items-center gap-0.5 mb-1 transition-opacity ${editor?.isFocused ? "opacity-100" : "opacity-0 pointer-events-none h-0 mb-0 overflow-hidden"}`}>
        <button onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleBold().run(); }}
          className={`h-5 w-5 flex items-center justify-center rounded text-[10px] transition-colors ${editor?.isActive("bold") ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
          <Bold className="h-3 w-3" />
        </button>
        <button onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleItalic().run(); }}
          className={`h-5 w-5 flex items-center justify-center rounded text-[10px] transition-colors ${editor?.isActive("italic") ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
          <Italic className="h-3 w-3" />
        </button>
        <button onMouseDown={e => { e.preventDefault(); editor?.commands.insertContent("$x^2$"); }}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors" title="Công thức ($...)">
          <Sigma className="h-3 w-3" />
        </button>
        <button onMouseDown={e => { e.preventDefault(); insertImage(); }}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors" title="Chèn ảnh">
          <ImageIcon className="h-3 w-3" />
        </button>
      </div>
      <EditorContent
        editor={editor}
        className={`text-sm [&_.tiptap]:outline-none [&_.tiptap_strong]:font-bold [&_.tiptap_em]:italic [&_.tiptap_img]:max-h-24 [&_.tiptap_img]:rounded [&_.tiptap_img]:inline [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 ${correct ? "[&_.tiptap_p.is-editor-empty:first-child::before]:text-emerald-400 dark:[&_.tiptap_p.is-editor-empty:first-child::before]:text-emerald-600" : "[&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground"}`}
      />
    </div>
  );
}

// ── Question answer area (depends on type) ────────────────────────────────────

function AnswerPanel({ q, update, classId }: {
  q: ExamQuestion; update: (patch: Partial<ExamQuestion>) => void; classId: string;
}) {
  const OPTS = ["A", "B", "C", "D"];

  if (q.type === "multiple_choice") {
    const opts = q.options ?? ["", "", "", ""];
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground mb-2">Nhấn vòng tròn để chọn đáp án đúng · Hỗ trợ <code className="bg-muted px-0.5 rounded font-mono">$...$</code> và ảnh</p>
        {opts.map((opt, i) => {
          const correct = q.correct_option === i;
          return (
            <div
              key={q.id + "_opt_" + i}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-colors ${correct ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "border-border bg-background hover:border-border-strong"}`}
            >
              <button
                onMouseDown={e => { e.preventDefault(); update({ correct_option: i }); }}
                className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold transition-colors ${correct ? "border-emerald-500 bg-emerald-500 text-white" : "border-border text-muted-foreground hover:border-primary"}`}
              >
                {correct ? <Check className="h-3.5 w-3.5" /> : OPTS[i]}
              </button>
              <OptionEditor
                key={q.id + "_opt_editor_" + i}
                content={opt}
                onChange={html => { const o = [...opts]; o[i] = html; update({ options: o }); }}
                placeholder={`Lựa chọn ${OPTS[i]}…`}
                classId={classId}
                correct={correct}
              />
            </div>
          );
        })}
      </div>
    );
  }

  if (q.type === "true_false") {
    // Đúng sai nhiều mệnh đề (a/b/c/d) — soạn từ văn bản
    if (q.statements && q.statements.length > 0) {
      const statements = q.statements;
      const setStatement = (i: number, patch: Partial<{ text: string; correct: boolean }>) => {
        update({ statements: statements.map((st, idx) => idx === i ? { ...st, ...patch } : st) });
      };
      return (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground mb-2">Đúng sai nhiều mệnh đề — nhấn Đ/S để đặt đáp án cho từng mệnh đề</p>
          {statements.map((st, i) => (
            <div key={q.id + "_st_" + i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-colors ${st.correct ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "border-border bg-background"}`}>
              <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{String.fromCharCode(97 + i)})</span>
              <input
                value={st.text}
                onChange={e => setStatement(i, { text: e.target.value })}
                placeholder={`Mệnh đề ${String.fromCharCode(97 + i)}…`}
                className="flex-1 min-w-0 h-8 px-2 rounded-lg border border-transparent bg-transparent text-sm outline-none focus:border-border focus:bg-background text-foreground"
              />
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setStatement(i, { correct: true })}
                  className={`px-2.5 h-7 rounded-lg text-xs font-semibold border transition-colors ${st.correct ? "border-emerald-500 bg-emerald-500 text-white" : "border-border text-muted-foreground hover:border-emerald-400"}`}
                >Đ</button>
                <button
                  onClick={() => setStatement(i, { correct: false })}
                  className={`px-2.5 h-7 rounded-lg text-xs font-semibold border transition-colors ${!st.correct ? "border-red-500 bg-red-500 text-white" : "border-border text-muted-foreground hover:border-red-400"}`}
                >S</button>
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="flex gap-3">
        {(["true", "false"] as const).map(v => (
          <button
            key={v}
            onClick={() => update({ correct_value: v })}
            className={`flex-1 py-4 rounded-xl border-2 text-sm font-semibold transition-colors ${q.correct_value === v
              ? v === "true" ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                             : "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
              : "border-border text-muted-foreground hover:border-primary/50"}`}
          >
            {v === "true" ? "✓ Đúng" : "✗ Sai"}
          </button>
        ))}
      </div>
    );
  }

  if (q.type === "fill_blank") {
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Đáp án đúng (học viên phải điền chính xác)</label>
        <input
          value={q.correct_value ?? ""}
          onChange={e => update({ correct_value: e.target.value })}
          placeholder="Nhập đáp án chuẩn…"
          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
        />
        <p className="text-xs text-muted-foreground">Hệ thống sẽ so sánh chính xác chuỗi ký tự (không phân biệt hoa/thường).</p>
      </div>
    );
  }

  // essay
  return (
    <RichEditor
      key={q.id + "_answer"}
      content={q.answer_html ?? ""}
      onChange={html => update({ answer_html: html })}
      placeholder="Soạn đáp án / hướng dẫn chấm…"
      classId={classId}
      minHeight={200}
    />
  );
}

// ── Settings panel ────────────────────────────────────────────────────────────

function SettingsPanel({ q, update }: { q: ExamQuestion; update: (patch: Partial<ExamQuestion>) => void }) {
  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    update({ tags: [...(q.tags ?? []), t] });
    setTagInput("");
  };

  const removeTag = (i: number) => update({ tags: (q.tags ?? []).filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      {/* Score */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-2">Điểm số</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0} step={0.5}
            value={q.score}
            onChange={e => update({ score: parseFloat(e.target.value) || 0 })}
            className="w-24 h-9 px-3 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40 text-center text-foreground"
          />
          <span className="text-sm text-muted-foreground">điểm</span>
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-2">Độ khó</label>
        <div className="flex gap-2">
          {(Object.entries(DIFFICULTY_META) as [ExamQuestion["difficulty"] & string, typeof DIFFICULTY_META["easy"]][]).map(([k, v]) => (
            <button
              key={k}
              onClick={() => update({ difficulty: k as ExamQuestion["difficulty"] })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${q.difficulty === k ? `${v.cls} ring-2 ring-offset-1 ring-primary/40` : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-2">
          <Tag className="h-3 w-3 inline mr-1" />Nhãn (dùng cho ngân hàng câu hỏi)
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(q.tags ?? []).map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">
              {tag}
              <button onClick={() => removeTag(i)} className="hover:text-red-500 transition-colors ml-0.5"><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="VD: Đạo hàm, Chương 3…"
            className="flex-1 h-9 px-3 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
          />
          <Button size="sm" variant="outline" onClick={addTag}><Plus className="h-3.5 w-3.5" /></Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">Nhấn Enter hoặc nút + để thêm nhãn.</p>
      </div>
    </div>
  );
}

// ── Question editor (right panel) ─────────────────────────────────────────────

type EditorTab = "content" | "answer" | "explanation" | "settings";

const EDITOR_TABS: { key: EditorTab; label: string }[] = [
  { key: "content",     label: "📝 Đề bài" },
  { key: "answer",      label: "✅ Đáp án" },
  { key: "explanation", label: "💡 Giải thích" },
  { key: "settings",    label: "⚙ Cài đặt" },
];

function QuestionEditor({ q, update, classId }: {
  q: ExamQuestion; update: (patch: Partial<ExamQuestion>) => void; classId: string;
}) {
  const [tab, setTab] = useState<EditorTab>("content");

  return (
    <div className="flex flex-col h-full">
      {/* Type selector */}
      <div className="flex flex-wrap gap-1.5 px-4 py-3 border-b border-border bg-muted/20">
        {(Object.entries(TYPE_META) as [ExamQuestion["type"], { label: string }][]).map(([k, v]) => (
          <button
            key={k}
            onClick={() => update({ type: k })}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${q.type === k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-4 bg-card">
        {EDITOR_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {tab === "content" && (
          <RichEditor
            key={q.id + "_content"}
            content={q.content_html}
            onChange={html => update({ content_html: html })}
            placeholder="Soạn đề bài… Gõ $x^2$ để chèn công thức inline, $$…$$ để chèn công thức khối."
            classId={classId}
            minHeight={200}
          />
        )}

        {tab === "answer" && (
          <AnswerPanel q={q} update={update} classId={classId} />
        )}

        {tab === "explanation" && (
          <RichEditor
            key={q.id + "_expl"}
            content={q.explanation_html ?? ""}
            onChange={html => update({ explanation_html: html })}
            placeholder="Giải thích cách làm, lý do đáp án đúng… (tuỳ chọn)"
            classId={classId}
            minHeight={200}
          />
        )}

        {tab === "settings" && (
          <SettingsPanel q={q} update={update} />
        )}
      </div>
    </div>
  );
}

// ── Question list item ────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

function QCard({ q, index, selected, onSelect, onDelete }: {
  q: ExamQuestion; index: number; selected: boolean;
  onSelect: () => void; onDelete: () => void;
}) {
  const diff = DIFFICULTY_META[q.difficulty ?? "medium"];
  const preview = stripHtml(q.content_html) || "Câu hỏi chưa có nội dung";

  return (
    <div
      onClick={onSelect}
      className={`group relative px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${selected ? "border-primary/50 bg-primary/5" : "border-border bg-card hover:border-primary/30 hover:bg-muted/30"}`}
    >
      <div className="flex justify-between items-center mb-1">
        <span className={`text-xs font-semibold ${selected ? "text-primary" : "text-muted-foreground"}`}>
          Câu {index + 1}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${diff.cls}`}>{diff.label}</span>
          <span className="text-[10px] text-muted-foreground font-medium">{q.score}đ</span>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-red-500 transition-all"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <p className={`text-xs truncate ${selected ? "text-primary/80" : "text-muted-foreground"}`}>{preview}</p>
      {(q.tags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {q.tags!.slice(0, 3).map((tag, i) => (
            <span key={i} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
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

// Preview KaTeX nhỏ dưới ô nhập: hiện khi text chứa $...$ hoặc token [m:N],
// giữ ô nhập là LaTeX thô / token ngắn.
function MathHint({ text, registry, className = "" }: { text: string; registry?: ExamAssetRegistry; className?: string }) {
  const resolved = registry ? resolveRegistryTokens(text || "", registry) : (text || "");
  if (!resolved || !hasMath(resolved)) return null;
  const escaped = resolved.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return (
    <div
      className={`px-2 py-1 rounded-md bg-muted/40 text-xs text-foreground overflow-x-auto ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMathInHtml(escaped) }}
    />
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

function TextImportPanel({ text, setText, registry, setRegistry, onAppend, onReplace, classId }: {
  text: string;
  setText: (t: string) => void;
  registry: ExamAssetRegistry;
  setRegistry: React.Dispatch<React.SetStateAction<ExamAssetRegistry>>;
  onAppend: (qs: ExamQuestion[]) => void;
  onReplace: (qs: ExamQuestion[]) => void;
  classId: string;
}) {
  const [parsed,    setParsed]    = useState<ParseResult | null>(() => text.trim() ? parseExamText(text) : null);
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
  const hasErrors = (parsed?.errors.length ?? 0) > 0;
  const canImport = !hasErrors && questions.length > 0;
  const typeCounts = questions.reduce<Record<string, number>>((acc, q) => {
    acc[q.type] = (acc[q.type] ?? 0) + 1;
    return acc;
  }, {});

  const convert = () => parsedToExamQuestions(questions, registry);

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

          {/* Actions */}
          <div className="p-3 border-t border-border shrink-0 flex gap-2">
            <Button className="flex-1" variant="gradient" size="sm" disabled={!canImport} onClick={() => onAppend(convert())}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />Thêm {questions.length} câu vào đề
            </Button>
            <Button
              className="flex-1" variant="outline" size="sm" disabled={!canImport}
              onClick={() => {
                if (confirm("Thay thế TOÀN BỘ câu hỏi hiện có bằng các câu vừa soạn?")) onReplace(convert());
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />Thay thế toàn bộ
            </Button>
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
  onSave: (lesson: CurriculumLesson) => void;
  onClose: () => void;
}) {
  const [title,      setTitle]      = useState(initial?.title ?? "");
  const [timeLimit,  setTimeLimit]  = useState(initial?.exam_content?.time_limit?.toString() ?? "");
  const [opensAt,    setOpensAt]    = useState(isoToLocalInput(initial?.exam_opens_at));
  const [published,  setPublished]  = useState(initial?.is_published ?? true);
  const [questions,  setQuestions]  = useState<ExamQuestion[]>(
    initial?.exam_content?.questions?.length
      ? initial.exam_content.questions
      : [emptyQuestion(0)]
  );
  const [selectedId, setSelectedId] = useState(questions[0].id);
  const [mode,       setMode]       = useState<"manual" | "text">("manual");
  // Văn bản thô của chế độ "Soạn từ văn bản" — giữ ở đây để không mất khi chuyển qua lại giữa 2 chế độ
  const [importText, setImportText] = useState("");
  // Registry công thức/ảnh của các token [m:N]/[img:N] — giữ cùng chỗ với importText
  const [importRegistry, setImportRegistry] = useState<ExamAssetRegistry>({});

  // Nếu đề chỉ có 1 câu trống mặc định thì bỏ nó khi thêm câu từ văn bản
  const isPlaceholderOnly = (qs: ExamQuestion[]) =>
    qs.length === 1 && !qs[0].content_html.trim() && (qs[0].options ?? []).every(o => !o.trim());

  const appendParsed = (qs: ExamQuestion[]) => {
    if (qs.length === 0) return;
    setQuestions(prev => {
      const base = isPlaceholderOnly(prev) ? [] : prev;
      return [...base, ...qs].map((q, i) => ({ ...q, order: i }));
    });
    setSelectedId(qs[0].id);
    setMode("manual");
  };

  const replaceParsed = (qs: ExamQuestion[]) => {
    if (qs.length === 0) return;
    setQuestions(qs.map((q, i) => ({ ...q, order: i })));
    setSelectedId(qs[0].id);
    setMode("manual");
  };

  const totalScore = questions.reduce((s, q) => s + (q.score || 0), 0);
  const selectedQ  = questions.find(q => q.id === selectedId) ?? questions[0];

  const updateQ = useCallback((id: string, patch: Partial<ExamQuestion>) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
  }, []);

  const addQuestion = () => {
    const q = emptyQuestion(questions.length);
    setQuestions(prev => [...prev, q]);
    setSelectedId(q.id);
  };

  const deleteQuestion = (id: string) => {
    if (questions.length === 1) return;
    const idx = questions.findIndex(q => q.id === id);
    const next = questions.filter(q => q.id !== id);
    setQuestions(next);
    setSelectedId(next[Math.max(0, idx - 1)].id);
  };

  const handleSave = () => {
    if (!title.trim()) return;
    const lessonId = initial?.id ?? uid();
    onSave({
      ...(initial as CurriculumLesson | undefined),
      id:           lessonId,
      type:         "exam",
      title:        title.trim(),
      is_published: published,
      exam_opens_at: opensAt ? new Date(opensAt).toISOString() : undefined,
      exam_content: {
        questions: questions.map((q, i) => ({ ...q, order: i })),
        time_limit: timeLimit ? parseInt(timeLimit) : undefined,
      },
    });
    onClose();
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
          <div className="hidden sm:flex items-center gap-1.5 border border-border rounded-lg px-2.5 py-1.5">
            <span className="text-xs text-muted-foreground">Tổng:</span>
            <span className="text-xs font-semibold text-foreground">{totalScore}đ</span>
          </div>
          <button
            onClick={() => setPublished(p => !p)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${published ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            {published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{published ? "Hiển thị" : "Ẩn"}</span>
          </button>
          <Button variant="gradient" size="sm" onClick={handleSave} disabled={!title.trim()}>
            <Check className="h-3.5 w-3.5 mr-1.5" />Lưu bài thi
          </Button>
        </div>
      </div>

      {/* ── Mode toggle ── */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border bg-muted/10 shrink-0">
        {([
          { key: "manual" as const, label: "Soạn thủ công",                 icon: PencilLine },
          { key: "text"   as const, label: "Soạn từ văn bản / Import Word", icon: FileText },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setMode(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === t.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {mode === "text" ? (
        <div className="flex-1 min-h-0">
          <TextImportPanel text={importText} setText={setImportText} registry={importRegistry} setRegistry={setImportRegistry} onAppend={appendParsed} onReplace={replaceParsed} classId={classId} />
        </div>
      ) : (
      /* ── Body: sidebar + editor ── */
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <div className="w-56 shrink-0 border-r border-border flex flex-col bg-muted/10">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Câu hỏi ({questions.length})
            </span>
            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {totalScore}đ
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {questions.map((q, i) => (
              <QCard
                key={q.id}
                q={q}
                index={i}
                selected={q.id === selectedId}
                onSelect={() => setSelectedId(q.id)}
                onDelete={() => deleteQuestion(q.id)}
              />
            ))}
          </div>

          <button
            onClick={addQuestion}
            className="m-2 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />Thêm câu hỏi
          </button>
        </div>

        {/* Right editor */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="px-4 py-2 border-b border-border bg-muted/5 shrink-0">
            <span className="text-sm font-semibold text-foreground">
              Câu {questions.findIndex(q => q.id === selectedId) + 1}
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              {TYPE_META[selectedQ.type].label} · {selectedQ.score}đ · {DIFFICULTY_META[selectedQ.difficulty ?? "medium"].label}
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <QuestionEditor
              key={selectedId}
              q={selectedQ}
              update={patch => updateQ(selectedId, patch)}
              classId={classId}
            />
          </div>
        </div>
      </div>
      )}
    </div>,
    document.body
  );
}
