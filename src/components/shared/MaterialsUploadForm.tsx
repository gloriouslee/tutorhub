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
  CheckCircle2, AlertCircle, X, Loader2, Users, ChevronDown,
  ChevronRight, Search,
} from "lucide-react";

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.ppt,.pptx,.mp4,.jpg,.jpeg,.png";
const ALL_GRADES = [9, 10, 11, 12];

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

const ROLE_OPTIONS: { value: TargetRole; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "student", label: "Học viên" },
  { value: "parent", label: "Phụ huynh" },
  { value: "teacher", label: "Giáo viên" },
];

interface Props {
  classes: Class[];
  onSaved?: () => void;
}

type SaveState = "idle" | "saving" | "success" | "error";

// ── Distribution summary label ───────────────────────────────────────────────

function distributionLabel(
  selectedGrades: number[],
  selectedClasses: string[],
  selectedStudents: string[],
  classes: Class[],
) {
  if (selectedStudents.length > 0) return `${selectedStudents.length} học viên cụ thể`;
  if (selectedClasses.length > 0) {
    const names = classes.filter(c => selectedClasses.includes(c.id)).map(c => c.class_name);
    return names.join(", ");
  }
  if (selectedGrades.length > 0) return `Khối ${selectedGrades.join(", ")}`;
  return "Chưa chọn";
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MaterialsUploadForm({ classes, onSaved }: Props) {
  // Distribution state
  const [selectedGrades, setSelectedGrades] = useState<number[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [expandClasses, setExpandClasses] = useState(false);
  const [expandStudents, setExpandStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  // Visibility
  const [targetRole, setTargetRole] = useState<TargetRole>("all");

  // Content
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Upload
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived
  const classesInGrade = selectedGrades.length > 0
    ? classes.filter(c => c.grade !== undefined && selectedGrades.includes(c.grade))
    : classes;

  const classStudents = MOCK_STUDENTS.slice(0, 5);
  const filteredStudents = studentSearch.trim()
    ? classStudents.filter(s =>
        s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.email.toLowerCase().includes(studentSearch.toLowerCase())
      )
    : classStudents;

  // Handlers
  const toggleGrade = (g: number) => {
    setSelectedGrades(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    );
    setSelectedClasses([]);
    setSelectedStudents([]);
  };

  const toggleClass = (id: string) => {
    setSelectedClasses(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setSelectedStudents([]);
  };

  const toggleStudent = (id: string) =>
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

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
    if (!title || doneFiles.length === 0) return;
    setSaveState("saving");
    try {
      const supabase = createClient();
      for (const file of doneFiles) {
        await supabase.from("materials").insert({
          title,
          description,
          file_url: file.url,
          file_type: file.type,
          target_role: targetRole,
          target_grades: selectedGrades.length > 0 ? selectedGrades : null,
          target_class_ids: selectedClasses.length > 0 ? selectedClasses : null,
          target_student_ids: selectedStudents.length > 0 ? selectedStudents : null,
        });
      }
      setSaveState("success");
      setTitle(""); setDescription("");
      setSelectedGrades([]); setSelectedClasses([]); setSelectedStudents([]);
      setFiles([]); setTargetRole("all");
      onSaved?.();
      setTimeout(() => setSaveState("idle"), 3000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const doneCount = files.filter(f => f.status === "done").length;
  const uploadingCount = files.filter(f => f.status === "uploading").length;
  const canSave = title && doneCount > 0 && uploadingCount === 0 && saveState === "idle";

  return (
    <Card>
      <CardContent className="p-6 space-y-6">

        {/* ── Bước 1: Phân phối đến ── */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">Bước 1 — Phân phối đến</p>
            <p className="text-xs text-muted-foreground mt-0.5">Chọn khối, sau đó thu hẹp xuống lớp hoặc học viên cụ thể</p>
          </div>

          {/* Khối */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Khối</p>
            <div className="flex flex-wrap gap-2">
              {ALL_GRADES.map(g => (
                <button
                  key={g}
                  onClick={() => toggleGrade(g)}
                  className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    selectedGrades.includes(g)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-primary/50"
                  }`}
                >
                  Khối {g}
                </button>
              ))}
              <button
                onClick={() => { setSelectedGrades([]); setSelectedClasses([]); setSelectedStudents([]); }}
                className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  selectedGrades.length === 0 && selectedClasses.length === 0 && selectedStudents.length === 0
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground hover:border-primary/50"
                }`}
              >
                Tất cả khối
              </button>
            </div>
          </div>

          {/* Lớp — chỉ hiện khi đã chọn khối hoặc muốn thu hẹp */}
          <div className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandClasses(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-sm"
            >
              <span className="flex items-center gap-2 text-foreground">
                {expandClasses ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                Thu hẹp theo lớp
                {selectedClasses.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    {selectedClasses.length} lớp
                  </span>
                )}
              </span>
              {selectedClasses.length > 0 && (
                <button onClick={e => { e.stopPropagation(); setSelectedClasses([]); }} className="text-xs text-muted-foreground hover:text-red-500">
                  Bỏ chọn
                </button>
              )}
            </button>

            {expandClasses && (
              <div className="border-t border-border divide-y divide-border max-h-48 overflow-y-auto">
                {classesInGrade.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">Không có lớp nào</p>
                ) : classesInGrade.map(c => (
                  <label key={c.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/20">
                    <input
                      type="checkbox"
                      checked={selectedClasses.includes(c.id)}
                      onChange={() => toggleClass(c.id)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color ?? "#6366f1" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{c.class_name}</p>
                      <p className="text-xs text-muted-foreground">{c.subject} · Khối {c.grade}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Học viên cụ thể */}
          <div className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandStudents(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-sm"
            >
              <span className="flex items-center gap-2 text-foreground">
                {expandStudents ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                Thu hẹp theo học viên cụ thể
                {selectedStudents.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    {selectedStudents.length} học viên
                  </span>
                )}
              </span>
              {selectedStudents.length > 0 && (
                <button onClick={e => { e.stopPropagation(); setSelectedStudents([]); }} className="text-xs text-muted-foreground hover:text-red-500">
                  Bỏ chọn
                </button>
              )}
            </button>

            {expandStudents && (
              <div className="border-t border-border">
                <div className="px-3 py-2 border-b border-border bg-muted/10">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên hoặc email..."
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">{filteredStudents.length} học viên{studentSearch ? " phù hợp" : ""}</p>
                </div>
                <div className="divide-y divide-border max-h-48 overflow-y-auto">
                  {filteredStudents.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-center text-muted-foreground">Không tìm thấy</p>
                  ) : filteredStudents.map(s => (
                    <label key={s.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/20">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                        {s.full_name.split(" ").pop()?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{s.full_name}</p>
                        <p className="text-xs text-muted-foreground">{s.email} · {s.grade}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <p className="text-xs text-muted-foreground">
            Phân phối đến: <span className="font-medium text-foreground">{distributionLabel(selectedGrades, selectedClasses, selectedStudents, classes)}</span>
          </p>
        </div>

        {/* ── Bước 2: Hiển thị cho ── */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Bước 2 — Hiển thị cho</p>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTargetRole(opt.value)}
                className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  targetRole === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground hover:border-primary/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Bước 3: Nội dung ── */}
        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">Bước 3 — Nội dung tài liệu</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Tiêu đề *</label>
              <Input
                placeholder="VD: Tổng ôn Đạo hàm — Khối 12"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Mô tả <span className="font-normal">(tuỳ chọn)</span></label>
              <textarea
                className="flex min-h-[68px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Nội dung tài liệu này gồm..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
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
        </div>

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
