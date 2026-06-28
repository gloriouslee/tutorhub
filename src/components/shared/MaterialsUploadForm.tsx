"use client";

import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Class } from "@/types";
import { createClient } from "@/lib/supabase/client";
import {
  Upload, FileText, PlayCircle, Image as ImageIcon,
  BookMarked, CheckCircle2, AlertCircle, X, Loader2,
} from "lucide-react";

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.ppt,.pptx,.mp4,.jpg,.jpeg,.png";

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  type: string;
  status: "uploading" | "done" | "error";
  url?: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getFileIcon(type: string) {
  if (type.includes("video")) return <PlayCircle className="h-4 w-4" />;
  if (type.includes("image")) return <ImageIcon className="h-4 w-4" />;
  if (type.includes("ppt")) return <BookMarked className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function getFileType(mime: string): string {
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("video")) return "video";
  if (mime.includes("image")) return "image";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "ppt";
  return "doc";
}

interface Props {
  classes: Class[];
  onSaved?: () => void;
}

type SaveState = "idle" | "saving" | "success" | "error";

export default function MaterialsUploadForm({ classes, onSaved }: Props) {
  const [selectedClass, setSelectedClass] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const supabase = createClient();

    for (const file of Array.from(fileList)) {
      const id = crypto.randomUUID();
      setFiles(prev => [...prev, { id, name: file.name, size: formatSize(file.size), type: getFileType(file.type), status: "uploading" }]);
      try {
        const path = `materials/${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage.from("class-materials").upload(path, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from("class-materials").getPublicUrl(data.path);
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: "done", url: publicUrl } : f));
      } catch {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: "error" } : f));
      }
    }
  };

  const handleSave = async () => {
    const doneFiles = files.filter(f => f.status === "done");
    if (!selectedClass || !title || doneFiles.length === 0) return;
    setSaveState("saving");
    try {
      const supabase = createClient();
      for (const file of doneFiles) {
        await supabase.from("materials").insert({
          class_id: selectedClass,
          title,
          description,
          file_url: file.url,
          file_type: file.type,
        });
      }
      setSaveState("success");
      setTitle("");
      setDescription("");
      setSelectedClass("");
      setFiles([]);
      onSaved?.();
      setTimeout(() => setSaveState("idle"), 3000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const doneCount = files.filter(f => f.status === "done").length;
  const uploadingCount = files.filter(f => f.status === "uploading").length;
  const canSave = selectedClass && title && doneCount > 0 && uploadingCount === 0 && saveState === "idle";

  return (
    <Card>
      <CardContent className="p-6 space-y-5">

        {/* Class + Title row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Lớp học *</label>
            <select
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
            >
              <option value="">Chọn lớp</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.class_name} — {c.subject}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tiêu đề *</label>
            <Input
              placeholder="VD: Bài giảng Chương 3 — Hàm số"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="h-10"
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Mô tả <span className="text-muted-foreground font-normal">(tuỳ chọn)</span></label>
          <textarea
            className="flex min-h-[72px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
            placeholder="Nội dung tài liệu này gồm..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl py-8 text-center cursor-pointer transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
          }`}
        >
          <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_TYPES} className="hidden" onChange={e => handleFiles(e.target.files)} />
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Kéo thả hoặc nhấn để chọn file</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, Word, PowerPoint, MP4, JPG, PNG</p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map(file => (
              <div key={file.id} className="flex items-center gap-3 px-3 py-2.5 bg-muted/30 rounded-lg border border-border">
                <div className="text-muted-foreground shrink-0">{getFileIcon(file.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{file.size}</p>
                </div>
                {file.status === "uploading" && <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />}
                {file.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                {file.status === "error" && <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />}
                <button onClick={() => setFiles(prev => prev.filter(f => f.id !== file.id))} className="text-muted-foreground hover:text-red-500 transition-colors shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Save button + feedback */}
        <div className="flex items-center gap-3">
          <Button className="flex-1 h-10" disabled={!canSave} onClick={handleSave}>
            {saveState === "saving" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saveState === "saving" ? "Đang lưu..." : `Lưu tài liệu${doneCount > 0 ? ` (${doneCount} file)` : ""}`}
          </Button>
          {saveState === "success" && (
            <div className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Đã lưu thành công
            </div>
          )}
          {saveState === "error" && (
            <div className="flex items-center gap-1.5 text-sm text-red-500 font-medium">
              <AlertCircle className="h-4 w-4" /> Lưu thất bại
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
