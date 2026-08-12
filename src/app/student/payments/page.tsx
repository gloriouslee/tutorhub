"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared";
import {
  createTransaction,
  getInvoicesOrThrow,
  getTeacherSettings,
  getTransactions,
  submitInvoiceReceipt,
  type PurchaseTransaction,
  type TeacherSettings,
  type TuitionInvoice,
} from "@/lib/storage";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  FileCheck2,
  Info,
  Landmark,
  Loader2,
  QrCode,
  Receipt,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useStudentContext } from "@/hooks/useStudentContext";
import {
  loadTeacherCourses,
  teacherCourseToPaidPackage,
} from "@/components/student/materialsShared";
import StudentScopeBar, {
  ALL_STUDENT_SCOPE,
  classMatchesStudentScope,
  useStudentWorkspaceScope,
} from "@/components/student/StudentScopeBar";

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type Invoice = TuitionInvoice;
type PaymentTab = "due" | "verifying" | "completed" | "rejected";
type PaymentModalTarget =
  | {
      kind: "invoice";
      invoiceIds: string[];
      teacherId: string;
      teacherName: string;
      title: string;
      amount: number;
    }
  | {
      kind: "package";
      pkgId: string;
      teacherId: string;
      teacherName: string;
      classId?: string;
      title: string;
      amount: number;
    }
  | { kind: "policy" };

type ActivityItem = {
  key: string;
  kind: "invoice" | "package";
  title: string;
  amount: number;
  status: "pending" | "pending_verification" | "paid" | "approved" | "rejected";
  date: string;
  dateLabel: string;
  className?: string;
  teacherName?: string;
  reference: string;
  receiptPath?: string;
  rejectionReason?: string;
  retryTarget?: Extract<PaymentModalTarget, { kind: "package" }>;
};

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}

function isOverdue(dueDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parseDateOnly(dueDate).getTime() < today.getTime();
}

function isDueSoon(dueDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const difference = parseDateOnly(dueDate).getTime() - today.getTime();
  return difference >= 0 && difference <= 7 * 24 * 60 * 60 * 1000;
}

function formatDateTime(value?: string) {
  if (!value) return "Chưa có thời gian";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function receiptUrl(path: string) {
  return `/api/files?bucket=payment-receipts&path=${encodeURIComponent(path)}`;
}

function receiptValidationError(file: File) {
  if (!ALLOWED_RECEIPT_TYPES.has(file.type)) {
    return "Biên lai phải là ảnh JPG, PNG, WEBP hoặc tệp PDF.";
  }
  if (file.size <= 0 || file.size > MAX_RECEIPT_BYTES) {
    return "Biên lai phải có dung lượng từ 1 byte đến 10 MB.";
  }
  return "";
}

const PAYMENT_ERRORS: Record<string, string> = {
  invalid_receipt_file: "Tệp biên lai không đúng định dạng hoặc vượt quá 10 MB.",
  invalid_receipt_content: "Nội dung tệp không khớp với định dạng ảnh/PDF.",
  receipt_upload_failed: "Không thể tải biên lai lên. Vui lòng thử lại.",
  mixed_payment_recipients: "Không thể gộp hóa đơn của nhiều người nhận.",
  invoice_not_found: "Hóa đơn đã thay đổi hoặc không còn chờ thanh toán.",
  payment_create_failed: "Không thể tạo giao dịch. Vui lòng thử lại.",
  product_not_found: "Gói tài liệu không còn khả dụng.",
};

function paymentErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (PAYMENT_ERRORS[message] ?? message) || "Không thể gửi biên lai. Vui lòng thử lại.";
}

function PaymentsSkeleton() {
  return (
    <div className="space-y-5" aria-label="Đang tải dữ liệu thanh toán" aria-busy="true">
      <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="h-12 animate-pulse rounded-xl bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  onClick,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  detail: string;
  tone: "red" | "amber" | "blue";
  onClick: () => void;
}) {
  const tones = {
    red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/60",
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/60",
    blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900/60",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tones[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold opacity-80">{label}</p>
          <p className="mt-1 text-xl font-bold">{value}</p>
          <p className="mt-1 text-[11px] opacity-75">{detail}</p>
        </div>
        <Icon className="h-5 w-5 shrink-0" />
      </div>
    </button>
  );
}

