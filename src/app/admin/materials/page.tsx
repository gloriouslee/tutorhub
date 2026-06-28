"use client";

import { useState, useRef } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared";
import { MOCK_CLASSES } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import {
  Upload, FileText, PlayCircle, Image as ImageIcon,
  BookMarked, Trash2, CheckCircle2, AlertCircle, X
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
  if (type.includes("video")) return <PlayCircle className="h-5 w-5" />;
  if (type.includes("image")) return <ImageIcon className="h-5 w-5" />;
  if (type.includes("presentation") || type.includes("powerpoint")) return <BookMarked className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

function getFileType(mime: string): string {
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("video")) return "video";
  if (mime.includes("image")) return "image";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "ppt";
  return "doc";
}

export default function TeacherMaterialsPage() {
  const [selectedClass, setSelectedClass] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const teacherClasses = MOCK_CLASSES.slice(0, 4);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const supabase = createClient();

    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
      const fileEntry: UploadedFile = {
        id,
        name: file.name,
        size: formatSize(file.size),
        type: getFileType(file.type),
        status: "uploading",
      };

      setUploadedFiles(prev => [...prev, fileEntry]);

      try {
        const path = `materials/${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage
          .from("class-materials")
          .upload(path, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from("class-materials")
          .getPublicUrl(data.path);

        setUploadedFiles(prev =>
          prev.map(f => f.id === id ? { ...f, status: "done", url: publicUrl } : f)
        );
      } catch {
        setUploadedFiles(prev =>
          prev.map(f => f.id === id ? { ...f, status: "error" } : f)
        );
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleSave = async () => {
    if (!selectedClass || !title || uploadedFiles.filter(f => f.status === "done").length === 0) return;

    const supabase = createClient();
    const doneFiles = uploadedFiles.filter(f => f.status === "done");

    for (const file of doneFiles) {
      await supabase.from("materials").insert({
        class_id: selectedClass,
        title,
        description,
        file_url: file.url,
        file_type: file.type,
      });
    }

    setTitle("");
    setDescription("");
    setSelectedClass("");
    setUploadedFiles([]);
    alert("Đã lưu tài liệu thành công!");
  };

  const doneCount = uploadedFiles.filter(f => f.status === "done").length;
  const canSave = selectedClass && title && doneCount > 0;

  return (
    <PortalLayout role="admin" userName="" pageTitle="Tải lên Tài liệu">
      <div className="space-y-6 max-w-3xl mx-auto">
        <SectionHeader
          title="Tải lên Tài liệu"
          subtitle="Upload tài liệu bài giảng cho học viên trong lớp của bạn"
        />

        <Card>
          <CardContent className="p-6 space-y-5">
            {/* Class selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Lớp học *</label>
              <select
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
              >
                <option value="">Chọn lớp học</option>
                {teacherClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.class_name} — {c.subject}</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Tiêu đề tài liệu *</label>
              <Input
                placeholder="VD: Bài giảng Chương 3 — Hàm số"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="h-11"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Mô tả</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Mô tả ngắn về nội dung tài liệu..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES}
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
              />
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-semibold text-foreground mb-1">Kéo thả file vào đây hoặc nhấn để chọn</p>
              <p className="text-sm text-muted-foreground">PDF, Word, PowerPoint, MP4, JPG, PNG</p>
            </div>

            {/* File list */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border">
                    <div className="text-muted-foreground">{getFileIcon(file.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{file.size}</p>
                    </div>
                    {file.status === "uploading" && (
                      <Badge variant="outline" className="text-blue-500 border-blue-200">Đang tải...</Badge>
                    )}
                    {file.status === "done" && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    )}
                    {file.status === "error" && (
                      <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                    )}
                    <button
                      onClick={() => setUploadedFiles(prev => prev.filter(f => f.id !== file.id))}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Button
              className="w-full h-11 font-bold"
              variant="gradient"
              disabled={!canSave}
              onClick={handleSave}
            >
              Lưu tài liệu ({doneCount} file)
            </Button>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
