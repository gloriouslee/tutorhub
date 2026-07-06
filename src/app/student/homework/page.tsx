"use client";

import { useState, useEffect, useMemo } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { MOCK_HOMEWORK, MOCK_CLASSES } from "@/lib/mock-data";
import { useStudentContext } from "@/hooks/useStudentContext";
import {
  FileText, Clock, CheckCircle2, Upload, Calendar,
  AlertCircle, X, Check, Download, Loader2, Star,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  uploadSubmissionFile,
  insertSubmission,
  getSubmissionsByStudent,
  type SubmissionRecord,
} from "@/lib/supabase/submissions";
import { kvGet, kvSet } from "@/lib/storage";

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCEPTED = ".pdf,.doc,.docx,.jpg,.jpeg,.png";
const MAX_MB   = 10;
const LS_KEY   = "tutorhub_submissions";

// ── localStorage fallback ─────────────────────────────────────────────────────
async function loadLocalSubs(): Promise<SubmissionRecord[]> {
  try { return await kvGet<SubmissionRecord[]>(LS_KEY, []); } catch { return []; }
}
async function saveLocalSub(sub: SubmissionRecord) {
  const arr = await loadLocalSubs();
  await kvSet(LS_KEY, [...arr.filter(s => s.id !== sub.id), sub]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysLeft(due: string) {
  return Math.ceil((new Date(due).setHours(23, 59, 59) - Date.now()) / 86400000);
}

type FilterTab = "all" | "pending" | "submitted" | "graded";

interface HomeworkItem {
  id: string;
  class_id: string;
  title: string;
  description?: string;
  due_date: string;
  created_at?: string;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StudentHomeworkPage() {
  const { studentId: STUDENT_ID, studentName: STUDENT_NAME, myClasses } = useStudentContext();
  const myClassIds = myClasses.map(c => c.id);
  const [teacherHw,    setTeacherHw]    = useState<HomeworkItem[]>([]);
  // Merge teacher-created homework (kv) with mock — kv wins on id collision
  const kvHwIds = new Set(teacherHw.map(h => h.id));
  const myHomework: HomeworkItem[] = [
    ...teacherHw,
    ...MOCK_HOMEWORK.filter(h => myClassIds.includes(h.class_id) && !kvHwIds.has(h.id)),
  ];
  const [submissions,  setSubmissions]  = useState<SubmissionRecord[]>([]);
  const [filterTab,    setFilterTab]    = useState<FilterTab>("all");
  const [selectedHw,   setSelectedHw]   = useState<HomeworkItem | null>(null);
  const [modalType,    setModalType]    = useState<"submit" | "detail" | null>(null);
  const [file,         setFile]         = useState<File | null>(null);
  const [dragOver,     setDragOver]     = useState(false);
  const [uploadState,  setUploadState]  = useState<"idle" | "uploading" | "success">("idle");
  const [errorMsg,     setErrorMsg]     = useState("");

  useEffect(() => {
    kvGet<HomeworkItem[]>("tutorhub_teacher_homework", [])
      .then(all => setTeacherHw(all.filter(h => myClassIds.includes(h.class_id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myClassIds.join(",")]);

  useEffect(() => {
    getSubmissionsByStudent(STUDENT_ID).then(async remote => {
      if (remote.length > 0) {
        setSubmissions(remote);
      } else {
        setSubmissions((await loadLocalSubs()).filter(s => s.student_id === STUDENT_ID));
      }
    });
  }, [STUDENT_ID]);

  // Per-homework submission lookup
  function getSub(hwId: string) {
    return submissions.find(s => s.homework_id === hwId && s.student_id === STUDENT_ID);
  }

  // Status logic
  function hwStatus(hwId: string, dueDate: string) {
    const sub = getSub(hwId);
    if (sub?.status === "graded" && sub.score != null)
      return { label: `Đã chấm · ${sub.score}/10`, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400", icon: Star, key: "graded" as FilterTab };
    if (sub)
      return { label: "Đã nộp", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400", icon: CheckCircle2, key: "submitted" as FilterTab };
    const d = daysLeft(dueDate);
    if (d < 0)
      return { label: "Quá hạn", color: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400", icon: AlertCircle, key: "pending" as FilterTab };
    if (d === 0)
      return { label: "Hôm nay", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400", icon: AlertCircle, key: "pending" as FilterTab };
    if (d <= 3)
      return { label: `Còn ${d} ngày`, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400", icon: Clock, key: "pending" as FilterTab };
    return { label: `Còn ${d} ngày`, color: "bg-muted text-muted-foreground", icon: Clock, key: "pending" as FilterTab };
  }

  // Filtered list
  const displayed = useMemo(() => myHomework.filter(hw => {
    if (filterTab === "all") return true;
    return hwStatus(hw.id, hw.due_date).key === filterTab;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [filterTab, submissions, teacherHw]);

  // Sidebar stats
  const submittedCount = myHomework.filter(hw => getSub(hw.id)).length;
  const gradedSubs     = submissions.filter(s => s.score != null && myClassIds.includes(
    myHomework.find(h => h.id === s.homework_id)?.class_id ?? ""
  ));
  const avgScore = gradedSubs.length > 0
    ? (gradedSubs.reduce((a, s) => a + (s.score ?? 0), 0) / gradedSubs.length).toFixed(1)
    : null;

  // Filter tab counts
  const tabCounts: Record<FilterTab, number> = {
    all: myHomework.length,
    pending: myHomework.filter(hw => !getSub(hw.id)).length,
    submitted: myHomework.filter(hw => { const s = getSub(hw.id); return s && s.status !== "graded"; }).length,
    graded: myHomework.filter(hw => getSub(hw.id)?.status === "graded").length,
  };

  // Modal helpers
  function openModal(hw: typeof myHomework[0], type: "submit" | "detail") {
    setSelectedHw(hw);
    setModalType(type);
    setFile(null);
    setUploadState("idle");
    setErrorMsg("");
  }
  function closeModal() {
    setSelectedHw(null);
    setModalType(null);
    setFile(null);
    setUploadState("idle");
    setErrorMsg("");
  }

  function handleFileChange(f: File | null) {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "doc", "docx", "jpg", "jpeg", "png"].includes(ext)) {
      setErrorMsg(`File .${ext} không được hỗ trợ. Chỉ nhận: PDF, Word, JPG, PNG.`);
      setFile(null); return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setErrorMsg(`File vượt quá ${MAX_MB}MB.`);
      setFile(null); return;
    }
    setErrorMsg("");
    setFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !selectedHw) return;
    setUploadState("uploading");

    const uploaded = await uploadSubmissionFile(selectedHw.id, STUDENT_ID, file);
    const subData: Omit<SubmissionRecord, "id"> = {
      homework_id:  selectedHw.id,
      student_id:   STUDENT_ID,
      student_name: STUDENT_NAME,
      file_url:     uploaded?.url,
      file_name:    file.name,
      file_size:    file.size,
      status:       "submitted",
      submitted_at: new Date().toISOString(),
    };

    const saved = await insertSubmission(subData);
    const finalSub: SubmissionRecord = saved ?? { ...subData, id: `local-${Date.now()}` };
    if (!saved) await saveLocalSub(finalSub);

    setSubmissions(prev => [
      ...prev.filter(s => !(s.homework_id === selectedHw.id && s.student_id === STUDENT_ID)),
      finalSub,
    ]);
    setUploadState("success");
    setTimeout(closeModal, 1400);
  }

  return (
    <PortalLayout role="student" userName={STUDENT_NAME} pageTitle="Bài tập">
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        <SectionHeader
          title="Bài tập của tôi"
          subtitle={`${myHomework.length} bài tập · ${submittedCount} đã nộp`}
        />

        {/* ── Filter tabs ───────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "pending", "submitted", "graded"] as FilterTab[]).map(f => (
            <button
              key={f}
              onClick={() => setFilterTab(f)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
                filterTab === f
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {{ all: "Tất cả", pending: "Chưa nộp", submitted: "Đã nộp", graded: "Đã chấm" }[f]}
              {tabCounts[f] > 0 && f !== "all" && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  filterTab === f ? "bg-primary-foreground/20" : "bg-background"
                }`}>
                  {tabCounts[f]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Homework list ────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            {displayed.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground border-2 border-dashed border-border/50 rounded-2xl">
                <FileText className="h-8 w-8 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Không có bài tập nào.</p>
              </div>
            ) : (
              displayed.map((hw, i) => {
                const sub    = getSub(hw.id);
                const cls    = MOCK_CLASSES.find(c => c.id === hw.class_id);
                const status = hwStatus(hw.id, hw.due_date);
                const { icon: StatusIcon } = status;

                return (
                  <Card
                    key={hw.id}
                    className="hover:border-primary/40 transition-colors animate-fade-in group"
                    style={{ animationDelay: `${(i % 6) * 70}ms` }}
                  >
                    <CardContent className="p-5">
                      <div className="flex gap-4">
                        {/* Icon */}
                        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                          <FileText className="h-5 w-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Title + badge */}
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                            <h3 className="font-semibold text-foreground text-base group-hover:text-primary transition-colors leading-snug">
                              {hw.title}
                            </h3>
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${status.color}`}>
                              <StatusIcon className="h-3 w-3" /> {status.label}
                            </span>
                          </div>

                          {/* Meta */}
                          <div className="flex items-center gap-2.5 text-xs text-muted-foreground mb-3 flex-wrap">
                            <span className="bg-muted px-2 py-0.5 rounded-md font-semibold text-foreground">
                              {cls?.class_name ?? hw.class_id}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              Hạn nộp: <span className="font-medium text-foreground">{formatDate(hw.due_date)}</span>
                            </span>
                          </div>

                          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                            {hw.description}
                          </p>

                          {/* Submitted file chip */}
                          {sub?.file_name && (
                            <div className="mt-3 inline-flex items-center gap-2 text-xs bg-muted/50 border border-border/60 rounded-lg px-3 py-1.5 max-w-full">
                              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="truncate font-medium">{sub.file_name}</span>
                              {sub.file_url && (
                                <a
                                  href={sub.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-1 shrink-0 text-primary hover:underline font-semibold"
                                >
                                  Xem
                                </a>
                              )}
                            </div>
                          )}

                          {/* Feedback */}
                          {sub?.status === "graded" && (
                            <div className="mt-3 p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40 text-sm">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-semibold text-emerald-700 dark:text-emerald-400 text-xs">
                                  Nhận xét của Giáo viên:
                                </p>
                                {sub.graded_at && (
                                  <p className="text-[10px] text-muted-foreground">
                                    {new Date(sub.graded_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                  </p>
                                )}
                              </div>
                              {sub.feedback
                                ? <p className="text-foreground/80 italic">"{sub.feedback}"</p>
                                : <p className="text-muted-foreground italic">Giáo viên chưa để lại nhận xét.</p>
                              }
                              {sub.score != null && (
                                <p className="mt-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                                  Điểm: {sub.score}/10
                                </p>
                              )}
                              {(sub as SubmissionRecord & { teacher_file_name?: string; teacher_file_url?: string }).teacher_file_name && (
                                <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg text-xs">
                                  <Download className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                  <span className="flex-1 truncate text-indigo-700 dark:text-indigo-300 font-medium">
                                    {(sub as SubmissionRecord & { teacher_file_name?: string }).teacher_file_name}
                                  </span>
                                  {(sub as SubmissionRecord & { teacher_file_url?: string }).teacher_file_url && (
                                    <a
                                      href={(sub as SubmissionRecord & { teacher_file_url?: string }).teacher_file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-semibold text-indigo-600 hover:underline"
                                    >
                                      Tải xuống
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="mt-4 pt-3.5 border-t border-border flex gap-2.5">
                            {!sub ? (
                              <Button
                                variant="gradient"
                                size="sm"
                                className="font-semibold"
                                onClick={() => openModal(hw, "submit")}
                              >
                                <Upload className="h-3.5 w-3.5 mr-1.5" /> Nộp bài
                              </Button>
                            ) : sub.status === "graded" ? (
                              <Button variant="outline" size="sm" className="font-semibold" disabled>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> Đã chấm
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="font-semibold text-primary border-primary/40 hover:bg-primary/5"
                                onClick={() => openModal(hw, "submit")}
                              >
                                <Upload className="h-3.5 w-3.5 mr-1.5" /> Nộp lại
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => openModal(hw, "detail")}
                            >
                              Chi tiết
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* ── Sidebar ──────────────────────────────────── */}
          <div className="space-y-5">
            {/* Progress card */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-5 space-y-4">
                <div>
                  <h3 className="font-bold text-sm text-foreground mb-0.5">Tiến độ bài tập</h3>
                  <p className="text-xs text-muted-foreground">
                    {submittedCount >= myHomework.length
                      ? "Bạn đã nộp tất cả bài tập!"
                      : `Còn ${myHomework.length - submittedCount} bài chưa nộp`}
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Submitted progress */}
                  <div>
                    <div className="flex justify-between text-xs mb-1 font-medium">
                      <span>Đã nộp</span>
                      <span className="text-primary font-bold">{submittedCount}/{myHomework.length} bài</span>
                    </div>
                    <div className="h-2 w-full bg-background rounded-full overflow-hidden border border-border/40">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-700"
                        style={{ width: `${myHomework.length > 0 ? (submittedCount / myHomework.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Avg score */}
                  {avgScore && (
                    <div>
                      <div className="flex justify-between text-xs mb-1 font-medium">
                        <span>Điểm trung bình</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{avgScore}/10</span>
                      </div>
                      <div className="h-2 w-full bg-background rounded-full overflow-hidden border border-border/40">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                          style={{ width: `${(parseFloat(avgScore) / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Mini breakdown */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40">
                  <div className="text-center">
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{tabCounts.pending}</p>
                    <p className="text-[10px] text-muted-foreground">Chưa nộp</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{tabCounts.submitted}</p>
                    <p className="text-[10px] text-muted-foreground">Đã nộp</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{tabCounts.graded}</p>
                    <p className="text-[10px] text-muted-foreground">Đã chấm</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming deadline */}
            {(() => {
              const upcoming = myHomework
                .filter(hw => !getSub(hw.id))
                .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
              if (!upcoming) return (
                <Card>
                  <CardContent className="p-5 flex items-center gap-3">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
                    <p className="text-sm font-semibold text-foreground">Bạn đã nộp hết bài tập!</p>
                  </CardContent>
                </Card>
              );
              const d = daysLeft(upcoming.due_date);
              const urgent = d <= 2;
              return (
                <Card className={urgent ? "border-amber-200 dark:border-amber-800" : ""}>
                  <CardContent className="p-5 flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${urgent ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"}`}>
                      <AlertCircle className={`h-5 w-5 ${urgent ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">
                        {urgent ? "Sắp đến hạn!" : "Deadline tiếp theo"}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        <span className="font-medium text-foreground">{upcoming.title}</span>
                        {" — "}
                        {d < 0 ? "đã quá hạn" : d === 0 ? "hạn nộp hôm nay" : `còn ${d} ngày`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {modalType && selectedHw && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <Card className="w-full max-w-lg shadow-2xl border-0 overflow-hidden">
            {/* Header */}
            <div className="border-b border-border p-5 flex justify-between items-start bg-muted/30">
              <div>
                <h3 className="font-bold text-base text-foreground">
                  {modalType === "submit" ? "Nộp bài tập" : "Chi tiết bài tập"}
                </h3>
                <p className="text-muted-foreground text-sm mt-0.5 line-clamp-1">{selectedHw.title}</p>
              </div>
              <Button size="icon" variant="ghost" className="rounded-full h-8 w-8 -mt-1 -mr-1 shrink-0" onClick={closeModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <CardContent className="p-5">

              {/* ── Detail ── */}
              {modalType === "detail" && (() => {
                const cls = MOCK_CLASSES.find(c => c.id === selectedHw.class_id);
                const sub = getSub(selectedHw.id);
                return (
                  <div className="space-y-4">
                    {/* Class chip */}
                    <div className="flex items-center gap-3 bg-primary/5 p-3 rounded-xl border border-primary/10">
                      <div className="h-9 w-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lớp học</p>
                        <p className="font-semibold text-sm text-foreground">{cls?.class_name ?? selectedHw.class_id}</p>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Yêu cầu chi tiết</p>
                      <div className="bg-muted/20 p-3.5 rounded-xl text-sm leading-relaxed border border-border">
                        {selectedHw.description}
                      </div>
                    </div>

                    {/* Due + Status */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/20 p-3 rounded-xl border border-border flex items-center gap-2.5">
                        <div className="h-8 w-8 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg flex items-center justify-center shrink-0">
                          <Calendar className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Hạn nộp</p>
                          <p className="font-semibold text-xs">{formatDate(selectedHw.due_date)}</p>
                        </div>
                      </div>
                      <div className="bg-muted/20 p-3 rounded-xl border border-border flex items-center gap-2.5">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${sub ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Trạng thái</p>
                          <p className={`font-semibold text-xs ${sub ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}`}>
                            {sub?.status === "graded" ? "Đã chấm" : sub ? "Đã nộp" : "Chưa nộp"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Submission details */}
                    {sub && (
                      <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                            <Check className="h-4 w-4" /> Đã nộp
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(sub.submitted_at).toLocaleString("vi-VN")}
                          </span>
                        </div>

                        {sub.file_name && (
                          <div className="flex items-center gap-2 bg-white dark:bg-card rounded-lg px-3 py-2 border border-border text-sm">
                            <FileText className="h-4 w-4 text-red-500 shrink-0" />
                            <span className="truncate flex-1 text-xs font-medium">{sub.file_name}</span>
                            {sub.file_url && (
                              <a href={sub.file_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                <Download className="h-4 w-4 text-primary" />
                              </a>
                            )}
                          </div>
                        )}

                        {sub.feedback && (
                          <div className="bg-white dark:bg-card p-3 rounded-lg border border-border text-sm space-y-1.5">
                            <p className="font-bold text-xs text-muted-foreground uppercase tracking-wide">Nhận xét của giáo viên</p>
                            <p className="italic text-foreground/80">"{sub.feedback}"</p>
                            {sub.score != null && (
                              <p className="font-bold text-primary">Điểm: {sub.score}/10</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {!sub && (
                      <Button variant="gradient" className="w-full h-10 font-semibold" onClick={() => setModalType("submit")}>
                        <Upload className="h-4 w-4 mr-2" /> Nộp bài ngay
                      </Button>
                    )}
                  </div>
                );
              })()}

              {/* ── Submit ── */}
              {modalType === "submit" && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Chấp nhận <strong>PDF, Word, JPG, PNG</strong> — tối đa {MAX_MB}MB.
                  </p>

                  {/* Drop zone */}
                  <label
                    className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                      dragOver ? "border-primary bg-primary/10 scale-[1.01]" :
                      file     ? "border-primary bg-primary/5" :
                      "border-border hover:border-primary/40 hover:bg-muted/40"
                    }`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => {
                      e.preventDefault(); setDragOver(false);
                      handleFileChange(e.dataTransfer.files[0] ?? null);
                    }}
                  >
                    <div className="flex flex-col items-center text-center px-4">
                      {file ? (
                        <>
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                            <Check className="h-6 w-6 text-primary" />
                          </div>
                          <p className="text-sm font-bold text-primary truncate max-w-[260px]">{file.name}</p>
                          <p className="text-xs text-primary/60 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground mt-2 underline"
                            onClick={e => { e.preventDefault(); setFile(null); setErrorMsg(""); }}
                          >
                            Chọn file khác
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-2">
                            <Upload className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-foreground mb-0.5">
                            <span className="text-primary font-bold">Nhấn để chọn</span> hoặc kéo thả
                          </p>
                          <p className="text-xs text-muted-foreground">PDF · DOCX · JPG · PNG · tối đa {MAX_MB}MB</p>
                        </>
                      )}
                    </div>
                    <input type="file" accept={ACCEPTED} className="hidden"
                      onChange={e => handleFileChange(e.target.files?.[0] ?? null)} />
                  </label>

                  {errorMsg && (
                    <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {errorMsg}
                    </div>
                  )}

                  {uploadState === "success" && (
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> Nộp bài thành công!
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-1 border-t border-border">
                    <Button type="button" variant="ghost" onClick={closeModal} disabled={uploadState === "uploading"}>
                      Hủy
                    </Button>
                    <Button
                      type="submit"
                      variant="gradient"
                      disabled={!file || uploadState !== "idle"}
                      className="min-w-[130px]"
                    >
                      {uploadState === "uploading" ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang tải lên...</>
                      ) : uploadState === "success" ? (
                        <><Check className="h-4 w-4 mr-2" /> Đã nộp</>
                      ) : (
                        "Xác nhận nộp bài"
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PortalLayout>
  );
}
