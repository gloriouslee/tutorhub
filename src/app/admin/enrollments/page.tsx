"use client";

import { useState, useEffect } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared";
import {
  getEnrollments, approveEnrollment, rejectEnrollment,
  type EnrollmentRequest, type EnrollmentStatus,
} from "@/lib/storage";
import { MOCK_CLASSES } from "@/lib/mock-data";
import {
  CheckCircle2, XCircle, Clock, User, Mail, Phone, BookOpen,
  Calendar, GraduationCap, Search, RefreshCw, Eye, EyeOff, X,
  AlertCircle, Key, ArrowRight, FileText,
} from "lucide-react";

const STATUS_CONFIG: Record<EnrollmentStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:  { label: "Chờ duyệt", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",   icon: Clock },
  approved: { label: "Đã duyệt",  color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
  rejected: { label: "Từ chối",   color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",           icon: XCircle },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type Filter = "all" | EnrollmentStatus;

// ─────────────────────────────────────────────────────────────────────────────
// Approval modal
// ─────────────────────────────────────────────────────────────────────────────

interface ApproveModalProps {
  enrollment: EnrollmentRequest;
  onClose: () => void;
  onDone: () => void;
}

function ApproveModal({ enrollment, onClose, onDone }: ApproveModalProps) {
  const defaultUsername = enrollment.email.toLowerCase();
  const defaultPassword = enrollment.email.split("@")[0];

  const [assignedClassId, setAssignedClassId] = useState(enrollment.requested_class_id);
  const [username, setUsername]               = useState(defaultUsername);
  const [password, setPassword]               = useState(defaultPassword);
  const [showPassword, setShowPassword]       = useState(false);
  const [submitting, setSubmitting]           = useState(false);

  const [approveError, setApproveError] = useState("");

  const handleApprove = async () => {
    if (!assignedClassId || !username.trim() || !password.trim()) return;
    setSubmitting(true);
    setApproveError("");
    try {
      await approveEnrollment(enrollment.id, {
        assigned_class_id: assignedClassId,
        account_username:  username.trim(),
        account_password:  password.trim(),
      });
      onDone();
    } catch (err: unknown) {
      setApproveError(err instanceof Error ? err.message : "Lỗi khi duyệt đơn");
      setSubmitting(false);
    }
  };

  const requestedClass = MOCK_CLASSES.find(c => c.id === enrollment.requested_class_id);
  const assignedClass  = MOCK_CLASSES.find(c => c.id === assignedClassId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50 shrink-0">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Duyệt đơn đăng ký
          </h3>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">

          {/* Student info summary */}
          <div className="bg-muted/40 rounded-xl p-4 space-y-2 border border-border/50">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Thông tin học viên</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {[
                { label: "Họ tên",    value: enrollment.full_name },
                { label: "Email",     value: enrollment.email },
                { label: "Ngày sinh", value: fmtDate(enrollment.dob) },
                { label: "Trường",    value: enrollment.school },
                { label: "Khối",      value: enrollment.grade },
                { label: "SĐT PH",   value: enrollment.parent_phone },
              ].map(r => (
                <div key={r.label}>
                  <span className="text-muted-foreground">{r.label}: </span>
                  <span className="font-medium">{r.value}</span>
                </div>
              ))}
            </div>
            {enrollment.note && (
              <p className="text-xs text-muted-foreground italic border-t border-border/50 pt-2 mt-2">
                Ghi chú: {enrollment.note}
              </p>
            )}
          </div>

          {/* Class assignment */}
          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" /> Phân bổ lớp học
            </label>
            {requestedClass && requestedClass.id !== assignedClassId && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/10 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/50">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Lớp đăng ký: <strong>{requestedClass.class_name}</strong>
                <ArrowRight className="h-3 w-3" />
                Sẽ vào: <strong>{assignedClass?.class_name}</strong>
              </div>
            )}
            <select
              value={assignedClassId}
              onChange={e => setAssignedClassId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Chọn lớp…</option>
              {MOCK_CLASSES.map(c => (
                <option key={c.id} value={c.id}>
                  {c.class_name} — {c.subject} ({(c.student_ids ?? []).length}/{c.max_students} HV)
                </option>
              ))}
            </select>
          </div>

          {/* Account creation */}
          <div className="space-y-3 border-t border-border/50 pt-4">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" /> Tạo tài khoản học viên
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tên đăng nhập (email)</label>
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="username@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                Mật khẩu ban đầu
                <button type="button" className="text-primary hover:underline" onClick={() => setShowPassword(p => !p)}>
                  {showPassword ? "Ẩn" : "Hiện"}
                </button>
              </label>
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Mặc định là phần trước @ của email. Học viên nên đổi sau lần đăng nhập đầu.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        {approveError && (
          <div className="mx-5 mb-1 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
            {approveError}
          </div>
        )}
        <div className="p-4 border-t border-border/50 flex gap-3 shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>Hủy</Button>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            disabled={!assignedClassId || !username.trim() || !password.trim() || submitting}
            onClick={handleApprove}
          >
            {submitting ? (
              <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full inline-block mr-2" />Đang xử lý...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4 mr-2" />Duyệt & Tạo tài khoản</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reject modal
// ─────────────────────────────────────────────────────────────────────────────

function RejectModal({ enrollment, onClose, onDone }: ApproveModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReject = async () => {
    setSubmitting(true);
    try {
      await rejectEnrollment(enrollment.id, reason.trim() || undefined);
      onDone();
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" /> Từ chối đơn đăng ký
          </h3>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Từ chối đơn của <strong className="text-foreground">{enrollment.full_name}</strong> ({enrollment.email})
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Lý do từ chối (tuỳ chọn)</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Ví dụ: lớp đã đủ chỗ, không phù hợp trình độ…"
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        </div>
        <div className="p-4 border-t border-border/50 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Hủy</Button>
          <Button
            className="flex-1 bg-red-600 hover:bg-red-700"
            disabled={submitting}
            onClick={handleReject}
          >
            {submitting
              ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full inline-block" />
              : <><XCircle className="h-4 w-4 mr-2" />Xác nhận từ chối</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminEnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<EnrollmentRequest[]>([]);
  const [filter, setFilter]           = useState<Filter>("all");
  const [search, setSearch]           = useState("");
  const [approveTarget, setApproveTarget] = useState<EnrollmentRequest | null>(null);
  const [rejectTarget,  setRejectTarget]  = useState<EnrollmentRequest | null>(null);
  const [shownPassIds,  setShownPassIds]  = useState<Set<string>>(new Set());

  const togglePass = (id: string) => setShownPassIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const reload = () => { getEnrollments().then(setEnrollments); };
  useEffect(() => { reload(); }, []);

  const filtered = enrollments
    .filter(e => filter === "all" || e.status === filter)
    .filter(e => {
      const q = search.toLowerCase();
      return !q || e.full_name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.school.toLowerCase().includes(q);
    });

  const pendingCount  = enrollments.filter(e => e.status === "pending").length;
  const approvedCount = enrollments.filter(e => e.status === "approved").length;

  const FILTERS: { value: Filter; label: string }[] = [
    { value: "all",      label: `Tất cả (${enrollments.length})` },
    { value: "pending",  label: `Chờ duyệt (${pendingCount})` },
    { value: "approved", label: "Đã duyệt" },
    { value: "rejected", label: "Từ chối" },
  ];

  return (
    <PortalLayout role="admin" userName="" pageTitle="Đăng ký nhập học">
      <div className="max-w-5xl mx-auto space-y-6">
        <SectionHeader
          title="Đơn đăng ký nhập học"
          subtitle="Xem xét, phân lớp và cấp tài khoản học viên mới"
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={reload}>
                <RefreshCw className="h-3.5 w-3.5" /> Làm mới
              </Button>
            </div>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Chờ duyệt",  value: pendingCount,  icon: Clock,        color: "text-amber-500 bg-amber-100 dark:bg-amber-900/30" },
            { label: "Đã duyệt",   value: approvedCount, icon: CheckCircle2, color: "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30" },
            { label: "Tổng đơn",   value: enrollments.length, icon: FileText, color: "text-primary bg-primary/10" },
          ].map(stat => (
            <Card key={stat.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1 flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  filter === f.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground hover:border-primary/50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative sm:ml-auto sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm tên, email, trường…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <AlertCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">
                {enrollments.length === 0 ? "Chưa có đơn đăng ký nào" : "Không tìm thấy đơn phù hợp"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {enrollments.length === 0
                  ? "Khi học viên gửi đơn tại /enroll, đơn sẽ xuất hiện ở đây"
                  : "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(enr => {
              const sc = STATUS_CONFIG[enr.status];
              const StatusIcon = sc.icon;
              const reqClass = MOCK_CLASSES.find(c => c.id === enr.requested_class_id);
              const asnClass = enr.assigned_class_id ? MOCK_CLASSES.find(c => c.id === enr.assigned_class_id) : null;

              return (
                <Card key={enr.id} className={enr.status === "pending" ? "border-amber-200 dark:border-amber-800/50" : ""}>
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="flex-1 space-y-2 min-w-0">

                        {/* Status + date */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${sc.color}`}>
                            <StatusIcon className="h-3 w-3" />{sc.label}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />{fmt(enr.created_at)}
                          </span>
                        </div>

                        {/* Name + contact */}
                        <div className="flex items-start gap-2">
                          <User className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-foreground">{enr.full_name}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                              <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{enr.email}</span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{enr.parent_phone}</span>
                            </div>
                          </div>
                        </div>

                        {/* Class + grade */}
                        <div className="flex items-start gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="text-muted-foreground">Đăng ký: </span>
                            <span className="font-medium">{reqClass?.class_name ?? enr.requested_class_id}</span>
                            {asnClass && asnClass.id !== reqClass?.id && (
                              <span className="ml-2 text-xs text-amber-600">
                                → Phân vào: <strong>{asnClass.class_name}</strong>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm text-muted-foreground">{enr.grade} · {enr.school}</span>
                        </div>

                        {/* Account info if approved */}
                        {enr.status === "approved" && enr.account_username && (
                          <div className="text-xs bg-emerald-50 dark:bg-emerald-900/10 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800/50 space-y-1">
                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                              <Key className="h-3.5 w-3.5 shrink-0" /> Thông tin tài khoản
                              <span className="ml-auto text-muted-foreground font-normal">Duyệt: {enr.reviewed_at ? fmtDate(enr.reviewed_at) : ""}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-foreground">
                              <div>
                                <span className="text-muted-foreground">Tên đăng nhập: </span>
                                <strong>{enr.account_username}</strong>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground">Mật khẩu: </span>
                                <strong className="font-mono">
                                  {shownPassIds.has(enr.id) ? enr.account_password : "••••••••"}
                                </strong>
                                <button
                                  type="button"
                                  onClick={() => togglePass(enr.id)}
                                  className="text-muted-foreground hover:text-foreground ml-1"
                                >
                                  {shownPassIds.has(enr.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </div>
                            {enr.assigned_class_id && (
                              <div>
                                <span className="text-muted-foreground">Lớp được phân: </span>
                                <strong>{MOCK_CLASSES.find(c => c.id === enr.assigned_class_id)?.class_name ?? enr.assigned_class_id}</strong>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Rejection reason */}
                        {enr.status === "rejected" && enr.reject_reason && (
                          <p className="text-xs text-red-500 italic">Lý do: {enr.reject_reason}</p>
                        )}
                      </div>

                      {/* Actions */}
                      {enr.status === "pending" && (
                        <div className="flex gap-2 shrink-0 sm:flex-col sm:items-end">
                          <Button
                            size="sm"
                            className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => setApproveTarget(enr)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                            onClick={() => setRejectTarget(enr)}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Từ chối
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {approveTarget && (
        <ApproveModal
          enrollment={approveTarget}
          onClose={() => setApproveTarget(null)}
          onDone={() => { setApproveTarget(null); reload(); }}
        />
      )}
      {rejectTarget && (
        <RejectModal
          enrollment={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onDone={() => { setRejectTarget(null); reload(); }}
        />
      )}
    </PortalLayout>
  );
}
