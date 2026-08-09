"use client";

import { useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  Star,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  insertSubmission,
  uploadSubmissionFile,
  type SubmissionRecord,
} from "@/lib/supabase/submissions";

const ACCEPTED_EXTENSIONS = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];
const ACCEPTED_FILES = ".pdf,.doc,.docx,.jpg,.jpeg,.png";
const MAX_FILE_MB = 10;

type Props = {
  classId: string;
  homeworkId: string;
  studentId: string;
  studentName: string;
  dueDate?: string;
  submission?: SubmissionRecord;
  disabled?: boolean;
  onSubmitted: (submission: SubmissionRecord) => void;
};

function readableSize(bytes?: number) {
  if (!bytes) return "";
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function HomeworkSubmissionPanel({
  classId,
  homeworkId,
  studentId,
  studentName,
  dueDate,
  submission,
  disabled = false,
  onSubmitted,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const canUpload = !submission || submission.status === "returned";

  function chooseFile(next: File | null) {
    if (!next) return;
    const extension = next.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setFile(null);
      setError("Chỉ nhận file PDF, Word, JPG hoặc PNG.");
      return;
    }
    if (next.size > MAX_FILE_MB * 1024 * 1024) {
      setFile(null);
      setError(`File vượt quá ${MAX_FILE_MB}MB.`);
      return;
    }
    setFile(next);
    setError("");
    setSuccess(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || uploading || disabled) return;
    setUploading(true);
    setError("");
    setSuccess(false);
    try {
      const uploaded = await uploadSubmissionFile(classId, homeworkId, studentId, file);
      if (!uploaded?.url) throw new Error("Không thể tải file bài làm lên. Vui lòng thử lại.");
      const saved = await insertSubmission({
        class_id: classId,
        homework_id: homeworkId,
        student_id: studentId,
        student_name: studentName,
        file_url: uploaded.url,
        file_name: file.name,
        file_size: file.size,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      });
      if (!saved) throw new Error("File đã tải lên nhưng chưa ghi nhận được bài nộp. Vui lòng thử lại.");
      onSubmitted(saved);
      setFile(null);
      setSuccess(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể nộp bài. Vui lòng thử lại.");
    } finally {
      setUploading(false);
    }
  }

  if (!canUpload && submission) {
    return (
      <section className="mt-5 space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/25 md:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900">
              {submission.status === "graded" ? <Star className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {submission.status === "graded" ? "Bài đã được chấm" : "Đã nộp bài thành công"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {new Date(submission.submitted_at).toLocaleString("vi-VN")}
                {submission.score != null ? ` · ${submission.score}/10 điểm` : ""}
              </p>
            </div>
          </div>
          {submission.file_url && (
            <Button size="sm" variant="outline" asChild>
              <a href={submission.file_url} target="_blank" rel="noopener noreferrer">
                <Download className="mr-1.5 h-4 w-4" /> Xem bài đã nộp
              </a>
            </Button>
          )}
        </div>

        {submission.file_name && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate font-medium">{submission.file_name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{readableSize(submission.file_size)}</span>
          </div>
        )}

        {(submission.feedback || submission.teacher_file_url) && (
          <div className="rounded-xl border border-border bg-background p-3 text-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Nhận xét của giáo viên</p>
            {submission.feedback && <p className="mt-1.5 leading-relaxed text-foreground">{submission.feedback}</p>}
            {submission.teacher_file_url && (
              <a
                href={submission.teacher_file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                {submission.teacher_file_name || "Tải file giáo viên gửi lại"}
              </a>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={`mt-5 rounded-2xl border p-4 md:p-5 ${submission?.status === "returned" ? "border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20" : "border-border bg-muted/20"}`}>
      <div className="mb-4 flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${submission?.status === "returned" ? "bg-rose-100 text-rose-600 dark:bg-rose-900" : "bg-amber-100 text-amber-600 dark:bg-amber-950"}`}>
          {submission?.status === "returned" ? <RotateCcw className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">
            {submission?.status === "returned" ? "Giáo viên yêu cầu nộp lại" : "Nộp bài trực tiếp tại đây"}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            PDF, Word, JPG hoặc PNG · tối đa {MAX_FILE_MB}MB
            {dueDate ? ` · Hạn nộp ${new Date(`${dueDate}T23:59:59`).toLocaleDateString("vi-VN")}` : ""}
          </p>
        </div>
      </div>

      {submission?.feedback && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-background p-3 text-sm dark:border-rose-900">
          <p className="text-xs font-bold uppercase tracking-wide text-rose-600">Nhận xét cần sửa</p>
          <p className="mt-1.5 leading-relaxed text-foreground">{submission.feedback}</p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <label
          className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${dragOver ? "border-primary bg-primary/10" : file ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/50 hover:bg-muted/35"} ${disabled ? "pointer-events-none opacity-60" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            chooseFile(event.dataTransfer.files[0] ?? null);
          }}
        >
          {file ? (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><Check className="h-5 w-5" /></span>
              <span className="mt-2 max-w-full truncate text-sm font-bold text-primary">{file.name}</span>
              <span className="mt-1 text-xs text-muted-foreground">{readableSize(file.size)} · nhấn để chọn file khác</span>
            </>
          ) : (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground"><Upload className="h-5 w-5" /></span>
              <span className="mt-2 text-sm font-semibold text-foreground"><span className="text-primary">Nhấn để chọn file</span> hoặc kéo thả vào đây</span>
              <span className="mt-1 text-xs text-muted-foreground">PDF · DOC · DOCX · JPG · PNG</span>
            </>
          )}
          <input
            type="file"
            accept={ACCEPTED_FILES}
            className="hidden"
            disabled={disabled || uploading}
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          />
        </label>

        {error && <p className="flex items-center gap-1.5 text-xs font-medium text-red-600"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}</p>}
        {success && <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />Nộp bài thành công.</p>}

        <div className="flex justify-end">
          <Button type="submit" disabled={!file || uploading || disabled}>
            {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
            {uploading ? "Đang tải lên…" : submission?.status === "returned" ? "Nộp lại bài" : "Nộp bài"}
          </Button>
        </div>
      </form>
    </section>
  );
}
