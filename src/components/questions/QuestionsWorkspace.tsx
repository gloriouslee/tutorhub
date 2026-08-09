"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleHelp,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  MessageCircle,
  Paperclip,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  ClassQuestionMessage,
  ClassQuestionStatus,
  ClassQuestionThread,
  QuestionAttachmentInput,
} from "@/lib/class-question-types";
import { uploadQuestionFile } from "@/lib/upload";
import type { Class } from "@/types";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_FILE = /\.(pdf|doc|docx|ppt|pptx|png|jpe?g)$/i;

const STATUS_META: Record<
  ClassQuestionStatus,
  { label: string; variant: "warning" | "success" | "secondary" }
> = {
  open: { label: "Đang thảo luận", variant: "warning" },
  answered: { label: "Giáo viên đã trả lời", variant: "success" },
  closed: { label: "Đã khép lại", variant: "secondary" },
};

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(value).toLocaleDateString("vi-VN");
}

function validateFile(file: File | null): string {
  if (!file) return "";
  if (!ACCEPTED_FILE.test(file.name)) {
    return "Chỉ hỗ trợ PDF, Word, PowerPoint và ảnh JPG/PNG.";
  }
  if (file.size > MAX_FILE_BYTES) return "Tệp không được vượt quá 10 MB.";
  return "";
}

