"use client";

import { useState } from "react";
import {
  CheckCircle2, ChevronDown, ChevronUp, Clock, Download, FileText,
  Image as ImageIcon, MessageSquare, Paperclip, Star, Upload, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  updateGrade as supabaseUpdateGrade,
  uploadSubmissionFile,
  type SubmissionRecord,
} from "@/lib/supabase/submissions";
import { addNotification } from "@/lib/storage";

export type GradableSubmission = SubmissionRecord & { student_name: string };

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (hours < 1) return "Vừa nộp";
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

export function scoreColor(score: number): string {
  if (score >= 9) return "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400";
  if (score >= 7) return "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400";
  if (score >= 5) return "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400";
  return "text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400";
}

/**
 * Một bài nộp kèm ô chấm điểm mở ngay tại chỗ.
 *
 * Tách riêng để hàng đợi bài tập chấm được mà không phải điều hướng sang trang
 * khác — trước đây đây là lý do trang "Bài tập" chỉ để xem chứ không làm được gì.
 */
export default function SubmissionGrader({
  submission,
  classId,
  homeworkTitle,
  onGraded,
  defaultOpen = false,
}: {
  submission: GradableSubmission;
  classId: string;
  homeworkTitle: string;
  onGraded: (patch: Partial<GradableSubmission>) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [score, setScore] = useState(() => defaultOpen && submission.score != null ? String(submission.score) : "");
  const [feedback, setFeedback] = useState(() => defaultOpen ? (submission.feedback ?? "") : "");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const graded = submission.score != null;
  const parsed = parseFloat(score);
  const scoreValid = !Number.isNaN(parsed) && parsed >= 0 && parsed <= 10;

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setScore(submission.score != null ? String(submission.score) : "");
    setFeedback(submission.feedback ?? "");
    setFile(null);
    setError("");
    setOpen(true);
  }

  async function handleSave() {
    if (!scoreValid) return;
    setSaving(true);
    setError("");
    try {
      let fileUrl = submission.teacher_file_url;
      let fileName = submission.teacher_file_name;
      if (file) {
        const uploaded = await uploadSubmissionFile(
          classId,
          submission.homework_id,
          submission.student_id,
          file,
        );
        if (!uploaded) {
          setError("Không tải được file đính kèm. Điểm chưa được lưu.");
          return;
        }
        fileUrl = uploaded.url;
        fileName = file.name;
      }

      const trimmed = feedback.trim();
      const saved = await supabaseUpdateGrade(
        submission.id, parsed, trimmed, fileUrl, fileName,
      );
      if (!saved) {
        setError("Không lưu được điểm. Dữ liệu cũ vẫn được giữ nguyên.");
        return;
      }

      onGraded({
        score: parsed,
        feedback: trimmed || undefined,
        status: "graded",
        graded_at: new Date().toISOString(),
        teacher_file_url: fileUrl,
        teacher_file_name: fileName,
      });
      setOpen(false);

      // Điểm đã lưu rồi — báo thất bại ở bước gửi thông báo, không phải ở bước chấm.
      try {
        await addNotification({
          title: "Bài tập đã được chấm",
          content: `"${homeworkTitle}" đã được chấm: ${parsed}/10${trimmed ? " — có nhận xét của giáo viên." : "."}`,
          target_role: "student",
          target_class_id: classId,
          category: "graded",
        });
      } catch {
        setError("Đã lưu điểm, nhưng chưa gửi được thông báo cho học viên.");
        setOpen(true);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`rounded-xl border p-3 ${open ? "border-primary/40 bg-primary/5" : "border-border/60"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <AvatarFallback name={submission.student_name} />
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-foreground">{submission.student_name}</p>
            <p className="text-xs text-muted-foreground">
              Nộp {relativeTime(submission.submitted_at)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {graded ? (
            <span className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold ${scoreColor(submission.score!)}`}>
              <Star className="h-3.5 w-3.5" />
              {submission.score!.toFixed(1)}/10
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 dark:border-amber-800 dark:bg-amber-900/20">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Chưa chấm</span>
            </span>
          )}
          <Button
            size="sm"
            variant={graded ? "outline" : "gradient"}
            className="h-8 text-xs"
            onClick={toggle}
          >
            {open ? (
              <><ChevronUp className="mr-1 h-3.5 w-3.5" />Đóng</>
            ) : graded ? (
              <><ChevronDown className="mr-1 h-3.5 w-3.5" />Sửa điểm</>
            ) : (
              <><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Chấm bài</>
            )}
          </Button>
        </div>
      </div>

      {submission.file_name && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {/\.(jpg|jpeg|png)$/i.test(submission.file_name)
            ? <ImageIcon className="h-3.5 w-3.5 shrink-0 text-blue-500" />
            : <FileText className="h-3.5 w-3.5 shrink-0 text-red-500" />}
          <span className="flex-1 truncate">{submission.file_name}</span>
          {submission.file_url ? (
            <a
              href={submission.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded p-1 text-primary transition-colors hover:bg-primary/10"
              title="Tải xuống"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          ) : (
            <span className="shrink-0 p-1 text-muted-foreground/40" title="Nộp offline, không có file">
              <Download className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      )}

      {graded && !open && (submission.feedback || submission.teacher_file_name) && (
        <div className="mt-2 space-y-1.5">
          {submission.feedback && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="leading-relaxed">{submission.feedback}</span>
            </div>
          )}
          {submission.teacher_file_name && (
            <div className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs dark:border-indigo-800 dark:bg-indigo-900/20">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
              <span className="flex-1 truncate font-medium text-indigo-700 dark:text-indigo-300">
                {submission.teacher_file_name}
              </span>
              {submission.teacher_file_url && (
                <a href={submission.teacher_file_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700">
                  <Download className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Điểm số (0 – 10)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={score}
                onChange={(event) => setScore(event.target.value)}
                placeholder="VD: 8.5"
                className="h-10 w-24 rounded-xl border border-input bg-card text-center text-lg font-bold outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <span className="text-sm text-muted-foreground">/10</span>
              {scoreValid && (
                <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${scoreColor(parsed)}`}>
                  {parsed >= 9 ? "Xuất sắc" : parsed >= 7 ? "Khá" : parsed >= 5 ? "Trung bình" : "Yếu"}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nhận xét cho học viên
            </label>
            <textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="Nhận xét về bài làm, điểm cần cải thiện..."
              rows={3}
              className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Paperclip className="h-3 w-3" /> Tài liệu trả lại{" "}
              <span className="font-normal normal-case">(tuỳ chọn)</span>
            </label>
            {file ? (
              <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1 truncate text-xs font-medium">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : submission.teacher_file_name ? (
              <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <Paperclip className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{submission.teacher_file_name}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Đã đính kèm</span>
              </div>
            ) : null}
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed px-3 py-2 text-xs text-muted-foreground transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
              }`}
              onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                const dropped = event.dataTransfer.files[0];
                if (dropped) setFile(dropped);
              }}
            >
              <Upload className="h-3.5 w-3.5 shrink-0" />
              <span>{file ? "Chọn file khác" : "Kéo thả hoặc nhấn để chọn file"}</span>
              <input
                type="file"
                className="sr-only"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(event) => {
                  const picked = event.target.files?.[0];
                  if (picked) setFile(picked);
                }}
              />
            </label>
          </div>

          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button
              size="sm"
              variant="gradient"
              className="h-8 text-xs"
              onClick={handleSave}
              disabled={!scoreValid || saving}
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              {saving ? "Đang lưu…" : "Lưu điểm"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
