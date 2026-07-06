"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Save, CheckCircle2 } from "lucide-react";
import { formatDate } from "./classDetail.types";
import { kvGet, kvUpdate } from "@/lib/storage";

export default function SessionNotesPanel({
  classId,
  dateStr,
  onClose,
}: {
  classId: string;
  dateStr: string;
  onClose: () => void;
}) {
  const storageKey = `tutorhub_session_notes_${classId}`;
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const notes = await kvGet<Record<string, string>>(storageKey, {});
        setNote(notes[dateStr] ?? "");
      } catch {}
    })();
  }, [storageKey, dateStr]);

  const handleSave = async () => {
    try {
      // Merge into the fresh document (kvUpdate) — don't clobber other dates' notes
      await kvUpdate<Record<string, string>>(storageKey, {}, notes => ({ ...notes, [dateStr]: note }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">Tài liệu buổi học</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(dateStr)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Ghi chú buổi học</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={5}
              className="w-full p-3 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              placeholder="Nội dung, nhận xét, lưu ý cho buổi học này..."
            />
          </div>
        </div>
        <div className="p-5 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Đã lưu
            </span>
          )}
          <div className="flex gap-3 ml-auto">
            <Button variant="outline" onClick={onClose}>Đóng</Button>
            <Button variant="gradient" onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />Lưu ghi chú
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
