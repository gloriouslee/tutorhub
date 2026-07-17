"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadClassFile } from "@/lib/upload";
import { saveHomeworkAttachment, type HomeworkAttachment } from "@/lib/storage";
import { FileText, Upload, X, Check, Loader2, Users, User } from "lucide-react";
import type { Homework } from "./classDetail.types";

interface Student {
  id: string;
  full_name: string;
}

export default function HomeworkModal({
  classId,
  initial,
  defaultDueDate,
  students = [],
  onSave,
  onClose,
}: {
  classId: string;
  initial?: Partial<Homework>;
  defaultDueDate?: string;
  students?: Student[];
  onSave: (hw: Homework) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? (!initial ? defaultDueDate ?? "" : ""));
  const [file, setFile] = useState<File | null>(null);
  const [existingAttachment, setExistingAttachment] = useState<HomeworkAttachment | undefined>(initial?.attachment);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Assignment scope: "all" = cả lớp, "select" = chọn từng người
  const initialScope = initial?.assigned_to && initial.assigned_to.length > 0 ? "select" : "all";
  const [scope, setScope] = useState<"all" | "select">(initialScope);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initial?.assigned_to ?? [])
  );

  function toggleStudent(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const handleSubmit = async () => {
    if (!title.trim() || !dueDate) return;
    setUploading(true);
    setUploadError("");

    // Single id used for BOTH the attachment record and the homework object
    const hwId = initial?.id ?? `hw_${Date.now()}`;

    let attachment: HomeworkAttachment | undefined = existingAttachment;
    if (file) {
      try {
        const uploaded = await uploadClassFile(file, classId, "homework");
        attachment = {
          homework_id: hwId,
          file_url: uploaded.url,
          file_name: uploaded.name,
          file_size: uploaded.size,
          file_type: uploaded.file_type,
        };
        await saveHomeworkAttachment(attachment);
      } catch (e: any) {
        setUploadError(e.message ?? "Lỗi tải lên file");
        setUploading(false);
        return;
      }
    }

    const hw: Homework = {
      id: hwId,
      class_id: classId,
      title: title.trim(),
      description: description.trim() || undefined,
      due_date: dueDate,
      created_at: initial?.created_at ?? new Date().toISOString(),
      attachment,
      assigned_to: scope === "select" ? Array.from(selectedIds) : null,
    };
    onSave(hw);
    setUploading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-semibold text-foreground">{initial?.id ? "Chỉnh sửa bài tập" : "Giao bài tập mới"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Tiêu đề <span className="text-red-500">*</span></label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Bài tập chương 5..." />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Hạn nộp <span className="text-red-500">*</span></label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Mô tả</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full p-3 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              placeholder="Mô tả nội dung bài tập..."
            />
          </div>
          {/* Assignment scope */}
          {students.length > 0 && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Giao cho</label>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${scope === "all" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                >
                  <Users className="h-4 w-4" /> Cả lớp
                </button>
                <button
                  type="button"
                  onClick={() => setScope("select")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${scope === "select" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                >
                  <User className="h-4 w-4" /> Chọn học viên
                </button>
              </div>
              {scope === "select" && (
                <div className="space-y-2 rounded-xl border border-border p-3 bg-muted/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{selectedIds.size}/{students.length} học viên được chọn</span>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setSelectedIds(selectedIds.size === students.length ? new Set() : new Set(students.map(s => s.id)))}
                    >
                      {selectedIds.size === students.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                    </button>
                  </div>
                  {students.map(s => (
                    <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        className="h-4 w-4 rounded accent-primary"
                      />
                      <span className="text-sm text-foreground">{s.full_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Đính kèm file</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button onClick={() => setFile(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : existingAttachment ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{existingAttachment.file_name}</p>
                  <p className="text-xs text-muted-foreground">File hiện tại · {existingAttachment.file_size}</p>
                </div>
                <button onClick={() => setExistingAttachment(undefined)} className="p-1 rounded hover:bg-muted text-muted-foreground" title="Gỡ file đính kèm">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                <p className="text-sm text-muted-foreground">Kéo thả hoặc nhấn để chọn file</p>
                <p className="text-xs text-muted-foreground mt-0.5">PDF, DOCX, PPTX · Tối đa 100MB</p>
              </button>
            )}
            {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
          </div>
        </div>
        <div className="p-5 border-t border-border bg-muted/20 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={uploading}>Hủy</Button>
          <Button variant="gradient" disabled={!title.trim() || !dueDate || uploading || (scope === "select" && selectedIds.size === 0)} onClick={handleSubmit}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            {initial?.id ? "Lưu thay đổi" : "Giao bài"}
          </Button>
        </div>
      </div>
    </div>
  );
}