function ActivityCard({
  item,
  onRetry,
}: {
  item: ActivityItem;
  onRetry: (target: Extract<PaymentModalTarget, { kind: "package" }>) => void;
}) {
  const approved = item.status === "approved" || item.status === "paid";
  const rejected = item.status === "rejected";
  const statusLabel = approved
    ? "Đã hoàn tất"
    : rejected
      ? "Cần gửi lại"
      : "Chờ giáo viên xác nhận";

  return (
    <Card className={rejected ? "border-red-200 dark:border-red-900/60" : undefined}>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            approved
              ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
              : rejected
                ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          }`}
        >
          {approved ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : rejected ? (
            <XCircle className="h-5 w-5" />
          ) : (
            <Clock className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={approved ? "success" : rejected ? "destructive" : "info"}>
              {statusLabel}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {item.kind === "package" ? "Tài liệu" : "Học phí"}
            </span>
          </div>
          <h4 className="mt-2 font-semibold text-foreground">{item.title}</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {[item.className, item.teacherName].filter(Boolean).join(" · ") || item.reference}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{item.dateLabel}</p>
          {rejected && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
              <span className="font-semibold">Lý do:</span>{" "}
              {item.rejectionReason || "Giáo viên chưa cung cấp lý do cụ thể."}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-row items-center justify-between gap-3 border-t border-border pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
          <p className="text-lg font-bold text-foreground">{formatCurrency(item.amount)}</p>
          <div className="flex flex-wrap justify-end gap-2">
            {item.receiptPath && (
              <Button asChild size="sm" variant="outline">
                <a href={receiptUrl(item.receiptPath)} target="_blank" rel="noreferrer">
                  Xem biên lai <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            {rejected && item.retryTarget && (
              <Button size="sm" onClick={() => onRetry(item.retryTarget!)}>
                Gửi lại <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CopyRow({
  label,
  value,
  copyKey,
  copiedKey,
  onCopy,
}: {
  label: string;
  value: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
}) {
  const copied = copiedKey === copyKey;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-semibold text-foreground">{value}</p>
      </div>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0"
        aria-label={`Sao chép ${label.toLowerCase()}`}
        onClick={() => onCopy(copyKey, value)}
      >
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function PaymentDialog({
  target,
  studentId,
  studentName,
  settings,
  onClose,
  onSubmitted,
}: {
  target: PaymentModalTarget | null;
  studentId: string;
  studentName: string;
  settings: Record<string, TeacherSettings>;
  onClose: () => void;
  onSubmitted: () => Promise<void>;
}) {
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [successReference, setSuccessReference] = useState<string | null>(null);

  useEffect(() => {
    setReceiptFile(null);
    setSubmitting(false);
    setSubmitError("");
    setCopiedKey(null);
    setSuccessReference(null);
  }, [target]);

  if (!target) return null;

  const isPolicy = target.kind === "policy";
  const paymentTarget = target.kind === "policy" ? null : target;
  const teacherPayment = paymentTarget ? settings[paymentTarget.teacherId] ?? {} : {};
  const hasPaymentDestination = Boolean(
    teacherPayment.qr_image_url || teacherPayment.account_number,
  );
  const transferNote = paymentTarget?.kind === "package"
    ? `TUTORHUB ${paymentTarget.pkgId.toUpperCase()} ${studentId}`
    : paymentTarget?.kind === "invoice"
      ? `TT ${paymentTarget.invoiceIds[0]}${paymentTarget.invoiceIds.length > 1 ? `+${paymentTarget.invoiceIds.length - 1}` : ""} ${studentName.toUpperCase().replace(/\s+/g, "")}`
      : "";

  const selectReceipt = (file?: File | null) => {
    if (!file) return;
    const error = receiptValidationError(file);
    if (error) {
      setReceiptFile(null);
      setSubmitError(error);
      return;
    }
    setReceiptFile(file);
    setSubmitError("");
  };

  const copyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => current === key ? null : current), 1600);
    } catch {
      setSubmitError("Trình duyệt không cho phép sao chép tự động. Vui lòng chọn và sao chép thủ công.");
    }
  };

  const handleConfirm = async () => {
    if (!paymentTarget || !receiptFile || !hasPaymentDestination) return;
    setSubmitting(true);
    setSubmitError("");

    try {
      const form = new FormData();
      form.append("file", receiptFile);
      const uploadResponse = await fetch("/api/payments/receipts", {
        method: "POST",
        body: form,
      });
      const uploaded = await uploadResponse.json().catch(() => ({})) as {
        path?: string;
        error?: string;
      };
      if (!uploadResponse.ok || !uploaded.path) {
        throw new Error(uploaded.error || "receipt_upload_failed");
      }

      let reference: string;
      if (paymentTarget.kind === "invoice") {
        await submitInvoiceReceipt(paymentTarget.invoiceIds, undefined, uploaded.path);
        reference = paymentTarget.invoiceIds.join(", ");
      } else {
        const transaction = await createTransaction({
          pkg_id: paymentTarget.pkgId,
          pkg_title: paymentTarget.title,
          amount: paymentTarget.amount,
          student_id: studentId,
          student_name: studentName,
          student_email: "",
          class_id: paymentTarget.classId,
          teacher_id: paymentTarget.teacherId,
          receipt_path: uploaded.path,
          transfer_note: transferNote,
        });
        reference = transaction.id;
      }

      await onSubmitted();
      setReceiptFile(null);
      setSuccessReference(reference);
    } catch (error) {
      setSubmitError(paymentErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl focus:outline-none">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/60 p-4 sm:p-5">
            <div>
              <Dialog.Title className="flex items-center gap-2 text-lg font-bold text-foreground">
                {isPolicy ? <Info className="h-5 w-5 text-primary" /> : <QrCode className="h-5 w-5 text-primary" />}
                {isPolicy ? "Hướng dẫn thanh toán" : paymentTarget?.kind === "package" ? "Mua tài liệu" : "Thanh toán học phí"}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                {isPolicy
                  ? "Các bước và nguyên tắc đang được áp dụng trên TutorHub."
                  : "Kiểm tra đúng người nhận, chuyển khoản và gửi biên lai để giáo viên xác nhận."}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full" aria-label="Đóng cửa sổ">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          {isPolicy ? (
            <div className="space-y-4 overflow-y-auto p-5 sm:p-6">
              {[
                {
                  icon: CalendarClock,
                  title: "Thanh toán theo hạn trên hóa đơn",
                  body: "Mỗi hóa đơn có hạn riêng. Các khoản quá hạn và sắp đến hạn luôn được ưu tiên ở đầu trang.",
                },
                {
                  icon: Landmark,
                  title: "Chuyển khoản theo từng giáo viên",
                  body: "Không gộp các hóa đơn của nhiều giáo viên. Hãy dùng đúng tài khoản, số tiền và nội dung hiển thị trong cửa sổ thanh toán.",
                },
                {
                  icon: FileCheck2,
                  title: "Gửi biên lai sau khi chuyển khoản",
                  body: "Hệ thống chấp nhận JPG, PNG, WEBP hoặc PDF tối đa 10 MB. Không cần thanh toán lại khi giao dịch đang chờ xác nhận.",
                },
                {
                  icon: ShieldCheck,
                  title: "Giáo viên phụ trách đối soát",
                  body: "Khi được duyệt hoặc từ chối, trạng thái và lý do sẽ xuất hiện trong lịch sử thanh toán của bạn.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </div>
              ))}
              <Dialog.Close asChild>
                <Button className="w-full">Đã hiểu</Button>
              </Dialog.Close>
            </div>
          ) : successReference ? (
            <div className="flex flex-col items-center px-6 py-10 text-center" role="status">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <ClipboardCheck className="h-8 w-8" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-foreground">Đã gửi biên lai thành công</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Giao dịch đã chuyển sang trạng thái chờ giáo viên xác nhận. Bạn không cần thanh toán lại.
              </p>
              <div className="mt-5 rounded-xl bg-muted px-4 py-3">
                <p className="text-[11px] text-muted-foreground">Mã tham chiếu</p>
                <p className="mt-1 break-all font-mono text-sm font-semibold text-foreground">{successReference}</p>
              </div>
              <Dialog.Close asChild>
                <Button className="mt-6 min-w-40">Hoàn tất</Button>
              </Dialog.Close>
            </div>
          ) : (
            <>
              <div className="overflow-y-auto p-5 sm:p-6">
                <ol className="mb-5 grid grid-cols-3 gap-2 text-center text-[11px] font-medium text-muted-foreground" aria-label="Các bước thanh toán">
                  {["Kiểm tra", "Chuyển khoản", "Gửi biên lai"].map((step, index) => (
                    <li key={step} className="rounded-lg bg-muted/60 px-2 py-2">
                      <span className="mr-1 text-primary">{index + 1}.</span>{step}
                    </li>
                  ))}
                </ol>

                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
                  <p className="text-xs text-muted-foreground">Số tiền cần thanh toán</p>
                  <p className="mt-1 text-3xl font-black text-primary">{formatCurrency(paymentTarget?.amount ?? 0)}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{paymentTarget?.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Người nhận: {paymentTarget?.teacherName}</p>
                </div>

                {!hasPaymentDestination ? (
                  <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>Giáo viên chưa cấu hình tài khoản nhận tiền. Vui lòng liên hệ giáo viên trước khi chuyển khoản.</p>
                  </div>
                ) : (
                  <div className="mt-5 grid gap-5 sm:grid-cols-[180px_1fr] sm:items-start">
                    {teacherPayment.qr_image_url ? (
                      <div className="mx-auto rounded-2xl border border-border bg-white p-3 shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={teacherPayment.qr_image_url}
                          alt={`Mã QR nhận tiền của ${paymentTarget?.teacherName}`}
                          className="h-40 w-40 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="mx-auto flex h-44 w-44 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 text-center text-muted-foreground">
                        <Landmark className="h-8 w-8 opacity-50" />
                        <p className="mt-2 px-4 text-xs">Chuyển khoản thủ công theo thông tin bên cạnh</p>
                      </div>
                    )}
                    <div className="rounded-xl border border-border/60 bg-muted/20 px-3">
                      {teacherPayment.bank_name && (
                        <CopyRow label="Ngân hàng" value={teacherPayment.bank_name} copyKey="bank" copiedKey={copiedKey} onCopy={copyText} />
                      )}
                      {teacherPayment.account_number && (
                        <CopyRow label="Số tài khoản" value={teacherPayment.account_number} copyKey="account" copiedKey={copiedKey} onCopy={copyText} />
                      )}
                      {teacherPayment.account_holder && (
                        <CopyRow label="Chủ tài khoản" value={teacherPayment.account_holder} copyKey="holder" copiedKey={copiedKey} onCopy={copyText} />
                      )}
                      <CopyRow label="Số tiền" value={String(paymentTarget?.amount ?? 0)} copyKey="amount" copiedKey={copiedKey} onCopy={copyText} />
                      <CopyRow label="Nội dung chuyển khoản" value={transferNote} copyKey="note" copiedKey={copiedKey} onCopy={copyText} />
                    </div>
                  </div>
                )}

                <div className="mt-6 border-t border-border/60 pt-5">
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <UploadCloud className="h-4 w-4 text-primary" />
                    Biên lai giao dịch <span className="text-red-500">*</span>
                  </p>
                  <input
                    id="student-payment-receipt"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,application/pdf,image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => selectReceipt(event.target.files?.[0])}
                  />
                  <label
                    htmlFor="student-payment-receipt"
                    className="mt-3 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-border p-5 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 focus-within:ring-2 focus-within:ring-ring"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      selectReceipt(event.dataTransfer.files?.[0]);
                    }}
                  >
                    {receiptFile ? (
                      <>
                        <FileCheck2 className="h-7 w-7 text-emerald-600" />
                        <span className="mt-2 max-w-full truncate text-sm font-semibold text-emerald-700 dark:text-emerald-400">{receiptFile.name}</span>
                        <span className="mt-1 text-xs text-muted-foreground">{formatFileSize(receiptFile.size)} · Bấm để chọn tệp khác</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-7 w-7 text-muted-foreground" />
                        <span className="mt-2 text-sm font-medium text-foreground">Bấm hoặc kéo thả biên lai vào đây</span>
                        <span className="mt-1 text-xs text-muted-foreground">JPG, PNG, WEBP, PDF · Tối đa 10 MB</span>
                      </>
                    )}
                  </label>
                </div>

                {submitError && (
                  <div className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300" role="alert">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{submitError}</p>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 gap-3 border-t border-border/60 bg-muted/10 p-4">
                <Dialog.Close asChild>
                  <Button variant="outline" className="flex-1">Hủy</Button>
                </Dialog.Close>
                <Button
                  className="flex-1"
                  disabled={!receiptFile || submitting || !hasPaymentDestination}
                  onClick={handleConfirm}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {submitting ? "Đang gửi..." : "Xác nhận đã chuyển"}
                </Button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PaymentsContent() {
  const { studentId, studentName, myClasses, ready } = useStudentContext();
  const { scope, setScope } = useStudentWorkspaceScope(myClasses);
  const params = useSearchParams();
  const pkgParam = params.get("pkg");
  const requestIdRef = useRef(0);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [transactions, setTransactions] = useState<PurchaseTransaction[]>([]);
  const [teacherSettings, setTeacherSettings] = useState<Record<string, TeacherSettings>>({});
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState<PaymentTab>("due");
  const [modalTarget, setModalTarget] = useState<PaymentModalTarget | null>(null);

  const classSignature = myClasses.map((item) => `${item.id}:${item.tutor_id}`).join("|");
  const classById = useMemo(
    () => new Map(myClasses.map((item) => [item.id, item])),
    [myClasses],
  );

  const loadPayments = useCallback(async (showLoading = true) => {
    if (!ready || !studentId) return;
    const requestId = ++requestIdRef.current;
    if (showLoading) setLoadState("loading");
    setLoadError("");

    try {
      const [invoiceList, transactionList] = await Promise.all([
        getInvoicesOrThrow(),
        getTransactions(),
      ]);
      if (requestId !== requestIdRef.current) return;
      setInvoices(invoiceList.filter((invoice) => invoice.child_id === studentId));
      setTransactions(transactionList.filter((transaction) => transaction.student_id === studentId));
      setLoadState("ready");
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setLoadError(error instanceof Error ? error.message : "Không thể tải dữ liệu thanh toán.");
      setLoadState("error");
    }
  }, [ready, studentId]);

  useEffect(() => {
    if (ready) void loadPayments();
  }, [loadPayments, ready]);

  useEffect(() => {
    if (!ready) return;
    const teacherIds = [...new Set(myClasses.map((item) => item.tutor_id).filter(Boolean))];
    let active = true;
    void Promise.allSettled(
      teacherIds.map(async (teacherId) => [teacherId, await getTeacherSettings(teacherId)] as const),
    ).then((results) => {
      if (!active) return;
      const entries = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      setTeacherSettings(Object.fromEntries(entries));
    });
    return () => { active = false; };
  }, [classSignature, myClasses, ready]);

  useEffect(() => {
    if (!ready || !pkgParam) return;
    let active = true;
    void loadTeacherCourses()
      .then((courses) => {
        if (!active) return;
        const course = courses.find((item) =>
          item.id === pkgParam
          && item.type === "paid_package"
          && item.published
          && typeof item.price === "number"
          && item.price > 0,
        );
        if (!course) return;
        const pkg = teacherCourseToPaidPackage(course);
        const cls = course.classId ? myClasses.find((item) => item.id === course.classId) : undefined;
        setModalTarget({
          kind: "package",
          pkgId: pkg.id,
          title: pkg.title,
          amount: pkg.price,
          teacherId: cls?.tutor_id ?? "",
          teacherName: cls?.tutor_name ?? "Giáo viên phụ trách",
          classId: cls?.id,
        });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [classSignature, myClasses, pkgParam, ready]);

  const scopedInvoices = invoices.filter((invoice) => {
    if (!invoice.class_id) {
      return scope.teacherId === ALL_STUDENT_SCOPE && scope.classId === ALL_STUDENT_SCOPE;
    }
    return classMatchesStudentScope(classById.get(invoice.class_id), scope);
  });
  const scopedTransactions = transactions.filter((transaction) => {
    if (transaction.class_id) {
      return classMatchesStudentScope(classById.get(transaction.class_id), scope);
    }
    if (scope.classId !== ALL_STUDENT_SCOPE) return false;
    return scope.teacherId === ALL_STUDENT_SCOPE || transaction.teacher_id === scope.teacherId;
  });

  const pendingInvoices = scopedInvoices.filter((invoice) => invoice.status === "pending");
  const totalPending = pendingInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const overdueInvoices = pendingInvoices.filter((invoice) => isOverdue(invoice.due_date));
  const dueSoonInvoices = pendingInvoices.filter((invoice) => isDueSoon(invoice.due_date));

  const pendingGroups = useMemo(() => {
    const groups = new Map<string, {
      teacherId: string;
      teacherName: string;
      invoices: Invoice[];
      amount: number;
    }>();
    pendingInvoices.forEach((invoice) => {
      const cls = invoice.class_id ? classById.get(invoice.class_id) : undefined;
      const teacherId = cls?.tutor_id ?? "unassigned";
      const current = groups.get(teacherId) ?? {
        teacherId,
        teacherName: cls?.tutor_name || "Chưa xác định giáo viên",
        invoices: [],
        amount: 0,
      };
      current.invoices.push(invoice);
      current.amount += invoice.amount;
      groups.set(teacherId, current);
    });
    return [...groups.values()];
  }, [classById, pendingInvoices]);

  const activityItems = useMemo<ActivityItem[]>(() => {
    const invoiceItems: ActivityItem[] = scopedInvoices
      .filter((invoice) => invoice.status !== "pending")
      .map((invoice) => {
        const cls = invoice.class_id ? classById.get(invoice.class_id) : undefined;
        return {
          key: `invoice-${invoice.id}`,
          kind: "invoice",
          title: invoice.title,
          amount: invoice.amount,
          status: invoice.status,
          date: invoice.paid_at ?? invoice.submitted_at ?? invoice.due_date,
          dateLabel: invoice.status === "paid"
            ? invoice.paid_at ? `Xác nhận: ${formatDateTime(invoice.paid_at)}` : "Đã được xác nhận"
            : invoice.submitted_at ? `Gửi biên lai: ${formatDateTime(invoice.submitted_at)}` : "Biên lai đang chờ xác nhận",
          className: cls?.class_name,
          teacherName: cls?.tutor_name,
          reference: invoice.id,
          receiptPath: invoice.receipt_path,
        };
      });
    const transactionItems: ActivityItem[] = scopedTransactions.map((transaction) => {
      const cls = transaction.class_id ? classById.get(transaction.class_id) : undefined;
      return {
        key: `package-${transaction.id}`,
        kind: "package",
        title: transaction.pkg_title,
        amount: transaction.amount,
        status: transaction.status,
        date: transaction.reviewed_at ?? transaction.created_at,
        dateLabel: transaction.status === "pending"
          ? `Gửi biên lai: ${formatDateTime(transaction.created_at)}`
          : transaction.status === "rejected"
            ? transaction.reviewed_at ? `Phản hồi: ${formatDateTime(transaction.reviewed_at)}` : "Đã bị từ chối"
            : transaction.reviewed_at ? `Xác nhận: ${formatDateTime(transaction.reviewed_at)}` : "Đã được xác nhận",
        className: cls?.class_name,
        teacherName: cls?.tutor_name,
        reference: transaction.id,
        receiptPath: transaction.receipt_path,
        rejectionReason: transaction.rejection_reason,
        retryTarget: transaction.status === "rejected" ? {
          kind: "package",
          pkgId: transaction.pkg_id,
          title: transaction.pkg_title,
          amount: transaction.amount,
          teacherId: transaction.teacher_id ?? cls?.tutor_id ?? "",
          teacherName: cls?.tutor_name ?? "Giáo viên phụ trách",
          classId: transaction.class_id,
        } : undefined,
      };
    });
    return [...invoiceItems, ...transactionItems]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [classById, scopedInvoices, scopedTransactions]);

  const verifyingItems = activityItems.filter((item) =>
    item.status === "pending" || item.status === "pending_verification",
  );
  const completedItems = activityItems.filter((item) =>
    item.status === "paid" || item.status === "approved",
  );
  const rejectedItems = activityItems.filter((item) => item.status === "rejected");

  const openGroupPayment = (group: typeof pendingGroups[number]) => {
    if (group.teacherId === "unassigned") return;
    setModalTarget({
      kind: "invoice",
      invoiceIds: group.invoices.map((invoice) => invoice.id),
      teacherId: group.teacherId,
      teacherName: group.teacherName,
      title: group.invoices.length === 1
        ? group.invoices[0].title
        : `${group.invoices.length} hóa đơn · ${group.teacherName}`,
      amount: group.amount,
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <SectionHeader
        title="Thanh toán"
        subtitle="Theo dõi hóa đơn, gửi biên lai và kiểm tra trạng thái xác nhận theo từng giáo viên."
        action={
          <Button size="sm" variant="outline" onClick={() => setModalTarget({ kind: "policy" })}>
            <Info className="h-4 w-4" /> Hướng dẫn
          </Button>
        }
      />

      <StudentScopeBar classes={myClasses} scope={scope} onChange={setScope} />

      {!ready || loadState === "loading" ? (
        <PaymentsSkeleton />
      ) : loadState === "error" ? (
        <Card className="border-red-200 dark:border-red-900/60">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-bold text-foreground">Chưa thể tải dữ liệu thanh toán</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">{loadError}</p>
            <Button className="mt-5" onClick={() => void loadPayments()}>
              <RefreshCw className="h-4 w-4" /> Thử lại
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden border-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 text-white shadow-lg">
            <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="text-sm font-medium text-indigo-100">Tổng cần thanh toán trong phạm vi đang xem</p>
                <p className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{formatCurrency(totalPending)}</p>
                <p className="mt-2 text-xs text-indigo-100/90">
                  {pendingInvoices.length > 0
                    ? `${pendingInvoices.length} hóa đơn · Thanh toán riêng theo từng giáo viên`
                    : verifyingItems.length > 0
                      ? "Không còn khoản chưa thanh toán; biên lai đang được kiểm tra."
                      : "Bạn không có khoản thanh toán nào đang chờ."}
                </p>
              </div>
              <Button
                size="lg"
                className="bg-white text-indigo-700 hover:bg-indigo-50"
                disabled={pendingInvoices.length === 0}
                onClick={() => setActiveTab("due")}
              >
                <CreditCard className="h-5 w-5" /> Xem khoản cần trả
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              icon={AlertCircle}
              label="Đã quá hạn"
              value={`${overdueInvoices.length} hóa đơn`}
              detail={formatCurrency(overdueInvoices.reduce((sum, invoice) => sum + invoice.amount, 0))}
              tone="red"
              onClick={() => setActiveTab("due")}
            />
            <SummaryCard
              icon={CalendarClock}
              label="Đến hạn trong 7 ngày"
              value={`${dueSoonInvoices.length} hóa đơn`}
              detail={formatCurrency(dueSoonInvoices.reduce((sum, invoice) => sum + invoice.amount, 0))}
              tone="amber"
              onClick={() => setActiveTab("due")}
            />
            <SummaryCard
              icon={Clock}
              label="Đang chờ xác nhận"
              value={`${verifyingItems.length} giao dịch`}
              detail="Không cần thanh toán lại"
              tone="blue"
              onClick={() => setActiveTab("verifying")}
            />
          </div>

          <Tabs.Root value={activeTab} onValueChange={(value) => setActiveTab(value as PaymentTab)}>
            <Tabs.List className="grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-muted/30 p-2 lg:grid-cols-4" aria-label="Trạng thái thanh toán">
              {[
                { value: "due", label: "Cần thanh toán", count: pendingInvoices.length, icon: WalletCards },
                { value: "verifying", label: "Chờ xác nhận", count: verifyingItems.length, icon: Clock },
                { value: "completed", label: "Đã hoàn tất", count: completedItems.length, icon: CheckCircle2 },
                { value: "rejected", label: "Cần xử lý lại", count: rejectedItems.length, icon: XCircle },
              ].map(({ value, label, count, icon: Icon }) => (
                <Tabs.Trigger
                  key={value}
                  value={value}
                  className="flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{count}</span>
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <Tabs.Content value="due" className="mt-5 space-y-5 focus:outline-none">
              {pendingGroups.length > 0 ? pendingGroups.map((group) => (
                <section key={group.teacherId} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className="flex flex-col gap-3 border-b border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Người nhận học phí</p>
                      <h3 className="mt-0.5 font-bold text-foreground">{group.teacherName}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{group.invoices.length} hóa đơn · {formatCurrency(group.amount)}</p>
                    </div>
                    {group.invoices.length > 1 && (
                      <Button size="sm" variant="outline" disabled={group.teacherId === "unassigned"} onClick={() => openGroupPayment(group)}>
                        Thanh toán {group.invoices.length} hóa đơn <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="divide-y divide-border/60">
                    {group.invoices.map((invoice) => {
                      const overdue = isOverdue(invoice.due_date);
                      const cls = invoice.class_id ? classById.get(invoice.class_id) : undefined;
                      return (
                        <div key={invoice.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={overdue ? "destructive" : "warning"}>{overdue ? "Quá hạn" : "Chưa thanh toán"}</Badge>
                              <span className="font-mono text-[11px] text-muted-foreground">{invoice.id}</span>
                            </div>
                            <h4 className="mt-2 font-semibold text-foreground">{invoice.title}</h4>
                            <p className="mt-1 text-xs text-muted-foreground">{cls?.class_name ?? "Hóa đơn chưa gắn lớp"}</p>
                            <p className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${overdue ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                              <CalendarClock className="h-3.5 w-3.5" />
                              {overdue ? "Đã quá hạn" : "Hạn thanh toán"}: {formatDate(invoice.due_date)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                            <p className="text-lg font-bold text-foreground">{formatCurrency(invoice.amount)}</p>
                            <Button size="sm" variant={overdue ? "destructive" : "gradient"} disabled={group.teacherId === "unassigned"} onClick={() => {
                              setModalTarget({
                                kind: "invoice",
                                invoiceIds: [invoice.id],
                                teacherId: group.teacherId,
                                teacherName: group.teacherName,
                                title: invoice.title,
                                amount: invoice.amount,
                              });
                            }}>
                              Thanh toán <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center px-6 py-12 text-center">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                    <h3 className="mt-3 font-semibold text-foreground">Không có khoản cần thanh toán</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {verifyingItems.length > 0
                        ? `${verifyingItems.length} giao dịch đang chờ giáo viên xác nhận.`
                        : "Các khoản phát sinh mới sẽ xuất hiện tại đây."}
                    </p>
                  </CardContent>
                </Card>
              )}
            </Tabs.Content>

            {([
              { value: "verifying", items: verifyingItems, empty: "Không có giao dịch nào đang chờ xác nhận." },
              { value: "completed", items: completedItems, empty: "Chưa có giao dịch hoàn tất trong phạm vi này." },
              { value: "rejected", items: rejectedItems, empty: "Không có giao dịch nào cần xử lý lại." },
            ] as const).map(({ value, items, empty }) => (
              <Tabs.Content key={value} value={value} className="mt-5 space-y-3 focus:outline-none">
                {items.length > 0 ? items.map((item) => (
                  <ActivityCard key={item.key} item={item} onRetry={setModalTarget} />
                )) : (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center px-6 py-12 text-center text-muted-foreground">
                      <Receipt className="h-9 w-9 opacity-40" />
                      <p className="mt-3 text-sm">{empty}</p>
                    </CardContent>
                  </Card>
                )}
              </Tabs.Content>
            ))}
          </Tabs.Root>

          <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>Hệ thống chỉ hỗ trợ chuyển khoản ngân hàng và biên lai được giáo viên phụ trách đối soát. Không thanh toán lại khi trạng thái đang là “Chờ xác nhận”.</p>
          </div>
        </>
      )}

      <PaymentDialog
        target={modalTarget}
        studentId={studentId}
        studentName={studentName}
        settings={teacherSettings}
        onClose={() => setModalTarget(null)}
        onSubmitted={() => loadPayments(false)}
      />
    </div>
  );
}

export default function StudentPaymentsPage() {
  const { studentName } = useStudentContext();
  return (
    <PortalLayout role="student" userName={studentName} pageTitle="Thanh toán">
      <Suspense fallback={<PaymentsSkeleton />}>
        <PaymentsContent />
      </Suspense>
    </PortalLayout>
  );
}
