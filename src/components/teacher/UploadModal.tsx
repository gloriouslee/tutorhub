"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadClassFile } from "@/lib/upload";
import { saveClassMaterial, type StoredClassMaterial, type StudentPackage } from "@/lib/storage";
import { FileText, Upload, X, Send, Loader2, AlertCircle, Pin } from "lucide-react";
import { CATEGORY_MAP } from "./classDetail.types";

export default function UploadModal({
  type,
  classId,
  onClose,
  onMaterialSaved,
}: {
  type: "lecture" | "material" | "note";
  classId: string;
  onClose: () => void;
  onMaterialSaved?: (mat: StoredClassMaterial) => void;
}) {
  const titles = { lecture: "Thêm bài giảng mới", material: "Tải lên tài liệu", note: "Viết ghi chú mới" };
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("summary");
  const [selectedPkgs, setSelectedPkgs] = useState<StudentPackage[]>([]); // empty = all packages
  const [pinned, setPinned] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function togglePkg(pkg: StudentPackage) {
    setSelectedPkgs(prev => prev.includes(pkg) ? prev.filter(p => p !== pkg) : [...prev, pkg]);
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (type !== "note" && !file) { setUploadError("Vui lòng chọn file cần tải lên"); return; }

    setUploading(true);
    setUploadError("");

    try {
      if (type === "material" && file) {
        const uploaded = await uploadClassFile(file, classId, "materials");
        const mat = await saveClassMaterial({
          class_id: classId,
          title: title.trim(),
          description: description.trim() || undefined,
          file_url: uploaded.url,
          file_type: uploaded.file_type,
          file_size: uploaded.size,
          category,
          uploaded_by: "teacher",
          created_at: new Date().toISOString(),
          packages: selectedPkgs.length > 0 ? selectedPkgs : undefined,
        });
        onMaterialSaved?.(mat);
      }
      // lecture type: same flow (saved as material with type)
      if (type === "lecture" && file) {
        const uploaded = await uploadClassFile(file, classId, "materials");
        const mat = await saveClassMaterial({
          class_id: classId,
          title: title.trim(),
          description: description.trim() || undefined,
          file_url: uploaded.url,
          file_type: uploaded.file_type,
          file_size: uploaded.size,
          category: "textbook",
          uploaded_by: "teacher",
          created_at: new Date().toISOString(),
          packages: selectedPkgs.length > 0 ? selectedPkgs : undefined,
        });
        onMaterialSaved?.(mat);
      }
      onClose();
    } catch (e: any) {
      setUploadError(e.message ?? "Lỗi tải lên file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-semibold text-foreground">{titles[type]}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Tiêu đề <span className="text-red-500">*</span></label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={type === "note" ? "VD: Lưu ý quan trọng..." : "VD: Chương 5 - Tích phân..."}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Mô tả</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full min-h-[80px] p-3 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              placeholder={type === "note" ? "Nội dung ghi chú..." : "Mô tả ngắn gọn..."}
            />
          </div>

          {type !== "note" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Tải file lên <span className="text-red-500">*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <button onClick={() => setFile(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-primary/5"}`}
                >
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">Kéo thả file hoặc nhấn để chọn</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, PPTX · Tối đa 100MB</p>
                </div>
              )}
              {uploadError && (
                <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
                </div>
              )}
            </div>
          )}

          {type === "note" && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="pin-note" checked={pinned} onChange={e => setPinned(e.target.checked)} className="rounded" />
              <label htmlFor="pin-note" className="text-sm text-muted-foreground flex items-center gap-1.5"><Pin className="h-3.5 w-3.5" />Ghim ghi chú này</label>
            </div>
          )}
          {type === "material" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Phân loại</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CATEGORY_MAP).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setCategory(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:shadow-sm ${val.color} ${category === key ? "ring-2 ring-offset-1 ring-primary/50" : ""}`}
                  >
                    {val.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {type !== "note" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Giới hạn theo gói
                <span className="ml-2 text-xs font-normal text-muted-foreground">(bỏ trống = tất cả gói đều xem được)</span>
              </label>
              <div className="flex gap-2">
                {([
                  { pkg: "online" as StudentPackage, label: "Online", color: "border-sky-300 text-sky-700 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-400" },
                  { pkg: "advanced" as StudentPackage, label: "Nâng cao", color: "border-violet-300 text-violet-700 bg-violet-50 dark:bg-violet-900/20 dark:text-violet-400" },
                  { pkg: "offline" as StudentPackage, label: "Offline", color: "border-orange-300 text-orange-700 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400" },
                ]).map(({ pkg, label, color }) => (
                  <button
                    key={pkg}
                    type="button"
                    onClick={() => togglePkg(pkg)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedPkgs.includes(pkg) ? `${color} ring-2 ring-offset-1 ring-primary/40` : "border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    {selectedPkgs.includes(pkg) && <span>✓</span>}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="p-5 border-t border-border bg-muted/20 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={uploading}>Hủy</Button>
          <Button variant="gradient" disabled={uploading || !title.trim() || (type !== "note" && !file)} onClick={handleSubmit}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {type === "note" ? "Đăng ghi chú" : uploading ? "Đang tải lên..." : "Tải lên"}
          </Button>
        </div>
      </div>
    </div>
  );
}
