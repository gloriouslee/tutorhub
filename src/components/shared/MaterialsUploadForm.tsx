"use client";

import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Class } from "@/types";
import { MOCK_STUDENTS } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import {
  Upload, FileText, PlayCircle, Image as ImageIcon, BookMarked,
  CheckCircle2, AlertCircle, X, Loader2, Users, User, ChevronDown,
} from "lucide-react";

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.ppt,.pptx,.mp4,.jpg,.jpeg,.png";

type TargetRole = "all" | "student" | "parent" | "teacher";

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
  if (type === "video") return <PlayCircle className="h-4 w-4" />;
  if (type === "image") return <ImageIcon className="h-4 w-4" />;
  if (type === "ppt") return <BookMarked className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function getFileType(mime: string): string {
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("video")) return "video";
  if (mime.includes("image")) return "image";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "ppt";
  return "doc";
}

const ROLE_OPTIONS: { value: TargetRole; label: string; desc: string }[] = [
  { value: "all", label: "Tất cả", desc: "Mọi người trong lớp" },
  { value: "student", label: "Học viên", desc: "Chỉ học viên (có thể chọn cụ thể)" },
  { value: "parent", label: "Phụ huynh", desc: "Chỉ phụ huynh" },
  { value: "teacher", label: "Giáo viên", desc: "Chỉ giáo viên" },
];

interface Props {
  classes: Class[];
  onSaved?: () => void;
}

type SaveState = "idle" | "saving" | "success" | "error";

export default function MaterialsUploadForm({ classes, onSaved }: Props) {
  const [selectedClass, setSelectedClass] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetRole, setTargetRole] = useState<TargetRole>("all");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock: all students (in real app, filter by class enrollment)
  const classStudents = MOCK_STUDENTS.slice(0, 5);

  const toggleStudent = (id: string) =>
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );

  const handleRoleChange = (role: TargetRole) => {
    setTargetRole(role);
    setSelectedStudents([]);
    setShowStudentPicker(false);
  };

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
          target_role: targetRole,
          target_student_ids: targetRole === "student" && selectedStudents.length > 0 ? selectedStudents : null,
        });
      }
      setSaveState("success");
      setTitle(""); setDescription(""); setSelectedClass("");
      setFiles([]); setTargetRole("all"); setSelectedStudents([]);
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

  const visibilitySummary = () => {
    if (targetRole === "all") return "Tất cả trong lớp";
    if (targetRole === "parent") return "Chỉ phụ huynh";
    if (targetRole === "teacher") return "Chỉ giáo viên";
    if (selectedStudents.length === 0) return "Tất cả học viên";
    return `${selectedStudents.length} học viên được chọn`;
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-5">

        {/* Row 1: Class + Title */}
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

        {/* Row 2: Visibility */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Hiển thị cho</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ROLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleRoleChange(opt.value)}
                className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                  targetRole === opt.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-border-strong text-foreground"
                }`}
              >
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-[11px] text-muted-foreground leading-tight">{opt.desc}</span>
              </button>
            ))}
          </div>

          {/* Student picker — chỉ hiện khi chọn "Học viên" */}
          {targetRole === "student" && (
            <div className="mt-2 border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setShowStudentPicker(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <span className="flex items-center gap-2 text-foreground">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {visibilitySummary()}
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showStudentPicker ? "rotate-180" : ""}`} />
              </button>

              {showStudentPicker && (
                <div className="border-t border-border divide-y divide-border">
                  <div className="px-4 py-2 flex items-center justify-between bg-muted/10">
                    <span className="text-xs text-muted-foreground">Bỏ trống = tất cả học viên</span>
                    {selectedStudents.length > 0 && (
                      <button onClick={() => setSelectedStudents([])} className="text-xs text-primary hover:underline">
                        Bỏ chọn tất cả
                      </button>
                    )}
                  </div>
                  {classStudents.map(student => {
                    const checked = selectedStudents.includes(student.id);
                    return (
                      <label
                        key={student.id}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStudent(student.id)}
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                          {student.full_name.split(" ").pop()?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{student.full_name}</p>
                          <p className="text-xs text-muted-foreground">{student.grade}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Mô tả <span className="text-muted-foreground font-normal">(tuỳ chọn)</span>
          </label>
          <textarea
            className="flex min-h-[68px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
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
          className={`border-2 border-dashed rounded-xl py-7 text-center cursor-pointer transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
          }`}
        >
          <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_TYPES} className="hidden" onChange={e => handleFiles(e.target.files)} />
          <Upload className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
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

        {/* Save */}
        <div className="flex items-center gap-3">
          <Button className="flex-1 h-10" disabled={!canSave} onClick={handleSave}>
            {saveState === "saving" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saveState === "saving" ? "Đang lưu..." : `Lưu tài liệu${doneCount > 0 ? ` (${doneCount} file)` : ""}`}
          </Button>
          {saveState === "success" && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Đã lưu
            </span>
          )}
          {saveState === "error" && (
            <span className="flex items-center gap-1.5 text-sm text-red-500 font-medium">
              <AlertCircle className="h-4 w-4" /> Lưu thất bại
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
