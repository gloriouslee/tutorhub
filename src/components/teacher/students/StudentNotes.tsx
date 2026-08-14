"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  createStudentNote,
  deleteStudentNote,
  listStudentNotes,
  updateStudentNote,
  type StudentNote,
  type StudentNoteTag,
  type StudentNoteVisibility,
} from "@/lib/student-notes";

const TAGS: { value: StudentNoteTag; label: string }[] = [
  { value: "general", label: "Chung" },
  { value: "academic", label: "Học tập" },
  { value: "attendance", label: "Chuyên cần" },
  { value: "homework", label: "Bài tập" },
  { value: "wellbeing", label: "Tâm lý & hỗ trợ" },
];

function RatingPicker({ value, onChange, disabled = false }: { value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Đánh giá học viên">
      {Array.from({ length: 5 }).map((_, index) => {
        const rating = index + 1;
        return <button key={rating} type="button" disabled={disabled} aria-label={`${rating} sao`} aria-pressed={value === rating}
          className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onChange(rating)}>
          <Star className={`h-5 w-5 ${rating <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
        </button>;
      })}
      <span className="ml-1 text-xs text-muted-foreground">{value}/5</span>
    </div>
  );
}

export default function StudentNotes({ studentId, classId }: { studentId: string; classId?: string | null }) {
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [tag, setTag] = useState<StudentNoteTag>("general");
  const [visibility, setVisibility] = useState<StudentNoteVisibility>("shared");
  const [editText, setEditText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setNotes(await listStudentNotes(studentId));
    } catch {
      setError("Không thể tải ghi chú. Hãy kiểm tra migration dữ liệu rồi thử lại.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { void load(); }, [load]);

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError("");
    try {
      const note = await createStudentNote({ studentId, classId, text: text.trim(), rating, tag, visibility });
      setNotes((current) => [note, ...current]);
      setText("");
      setRating(5);
    } catch {
      setError("Không thể lưu ghi chú. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(note: StudentNote) {
    if (!editText.trim()) return;
    setBusyId(note.id);
    try {
      const updated = await updateStudentNote(note.id, { text: editText.trim() });
      setNotes((current) => current.map((item) => item.id === note.id ? updated : item));
      setEditingId("");
    } catch {
      setError("Không thể cập nhật ghi chú.");
    } finally {
      setBusyId("");
    }
  }

  async function remove(note: StudentNote) {
    if (!window.confirm("Xóa ghi chú này? Thao tác không thể hoàn tác.")) return;
    setBusyId(note.id);
    try {
      await deleteStudentNote(note.id);
      setNotes((current) => current.filter((item) => item.id !== note.id));
    } catch {
      setError("Không thể xóa ghi chú.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/70">
        <CardContent className="p-5">
          <form onSubmit={addNote} className="space-y-4">
            <div>
              <h2 className="font-bold">Thêm ghi chú mới</h2>
              <p className="mt-1 text-xs text-muted-foreground">Ghi chú nội bộ chỉ giáo viên thấy; ghi chú chia sẻ sẽ xuất hiện với học viên và phụ huynh.</p>
            </div>
            <RatingPicker value={rating} onChange={setRating} disabled={saving} />
            <textarea rows={4} value={text} maxLength={4000} onChange={(event) => setText(event.target.value)}
              placeholder="Ghi lại quan sát, tiến bộ hoặc việc cần phối hợp…" className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-muted-foreground">Chủ đề
                <select value={tag} onChange={(event) => setTag(event.target.value as StudentNoteTag)} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground">
                  {TAGS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">Quyền hiển thị
                <select value={visibility} onChange={(event) => setVisibility(event.target.value as StudentNoteVisibility)} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground">
                  <option value="shared">Chia sẻ với học viên & phụ huynh</option><option value="private">Chỉ giáo viên</option>
                </select>
              </label>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">{visibility === "shared" ? "Nội dung này sẽ được chia sẻ." : "Nội dung này là ghi chú nội bộ."}</p>
              <Button type="submit" disabled={saving || text.trim().length < 2}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Lưu ghi chú</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert"><span>{error}</span><Button type="button" size="sm" variant="ghost" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" /> Thử lại</Button></div>}

      {loading ? <div className="flex items-center justify-center py-12 text-sm text-muted-foreground" role="status"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải ghi chú…</div>
        : notes.length === 0 ? <div className="rounded-2xl border-2 border-dashed border-border py-12 text-center text-sm text-muted-foreground">Chưa có ghi chú nào cho học viên này.</div>
        : <div className="space-y-3">{notes.map((note) => <Card key={note.id} className="border-border/70"><CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{TAGS.find((item) => item.value === note.tag)?.label ?? "Chung"}</Badge><Badge variant={note.visibility === "shared" ? "info" : "secondary"}>{note.visibility === "shared" ? <><Eye className="mr-1 h-3 w-3" />Đã chia sẻ</> : <><EyeOff className="mr-1 h-3 w-3" />Nội bộ</>}</Badge></div><div className="text-right text-[11px] text-muted-foreground"><p>{note.authorName}</p><time dateTime={note.createdAt}>{new Date(note.createdAt || note.date).toLocaleString("vi-VN")}</time></div></div>
          <div className="flex items-center gap-0.5" aria-label={`${note.rating} trên 5 sao`}>{Array.from({ length: 5 }).map((_, index) => <Star key={index} className={`h-3.5 w-3.5 ${index < note.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />)}</div>
          {editingId === note.id ? <div className="space-y-2"><textarea rows={3} value={editText} onChange={(event) => setEditText(event.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" /><div className="flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setEditingId("")}>Hủy</Button><Button type="button" size="sm" disabled={busyId === note.id || editText.trim().length < 2} onClick={() => void saveEdit(note)}>Lưu sửa đổi</Button></div></div>
            : <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.text}</p>}
          {note.isOwner && editingId !== note.id && <div className="flex justify-end gap-1 border-t border-border/60 pt-2"><Button type="button" size="sm" variant="ghost" onClick={() => { setEditingId(note.id); setEditText(note.text); }}><Pencil className="mr-1 h-3.5 w-3.5" />Sửa</Button><Button type="button" size="sm" variant="ghost" className="text-red-600" disabled={busyId === note.id} onClick={() => void remove(note)}><Trash2 className="mr-1 h-3.5 w-3.5" />Xóa</Button></div>}
        </CardContent></Card>)}</div>}
    </div>
  );
}
