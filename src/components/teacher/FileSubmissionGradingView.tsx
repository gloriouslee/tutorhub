"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Image as ImageIcon,
  RotateCcw,
  Search,
  UserRoundX,
  X,
} from "lucide-react";
import SubmissionGrader, {
  relativeTime,
  scoreColor,
  type GradableSubmission,
} from "@/components/teacher/SubmissionGrader";
import type { SubmissionRecord } from "@/lib/supabase/submissions";

type StudentLite = {
  id: string;
  full_name: string;
};

function isImageFile(fileName?: string) {
  return /\.(jpe?g|png|gif|webp)$/i.test(fileName ?? "");
}

function isPdfFile(fileName?: string) {
  return /\.pdf$/i.test(fileName ?? "");
}

function statusMeta(submission: GradableSubmission) {
  if (submission.status === "returned") {
    return {
      label: "Chờ làm lại",
      className: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300",
      Icon: RotateCcw,
    };
  }
  if (submission.score != null || submission.status === "graded") {
    return {
      label: submission.score != null ? `${submission.score.toFixed(1)}/10` : "Đã chấm",
      className: submission.score != null
        ? scoreColor(submission.score)
        : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
      Icon: CheckCircle2,
    };
  }
  return {
    label: "Chưa chấm",
    className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
    Icon: Clock,
  };
}

export default function FileSubmissionGradingView({
  classId,
  homeworkTitle,
  submissions,
  assignedStudents,
  loading = false,
  onClose,
  onGraded,
}: {
  classId: string;
  homeworkTitle: string;
  submissions: SubmissionRecord[];
  assignedStudents: StudentLite[];
  loading?: boolean;
  onClose: () => void;
  onGraded: (submissionId: string, patch: Partial<SubmissionRecord>) => void;
}) {
  const studentNames = useMemo(
    () => new Map(assignedStudents.map((student) => [student.id, student.full_name])),
    [assignedStudents],
  );
  const gradableSubmissions = useMemo<GradableSubmission[]>(() => (
    submissions
      .map((submission) => ({
        ...submission,
        student_name: submission.student_name || studentNames.get(submission.student_id) || submission.student_id,
      }))
      .sort((a, b) => {
        const aPending = a.status !== "returned" && a.score == null;
        const bPending = b.status !== "returned" && b.score == null;
        return Number(bPending) - Number(aPending) || b.submitted_at.localeCompare(a.submitted_at);
      })
  ), [studentNames, submissions]);

  const submittedStudentIds = useMemo(
    () => new Set(gradableSubmissions.map((submission) => submission.student_id)),
    [gradableSubmissions],
  );
  const missingStudents = useMemo(
    () => assignedStudents.filter((student) => !submittedStudentIds.has(student.id)),
    [assignedStudents, submittedStudentIds],
  );
  const [selectedId, setSelectedId] = useState<string | null>(gradableSubmissions[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setSelectedId((current) => (
      current && gradableSubmissions.some((submission) => submission.id === current)
        ? current
        : (gradableSubmissions[0]?.id ?? null)
    ));
  }, [gradableSubmissions]);

  const normalizedSearch = search.trim().toLocaleLowerCase("vi-VN");
  const shownSubmissions = gradableSubmissions.filter((submission) => (
    !normalizedSearch
    || submission.student_name.toLocaleLowerCase("vi-VN").includes(normalizedSearch)
  ));
  const shownMissingStudents = missingStudents.filter((student) => (
    !normalizedSearch
    || student.full_name.toLocaleLowerCase("vi-VN").includes(normalizedSearch)
  ));
  const selected = gradableSubmissions.find((submission) => submission.id === selectedId) ?? null;

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground">Chấm bài · {homeworkTitle}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {gradableSubmissions.length} đã nộp · {missingStudents.length} chưa nộp
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted" title="Đóng">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-[290px] shrink-0 overflow-y-auto border-r border-border p-3">
          <label className="relative mb-3 block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên học sinh…"
              className="h-9 w-full rounded-xl border border-border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          {loading && (
            <p className="py-8 text-center text-xs text-muted-foreground">Đang tải bài nộp…</p>
          )}
          {!loading && shownSubmissions.length === 0 && shownMissingStudents.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">Không tìm thấy học sinh.</p>
          )}

          <div className="space-y-1.5">
            {shownSubmissions.map((submission) => {
              const meta = statusMeta(submission);
              const active = submission.id === selectedId;
              return (
                <button
                  key={submission.id}
                  type="button"
                  onClick={() => setSelectedId(submission.id)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition-all ${active ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40 hover:bg-muted/30"}`}
                >
                  <p className="truncate text-sm font-medium text-foreground">{submission.student_name}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${meta.className}`}>
                      <meta.Icon className="h-2.5 w-2.5" />{meta.label}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground">{relativeTime(submission.submitted_at)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {shownMissingStudents.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <UserRoundX className="h-3 w-3" /> Chưa nộp ({shownMissingStudents.length})
              </p>
              <div className="space-y-1">
                {shownMissingStudents.map((student) => (
                  <div key={student.id} className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    {student.full_name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <FileText className="mb-4 h-12 w-12 text-muted-foreground/20" />
              <h3 className="text-sm font-semibold text-foreground">Chưa có bài nộp</h3>
              <p className="mt-1 text-xs text-muted-foreground">Khi học sinh tải bài lên, bài làm sẽ xuất hiện tại đây để xem và chấm.</p>
            </div>
          ) : (
            <div className="mx-auto max-w-5xl space-y-4 px-6 py-5">
              <div>
                <h3 className="text-base font-semibold text-foreground">{selected.student_name}</h3>
                <p className="text-xs text-muted-foreground">Nộp {relativeTime(selected.submitted_at)}</p>
              </div>

              {selected.file_url && isImageFile(selected.file_name) && (
                <div className="overflow-hidden rounded-2xl border border-border bg-muted/20 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selected.file_url} alt={selected.file_name || "Bài làm của học sinh"} className="mx-auto max-h-[55vh] max-w-full rounded-xl object-contain" />
                </div>
              )}
              {selected.file_url && isPdfFile(selected.file_name) && (
                <iframe title={selected.file_name || "Bài làm PDF"} src={selected.file_url} className="h-[55vh] w-full rounded-2xl border border-border bg-white" />
              )}
              {selected.file_url && !isImageFile(selected.file_name) && !isPdfFile(selected.file_name) && (
                <a href={selected.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-border bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-primary/5">
                  <FileText className="h-8 w-8 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{selected.file_name || "Mở bài làm"}</span>
                  <Download className="h-4 w-4 shrink-0 text-primary" />
                </a>
              )}
              {!selected.file_url && (
                <div className="rounded-2xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
                  <ImageIcon className="mx-auto mb-2 h-7 w-7 opacity-30" />
                  Lượt nộp này không có file đính kèm.
                </div>
              )}

              <SubmissionGrader
                key={selected.id}
                submission={selected}
                classId={classId}
                homeworkTitle={homeworkTitle}
                defaultOpen
                onGraded={(patch) => onGraded(selected.id, patch)}
              />
            </div>
          )}
        </main>
      </div>
    </div>,
    document.body,
  );
}
