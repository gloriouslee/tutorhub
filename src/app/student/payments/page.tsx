"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared";
import {
  createTransaction, getTransactions, getInvoices, submitInvoiceReceipt,
  getTeacherSettings,
  type PurchaseTransaction, type TuitionInvoice, type TeacherSettings,
} from "@/lib/storage";
import {
  DollarSign, CreditCard, Receipt, Clock, CheckCircle2,
  AlertCircle, ArrowRight, X, QrCode, UploadCloud, BookMarked,
  Info, TrendingDown, Wallet,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useStudentContext } from "@/hooks/useStudentContext";
import { loadTeacherCourses, teacherCourseToPaidPackage } from "@/components/student/materialsShared";
import StudentScopeBar, {
  ALL_STUDENT_SCOPE,
  classMatchesStudentScope,
  useStudentWorkspaceScope,
} from "@/components/student/StudentScopeBar";

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatVND = formatCurrency;

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

function isOverdue(due_date: string) {
  // Tính "hôm nay" tại thời điểm gọi — không cache lúc load module (tab mở qua
  // nửa đêm sẽ so sai ngày cho tới khi reload).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(due_date) < today;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Invoice = TuitionInvoice;
type ModalTarget =
  | { kind: "invoice"; invoiceIds: string[]; teacherId: string; title: string; amount: number }
  | { kind: "package"; pkgId: string; title: string; amount: number; teacherId: string; classId?: string }
  | { kind: "policy" };

// ── Inner component ───────────────────────────────────────────────────────────
function PaymentsContent() {
  const { studentId, studentName, myClasses } = useStudentContext();
  const { scope, setScope } = useStudentWorkspaceScope(myClasses);
  const params   = useSearchParams();
  const pkgParam = params.get("pkg");

  const [invoices,       setInvoices]       = useState<Invoice[]>([]);
  const [pkgTransactions,setPkgTransactions] = useState<PurchaseTransaction[]>([]);
  const [modalTarget,    setModalTarget]     = useState<ModalTarget | null>(null);
  const [receiptFile,    setReceiptFile]     = useState<File | null>(null);
  const [submitting,     setSubmitting]      = useState(false);
  const [submitError,    setSubmitError]     = useState("");
  const [teacherSettings, setTeacherSettings] = useState<Record<string, TeacherSettings>>({});
  const classById = useMemo(() => new Map(myClasses.map((cls) => [cls.id, cls])), [myClasses]);

  useEffect(() => {
    const teacherIds = [...new Set(myClasses.map((item) => item.tutor_id).filter(Boolean))];
    Promise.all(teacherIds.map(async (teacherId) => [teacherId, await getTeacherSettings(teacherId)] as const))
      .then((entries) => setTeacherSettings(Object.fromEntries(entries)))
      .catch(() => setTeacherSettings({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myClasses.map(c => c.id).join(",")]);

  useEffect(() => {
    getInvoices().then(list => setInvoices(list.filter(inv => inv.child_id === studentId)));
    // Filter by this student only
    getTransactions().then(txs => setPkgTransactions(txs.filter(t => t.student_id === studentId)));
    if (pkgParam) {
      loadTeacherCourses().then(courses => {
        const course = courses.find(
          item =>
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
          classId: cls?.id,
        });
      });
    }
  }, [myClasses, pkgParam, studentId]);

  const reload = () =>
    getTransactions().then(txs => setPkgTransactions(txs.filter(t => t.student_id === studentId)));

  const closeModal = () => {
    setModalTarget(null);
    setReceiptFile(null);
    setSubmitError("");
  };

  const handleConfirm = async () => {
    if (!modalTarget || modalTarget.kind === "policy") return;
    if (!receiptFile) return;
    setSubmitting(true);
    setSubmitError("");

    try {
      if (receiptFile.size > 10 * 1024 * 1024) {
        throw new Error("Biên lai không được vượt quá 10 MB.");
      }
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
        throw new Error(uploaded.error || "Không thể tải biên lai lên.");
      }

      if (modalTarget.kind === "invoice") {
        await submitInvoiceReceipt(
          modalTarget.invoiceIds,
          undefined,
          uploaded.path,
        );
        const list = await getInvoices();
        setInvoices(list.filter(inv => inv.child_id === studentId));
      } else {
        await createTransaction({
          pkg_id: modalTarget.pkgId,
          pkg_title: modalTarget.title,
          amount: modalTarget.amount,
          student_id: studentId,
          student_name: studentName,
          student_email: "",
          receipt_path: uploaded.path,
          transfer_note: `TUTORHUB ${modalTarget.pkgId.toUpperCase()} ${studentId}`,
        });
        await reload();
      }
      closeModal();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Không thể gửi biên lai.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const invoiceMatchesScope = (invoice: Invoice) => {
    if (!invoice.class_id) return scope.teacherId === ALL_STUDENT_SCOPE && scope.classId === ALL_STUDENT_SCOPE;
    return classMatchesStudentScope(classById.get(invoice.class_id), scope);
  };
  const transactionMatchesScope = (transaction: PurchaseTransaction) => {
    if (transaction.class_id) return classMatchesStudentScope(classById.get(transaction.class_id), scope);
    if (scope.classId !== ALL_STUDENT_SCOPE) return false;
    return scope.teacherId === ALL_STUDENT_SCOPE || transaction.teacher_id === scope.teacherId;
  };
  const scopedInvoices = invoices.filter(invoiceMatchesScope);
  const scopedTransactions = pkgTransactions.filter(transactionMatchesScope);
  const pendingInvoices = scopedInvoices.filter(i => i.status === "pending");
  const totalPending    = pendingInvoices.reduce((s, i) => s + i.amount, 0);
  const invoiceHistory  = scopedInvoices.filter(i => i.status !== "pending");
  const pendingPkgTxs   = scopedTransactions.filter(t => t.status === "pending");
  const totalPaid       = scopedInvoices
    .filter(i => i.status === "paid")
    .reduce((s, i) => s + i.amount, 0)
    + scopedTransactions
    .filter(t => t.status === "approved")
    .reduce((s, t) => s + t.amount, 0);

  const pendingGroups = useMemo(() => {
    const groups = new Map<string, { teacherId: string; teacherName: string; invoices: Invoice[]; amount: number }>();
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

  // Unified sorted history (newest first)
  const historyItems = useMemo(() => {
    const items: { key: string; date: string; label: string; sub: string; amount: number; status: string; type: "invoice" | "pkg"; classId?: string; teacherId?: string }[] = [
      ...invoiceHistory.map(inv => ({
        key: inv.id, date: inv.paid_at ?? inv.due_date,
        label: inv.title, sub: inv.id,
        amount: inv.amount,
        status: inv.status,
        type: "invoice" as const,
        classId: inv.class_id,
        teacherId: inv.class_id ? classById.get(inv.class_id)?.tutor_id : undefined,
      })),
      ...scopedTransactions.map(tx => ({
        key: tx.id, date: tx.created_at,
        label: tx.pkg_title, sub: formatDateTime(tx.created_at),
        amount: tx.amount,
        status: tx.status,
        type: "pkg" as const,
        classId: tx.class_id,
        teacherId: tx.teacher_id,
      })),
    ];
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [classById, invoiceHistory, scopedTransactions]);

  // Modal values
  const isPolicyModal = modalTarget?.kind === "policy";
  const modalTitle    = modalTarget?.kind === "invoice" ? modalTarget.title
    : modalTarget?.kind === "package" ? modalTarget.title : "";
  const modalAmt      = modalTarget?.kind === "invoice" ? modalTarget.amount
    : modalTarget?.kind === "package" ? modalTarget.amount : 0;
  const modalId       = modalTarget?.kind === "invoice" ? modalTarget.invoiceIds.join("-")
    : modalTarget?.kind === "package" ? modalTarget.pkgId : "";
  const modalTeacherId = modalTarget && modalTarget.kind !== "policy" ? modalTarget.teacherId : "";
  const teacherQR = teacherSettings[modalTeacherId] ?? {};
  const modalTeacher = myClasses.find((cls) => cls.tutor_id === modalTeacherId)?.tutor_name;
  const hasPaymentDestination = Boolean(teacherQR.qr_image_url || teacherQR.account_number);
  const transferNote  = modalTarget?.kind === "package"
    ? `TUTORHUB ${modalTarget.pkgId.toUpperCase()} ${studentId}`
    : `TT ${modalTarget?.kind === "invoice" && modalTarget.invoiceIds.length > 1 ? `NHOM${modalTarget.invoiceIds.length}` : modalId} ${studentName.toUpperCase().replace(/ /g, "")}`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <SectionHeader title="Quản lý Học phí" subtitle="Hóa đơn và người nhận được tách riêng theo từng giáo viên, lớp học" />

      <StudentScopeBar classes={myClasses} scope={scope} onChange={setScope} />

      {/* Pending package transactions banner */}
      {pendingPkgTxs.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
          <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {pendingPkgTxs.length} giao dịch mua tài liệu đang chờ xác nhận
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Admin sẽ xác nhận trong 1–4 giờ. Bạn sẽ nhận thông báo khi được duyệt.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Hero */}
          <Card className="overflow-hidden border-0 shadow-lg relative animate-fade-in">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800" />
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <DollarSign className="w-32 h-32" />
            </div>
            <CardContent className="p-8 relative z-10 text-white">
              <p className="text-indigo-100 font-medium mb-1">Tổng học phí cần thanh toán</p>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
                {totalPending > 0 ? formatVND(totalPending) : "Đã thanh toán đầy đủ"}
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="bg-white text-indigo-600 hover:bg-indigo-50 border-0 font-bold px-8 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:-translate-y-0.5 transition-all"
                  disabled={pendingGroups.length !== 1 || pendingGroups[0]?.teacherId === "unassigned"}
                  onClick={() => {
                    const group = pendingGroups[0];
                    if (!group || group.teacherId === "unassigned") return;
                    setModalTarget({
                      kind: "invoice",
                      invoiceIds: group.invoices.map((invoice) => invoice.id),
                      teacherId: group.teacherId,
                      title: `Thanh toán ${group.invoices.length} hóa đơn cho ${group.teacherName}`,
                      amount: group.amount,
                    });
                  }}
                >
                  <CreditCard className="h-5 w-5 mr-2" />
                  {pendingGroups.length > 1 ? "Chọn từng giáo viên bên dưới" : "Thanh toán nhóm hóa đơn"}
                </Button>
                <Button
                  size="lg"
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md hover:-translate-y-0.5 transition-all"
                  onClick={() => setModalTarget({ kind: "policy" })}
                >
                  <Info className="h-5 w-5 mr-2" /> Xem chính sách
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 animate-fade-in" style={{ animationDelay: "80ms" }}>
            {[
              { icon: TrendingDown, label: "Cần thanh toán", value: formatVND(totalPending), color: totalPending > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400" },
              { icon: CheckCircle2, label: "Đã thanh toán",  value: formatVND(totalPaid),    color: "text-emerald-600 dark:text-emerald-400" },
              { icon: Wallet,       label: "Hóa đơn chờ",    value: `${pendingInvoices.length} hóa đơn`, color: pendingInvoices.length > 0 ? "text-amber-600" : "text-foreground" },
            ].map(stat => (
              <Card key={stat.label} className="shadow-none">
                <CardContent className="p-4 text-center">
                  <stat.icon className={`h-5 w-5 mx-auto mb-2 ${stat.color}`} />
                  <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pending invoices */}
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: "120ms" }}>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" /> Cần thanh toán
            </h3>
            {pendingInvoices.length > 0 ? (
              <div className="space-y-5">
                {pendingGroups.map((group) => (
                  <section key={group.teacherId} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Người nhận học phí</p>
                        <h4 className="mt-0.5 font-bold text-foreground">{group.teacherName}</h4>
                        <p className="text-xs text-muted-foreground">{group.invoices.length} hóa đơn · {formatVND(group.amount)}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={group.teacherId === "unassigned"}
                        onClick={() => setModalTarget({
                          kind: "invoice",
                          invoiceIds: group.invoices.map((invoice) => invoice.id),
                          teacherId: group.teacherId,
                          title: `Thanh toán ${group.invoices.length} hóa đơn cho ${group.teacherName}`,
                          amount: group.amount,
                        })}
                      >
                        Thanh toán nhóm này <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="divide-y divide-border/60">
                      {group.invoices.map((inv) => {
                        const overdue = isOverdue(inv.due_date);
                        const cls = inv.class_id ? classById.get(inv.class_id) : undefined;
                        return (
                          <div key={inv.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{inv.id}</span>
                                {overdue
                                  ? <Badge variant="destructive" className="text-[10px] uppercase">Quá hạn</Badge>
                                  : <Badge variant="warning" className="text-[10px] uppercase">Chưa thanh toán</Badge>}
                              </div>
                              <h4 className="font-semibold text-foreground">{inv.title}</h4>
                              <p className="mt-1 text-xs text-muted-foreground">{cls?.class_name ?? "Hóa đơn chưa gắn lớp"}</p>
                              <p className={`mt-1 flex items-center gap-1.5 text-sm ${overdue ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                                <Clock className="h-3.5 w-3.5" />
                                {overdue ? "Đã quá hạn: " : "Hạn chót: "}{formatDate(inv.due_date)}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                              <span className="text-lg font-bold">{formatVND(inv.amount)}</span>
                              <Button
                                size="sm"
                                variant={overdue ? "destructive" : "gradient"}
                                disabled={group.teacherId === "unassigned"}
                                onClick={() => setModalTarget({
                                  kind: "invoice",
                                  invoiceIds: [inv.id],
                                  teacherId: group.teacherId,
                                  title: inv.title,
                                  amount: inv.amount,
                                })}
                              >
                                Thanh toán <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <Card className="bg-muted/50 border-dashed">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-3 opacity-50" />
                  <p>Bạn đã hoàn tất mọi khoản học phí. Tuyệt vời!</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* ── Sidebar ─────────────────────────────────────────── */}
        <div className="space-y-5 animate-fade-in" style={{ animationDelay: "160ms" }}>

          {/* Payment methods */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Phương thức hỗ trợ
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
                <div className="h-8 w-12 rounded flex items-center justify-center text-xs font-bold shrink-0 bg-slate-800 text-white">
                  BANK
                </div>
                <div>
                  <p className="text-sm font-semibold">Chuyển khoản Ngân hàng</p>
                  <p className="text-[11px] text-muted-foreground">TPBank · VietQR</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Hiện tại chỉ hỗ trợ chuyển khoản ngân hàng. Quét mã QR hoặc chuyển thủ công.
              </p>
            </CardContent>
          </Card>

          {/* History — unified and sorted */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" /> Lịch sử thanh toán
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {historyItems.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Chưa có giao dịch nào</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {historyItems.map(item => {
                    const isOk      = item.status === "approved" || item.status === "paid";
                    const isRejected = item.status === "rejected";
                    const isPending  = !isOk && !isRejected;
                    const cls = item.classId ? classById.get(item.classId) : undefined;
                    return (
                      <div key={item.key} className="p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                          isOk ? "bg-emerald-100 dark:bg-emerald-900/30"
                            : isRejected ? "bg-red-100 dark:bg-red-900/30"
                            : "bg-amber-100 dark:bg-amber-900/30"
                        }`}>
                          {isOk ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            : isRejected ? <X className="h-5 w-5 text-red-500" />
                            : <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {item.type === "pkg" && <BookMarked className="h-3 w-3 text-violet-500 shrink-0" />}
                            <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {item.type === "pkg" ? item.sub : (isOk ? `Thanh toán ${formatDate(item.date)}` : "Đang chờ duyệt")}
                            {isRejected && " · Bị từ chối"}
                          </p>
                          {(cls || item.teacherId) && (
                            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                              {cls?.class_name ?? "Giao dịch tài liệu"}{cls?.tutor_name ? ` · ${cls.tutor_name}` : ""}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold">{formatVND(item.amount)}</span>
                          {isPending && <p className="text-[10px] text-amber-600 font-medium">Chờ duyệt</p>}
                          {isOk      && <p className="text-[10px] text-emerald-600 font-medium">Xác nhận</p>}
                          {isRejected && <p className="text-[10px] text-red-500 font-medium">Từ chối</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}
      {modalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[90vh]">

            <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
              <h3 className="font-bold text-lg flex items-center gap-2">
                {isPolicyModal
                  ? <><Info className="h-5 w-5 text-primary" /> Chính sách học phí</>
                  : <><QrCode className="h-5 w-5 text-primary" />{modalTarget.kind === "package" ? "Mua tài liệu" : "Thanh toán học phí"}</>}
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={closeModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Policy modal content */}
            {isPolicyModal ? (
              <div className="p-6 space-y-4 overflow-y-auto text-sm text-foreground/80 leading-relaxed">
                {[
                  ["Hạn thanh toán", "Học phí phải được nộp trước ngày 15 hàng tháng. Sau hạn 5 ngày sẽ bị nhắc nhở, sau 15 ngày sẽ tạm khóa tài khoản."],
                  ["Phương thức thanh toán", "TutorHub hỗ trợ chuyển khoản ngân hàng, VNPay và MoMo. Vui lòng ghi đúng nội dung chuyển khoản để hệ thống tự đối soát."],
                  ["Hoàn học phí", "Học sinh có thể xin hoàn học phí trong vòng 3 ngày kể từ ngày đăng ký. Sau 3 ngày, học phí không được hoàn lại."],
                  ["Xác nhận giao dịch", "Admin sẽ xác nhận giao dịch trong vòng 1–4 giờ (giờ hành chính, 8:00–17:00, T2–T6). Ngoài giờ sẽ xử lý vào ngày làm việc tiếp theo."],
                ].map(([title, body]) => (
                  <div key={title}>
                    <p className="font-semibold text-foreground mb-1">{title}</p>
                    <p>{body}</p>
                  </div>
                ))}
                <div className="pt-3">
                  <Button className="w-full" onClick={closeModal}>Đã hiểu</Button>
                </div>
              </div>
            ) : (
              /* Payment modal */
              <>
                <div className="p-6 space-y-6 overflow-y-auto">
                  {/* Amount */}
                  <div className="w-full text-center space-y-1 bg-primary/5 p-4 rounded-xl border border-primary/20">
                    <p className="text-sm text-muted-foreground">Số tiền cần thanh toán:</p>
                    <p className="text-3xl font-black text-primary">{formatVND(modalAmt)}</p>
                    <p className="text-xs font-medium text-foreground mt-2 px-4 line-clamp-2">{modalTitle}</p>
                    {modalTeacher && <p className="text-xs text-muted-foreground">Người nhận: {modalTeacher}</p>}
                  </div>

                  {/* QR + bank info */}
                  {!teacherQR.qr_image_url && !teacherQR.account_number ? (
                    <div className="w-full flex gap-3 text-sm text-amber-700 bg-amber-50 p-4 rounded-xl border border-amber-200/50 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">Giáo viên chưa cấu hình thông tin thanh toán. Vui lòng liên hệ giáo viên/trung tâm để nhận thông tin chuyển khoản trước khi thanh toán.</p>
                    </div>
                  ) : (
                  <div className="flex flex-col sm:flex-row gap-6 w-full items-center sm:items-start">
                    {teacherQR.qr_image_url && (
                      <div className="p-3 bg-white rounded-2xl shadow-sm border border-border shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={teacherQR.qr_image_url}
                          alt="QR Code Thanh Toán"
                          className="w-40 h-40 object-contain"
                        />
                      </div>
                    )}
                    <div className="flex-1 w-full bg-muted/30 p-3 rounded-xl border border-border/50 space-y-2">
                      <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Thông tin người nhận</p>
                      {[
                        { label: "Ngân hàng",     value: teacherQR.bank_name },
                        { label: "Số tài khoản",  value: teacherQR.account_number },
                        { label: "Chủ tài khoản", value: teacherQR.account_holder },
                      ].filter(row => row.value).map(row => (
                        <div key={row.label} className="flex justify-between items-center border-b border-border/50 pb-1.5 last:border-0 last:pb-0">
                          <span className="text-xs text-muted-foreground">{row.label}:</span>
                          <span className="text-sm font-semibold">{row.value}</span>
                        </div>
                      ))}
                      <div className="flex flex-col gap-1 pt-1">
                        <span className="text-xs text-muted-foreground">Nội dung (Bắt buộc):</span>
                        <span className="text-sm font-bold text-primary bg-primary/10 px-2 py-1 rounded select-all font-mono text-center">
                          {transferNote}
                        </span>
                      </div>
                    </div>
                    {submitError && (
                      <p className="text-sm text-red-600" role="alert">{submitError}</p>
                    )}
                  </div>
                  )}

                  {/* Receipt upload */}
                  <div className="w-full space-y-2 pt-2 border-t border-border/50">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <UploadCloud className="h-4 w-4 text-primary" />
                      Tải lên biên lai giao dịch <span className="text-red-500">*</span>
                    </p>
                    <div className="border-2 border-dashed border-border/60 rounded-xl p-4 text-center hover:bg-muted/30 transition-colors relative cursor-pointer">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
                      />
                      {receiptFile ? (
                        <div className="flex items-center justify-center gap-2 text-emerald-600">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="text-sm font-medium">{receiptFile.name}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <UploadCloud className="h-8 w-8 mb-1 opacity-50" />
                          <span className="text-sm font-medium">Bấm hoặc kéo thả ảnh biên lai vào đây</span>
                          <span className="text-xs">JPG, PNG, PDF</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 text-xs text-amber-700 bg-amber-50 p-4 rounded-xl border border-amber-200/50 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong>Lưu ý:</strong> Nhập đúng nội dung chuyển khoản để hệ thống xác nhận nhanh hơn.
                      Giáo viên phụ trách sẽ đối soát biên lai.
                    </p>
                  </div>
                </div>

                <div className="p-4 border-t border-border/50 bg-muted/10 flex gap-3 shrink-0">
                  <Button variant="outline" className="flex-1" onClick={closeModal}>Hủy bỏ</Button>
                  <Button className="flex-1" disabled={!receiptFile || submitting || !hasPaymentDestination} onClick={handleConfirm}>
                    {submitting
                      ? <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full inline-block mr-2" />Đang gửi...</>
                      : "Tôi đã chuyển khoản"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudentPaymentsPage() {
  const { studentName } = useStudentContext();
  return (
    <PortalLayout role="student" userName={studentName} pageTitle="Thanh toán">
      <Suspense fallback={<div className="py-20 text-center text-sm text-muted-foreground">Đang tải...</div>}>
        <PaymentsContent />
      </Suspense>
    </PortalLayout>
  );
}