function StatusBadge({ status }: { status: ClassQuestionStatus }) {
  const meta = STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

export default function QuestionsWorkspace({
  role,
  classes,
  studentId = "",
  ready,
}: {
  role: "student" | "teacher";
  classes: Class[];
  studentId?: string;
  ready: boolean;
}) {
  const [questions, setQuestions] = useState<ClassQuestionThread[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<"all" | ClassQuestionStatus>("all");
  const [classFilter, setClassFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [creating, setCreating] = useState(false);
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [reply, setReply] = useState("");
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!classId && classes[0]?.id) setClassId(classes[0].id);
  }, [classId, classes]);

  async function loadQuestions() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/questions", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("question_list_failed");
      const items = await response.json() as ClassQuestionThread[];
      setQuestions(items);
      setSelectedId((current) =>
        items.some((item) => item.id === current) ? current : items[0]?.id ?? "",
      );
    } catch {
      setError("Không thể tải danh sách hỏi đáp. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!ready) return;
    void loadQuestions();
  }, [ready, role]);

  const displayed = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return questions.filter((item) =>
      (filter === "all" || item.status === filter)
      && (classFilter === "all" || item.class_id === classFilter)
      && (
        !query
        || item.title.toLocaleLowerCase("vi").includes(query)
        || item.student_name.toLocaleLowerCase("vi").includes(query)
        || item.messages.some((message) =>
          message.content.toLocaleLowerCase("vi").includes(query),
        )
      )
    );
  }, [classFilter, filter, questions, search]);
  const selected = questions.find((item) => item.id === selectedId) ?? null;

  async function uploadAttachment(file: File | null, targetClassId: string) {
    if (!file) return undefined;
    const problem = validateFile(file);
    if (problem) throw new Error(problem);
    if (!studentId) throw new Error("Không xác định được học viên.");
    const uploaded = await uploadQuestionFile(file, targetClassId, studentId);
    return {
      url: uploaded.url,
      name: uploaded.name,
      size: uploaded.size,
    } satisfies QuestionAttachmentInput;
  }

  async function createQuestion(event: React.FormEvent) {
    event.preventDefault();
    if (!classId || title.trim().length < 3 || !content.trim()) return;
    setCreating(true);
    setError("");
    try {
      const attachment = await uploadAttachment(questionFile, classId);
      const response = await fetch("/api/questions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: classId,
          title: title.trim(),
          content: content.trim(),
          attachment,
        }),
      });
      const created = await response.json();
      if (!response.ok) {
        throw new Error(created.error === "rate_limited"
          ? "Bạn gửi quá nhanh. Vui lòng đợi một phút rồi thử lại."
          : "Không thể gửi câu hỏi.");
      }
      setQuestions((current) => [created as ClassQuestionThread, ...current]);
      setSelectedId(String(created.id));
      setTitle("");
      setContent("");
      setQuestionFile(null);
      setShowComposer(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể gửi câu hỏi.");
    } finally {
      setCreating(false);
    }
  }

  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !reply.trim() || selected.status === "closed") return;
    setSending(true);
    setError("");
    try {
      const attachment = role === "student"
        ? await uploadAttachment(replyFile, selected.class_id)
        : undefined;
      const response = await fetch(`/api/questions/${encodeURIComponent(selected.id)}/messages`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply.trim(), attachment }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error === "question_closed"
          ? "Câu hỏi đã đóng. Hãy mở lại trước khi gửi thêm."
          : "Không thể gửi phản hồi.");
      }
      const message = result as ClassQuestionMessage & { status: ClassQuestionStatus };
      setQuestions((current) => current.map((item) =>
        item.id === selected.id
          ? {
              ...item,
              status: message.status,
              last_message_role: message.author_role,
              last_message_at: message.created_at,
              updated_at: message.created_at,
              messages: [...item.messages, message],
            }
          : item,
      ));
      setReply("");
      setReplyFile(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể gửi phản hồi.");
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(status: "open" | "closed") {
    if (!selected) return;
    setUpdatingStatus(true);
    setError("");
    try {
      const response = await fetch(`/api/questions/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Không thể cập nhật trạng thái câu hỏi.");
      setQuestions((current) => current.map((item) =>
        item.id === selected.id ? { ...item, status } : item,
      ));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật câu hỏi.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Cộng đồng học tập</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {role === "student"
                ? "Đặt câu hỏi, chia sẻ cách giải và cùng bạn học trao đổi trong các lớp của bạn."
                : "Tham gia thảo luận, định hướng cách giải và xác nhận kiến thức cho cộng đồng lớp."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadQuestions()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Làm mới
          </Button>
          {role === "student" && (
            <Button size="sm" onClick={() => setShowComposer((current) => !current)}>
              {showComposer ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showComposer ? "Đóng" : "Tạo bài thảo luận"}
            </Button>
          )}
        </div>
      </div>

      {showComposer && role === "student" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <form className="space-y-4" onSubmit={createQuestion}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-sm font-medium">
                  <span>Đăng trong cộng đồng lớp</span>
                  <select
                    value={classId}
                    onChange={(event) => setClassId(event.target.value)}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    required
                  >
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>{item.class_name} · {item.subject}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  <span>Tiêu đề bài đăng</span>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Ví dụ: Cùng thảo luận cách giải câu 3"
                    maxLength={160}
                    required
                  />
                </label>
              </div>
              <label className="block space-y-1.5 text-sm font-medium">
                <span>Nội dung trao đổi</span>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Chia sẻ đề bài, cách bạn đã thử và điều bạn muốn cộng đồng cùng thảo luận..."
                  maxLength={10_000}
                  rows={5}
                  className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <Paperclip className="h-4 w-4" />
                  <span>{questionFile ? questionFile.name : "Đính kèm đề bài (tối đa 10 MB)"}</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setQuestionFile(file);
                      const problem = validateFile(file);
                      setError(problem);
                    }}
                  />
                </label>
                <Button type="submit" disabled={creating || classes.length === 0 || Boolean(validateFile(questionFile))}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {creating ? "Đang đăng..." : "Đăng lên cộng đồng"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/20 dark:text-red-400">{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm chủ đề, nội dung hoặc người đăng..."
            className="pl-9"
            aria-label="Tìm trong cộng đồng"
          />
        </div>
        <select
          value={classFilter}
          onChange={(event) => setClassFilter(event.target.value)}
          aria-label="Lọc theo lớp"
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm sm:w-64"
        >
          <option value="all">Tất cả cộng đồng lớp</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>{item.class_name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Lọc trạng thái thảo luận">
        {(["all", "open", "answered", "closed"] as const).map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === item
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {item === "all" ? "Tất cả thảo luận" : STATUS_META[item].label}
          </button>
        ))}
      </div>

      <div className="grid min-h-[600px] overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="border-b border-border lg:border-b-0 lg:border-r">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải câu hỏi...
            </div>
          ) : displayed.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <CircleHelp className="mx-auto mb-3 h-9 w-9 opacity-30" />
              <p className="text-sm font-medium">Chưa có bài thảo luận phù hợp.</p>
            </div>
          ) : (
            <div className="max-h-[560px] divide-y divide-border overflow-y-auto">
              {displayed.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full p-4 text-left transition-colors ${
                    selectedId === item.id ? "bg-primary/10" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <StatusBadge status={item.status} />
                    <span className="text-[11px] text-muted-foreground">{relativeTime(item.last_message_at)}</span>
                  </div>
                  <p className="line-clamp-2 text-sm font-semibold text-foreground">{item.title}</p>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="min-w-0 truncate">{item.student_name} · {item.class_name}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" /> {Math.max(0, item.messages.length - 1)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {!selected ? (
          <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground">
            <CircleHelp className="mb-3 h-12 w-12 opacity-20" />
            <p className="font-medium">Chọn một chủ đề để tham gia thảo luận.</p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-col">
            <div className="border-b border-border p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={selected.status} />
                    <span className="text-xs text-muted-foreground">{selected.class_name}</span>
                  </div>
                  <h2 className="font-bold text-foreground">{selected.title}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <GraduationCap className="h-3.5 w-3.5" />
                    Đăng bởi {selected.student_name} trong {selected.class_name}
                  </p>
                </div>
                {(role === "teacher" || selected.student_id === studentId) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updatingStatus}
                    onClick={() => void changeStatus(selected.status === "closed" ? "open" : "closed")}
                  >
                    {selected.status === "closed"
                      ? <><RotateCcw className="h-4 w-4" /> Mở lại thảo luận</>
                      : <><CheckCircle2 className="h-4 w-4" /> Khép lại</>}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4 sm:p-5">
              {selected.messages.map((message, index) => (
                <article key={message.id} className="flex items-start gap-3">
                  <Avatar className="mt-0.5 h-9 w-9 shrink-0 border border-border">
                    <AvatarFallback name={message.author_name} />
                  </Avatar>
                  <div className={`min-w-0 flex-1 rounded-2xl border p-4 ${
                    message.author_role === "teacher"
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-card"
                  }`}>
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-foreground">{message.author_name}</span>
                      {message.author_role === "teacher" ? (
                        <Badge variant="success">Giáo viên</Badge>
                      ) : (
                        <Badge variant="outline">Học viên</Badge>
                      )}
                      {message.is_own && <Badge variant="secondary">Bạn</Badge>}
                      {index === 0 && <span className="text-muted-foreground">Bài đăng gốc</span>}
                      <span className="ml-auto text-muted-foreground">{relativeTime(message.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {message.content}
                    </p>
                    {message.attachment_url && (
                      <a
                        href={message.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs font-medium hover:bg-accent"
                      >
                        <FileText className="h-4 w-4" />
                        <span className="min-w-0 flex-1 truncate">{message.attachment_name ?? "Tệp đính kèm"}</span>
                        {message.attachment_size && <span className="text-muted-foreground">{message.attachment_size}</span>}
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <form className="border-t border-border p-4" onSubmit={sendReply}>
              {selected.status === "closed" ? (
                <p className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" /> Thảo luận đã khép lại. Chủ bài đăng hoặc giáo viên có thể mở lại.
                </p>
              ) : (
                <>
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <MessageCircle className="h-4 w-4 text-primary" /> Tham gia thảo luận
                  </p>
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder={role === "teacher" ? "Định hướng cách giải hoặc xác nhận kiến thức cho cộng đồng..." : "Chia sẻ cách giải, góp ý hoặc đặt câu hỏi tiếp theo..."}
                    rows={3}
                    maxLength={10_000}
                    className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    {role === "student" ? (
                      <label className="inline-flex min-w-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                        <Paperclip className="h-4 w-4 shrink-0" />
                        <span className="truncate">{replyFile ? replyFile.name : "Đính kèm thêm"}</span>
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            setReplyFile(file);
                            const problem = validateFile(file);
                            setError(problem);
                          }}
                        />
                      </label>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" /> Phản hồi của giáo viên sẽ được đánh dấu nổi bật
                      </span>
                    )}
                    <Button type="submit" size="sm" disabled={sending || !reply.trim() || Boolean(validateFile(replyFile))}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Gửi
                    </Button>
                  </div>
                </>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
