"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  getClassTuition, saveClassTuition, recordTuitionPayment, deleteTuitionPayment,
  getInvoices, issueTuitionInvoice, confirmInvoicePaid, getAllTeacherAttendance,
  type ClassTuitionConfig, type StudentTuitionData, type TuitionPaymentRecord,
  type TuitionInvoice, type TuitionDiscount, type TeacherAttendanceRecord,
  type PackagePrices,
} from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import {
  Wallet, Plus, Check, X, Trash2, Clock, AlertCircle, CheckCircle2,
  Settings, FileText, Receipt, CalendarCheck, RotateCcw,
} from "lucide-react";

type PackageType = "online" | "advanced" | "offline";

// ── Helpers ──────────────────────────────────────────────────────────────────

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function periodLabel(p: string) {
  const [y, m] = p.split("-");
  return `Tháng ${parseInt(m)}/${y}`;
}
function paidInPeriod(student: StudentTuitionData, period: string): number {
  return student.payments.filter(p => p.period === period).reduce((s, p) => s + p.amount, 0);
}
function totalPaid(student: StudentTuitionData): number {
  return student.payments.reduce((s, p) => s + p.amount, 0);
}
function studentName(s: { full_name?: string; name?: string }) {
  return s.full_name ?? (s as any).name ?? "Học viên";
}
function initials(name: string) {
  return name.split(" ").slice(-2).map(w => w[0]).join("").toUpperCase();
}

const PKG_LABEL: Record<PackageType, string> = { online: "Online", advanced: "Nâng cao", offline: "Offline" };
const PKG_COLOR: Record<PackageType, string> = {
  online: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  advanced: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  offline: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

// Số buổi HV thực đi (có mặt + trễ) trong kỳ, lấy từ dữ liệu điểm danh
function attendedSessions(att: TeacherAttendanceRecord[], classId: string, studentId: string, period: string): number {
  return att.filter(a =>
    a.class_id === classId && a.student_id === studentId &&
    a.date.startsWith(period) && (a.status === "present" || a.status === "late")
  ).length;
}

interface FeeBreakdown { sessions: number; attended: number; overridden: boolean; unit: number; gross: number; discount?: TuitionDiscount; net: number; }

// Đơn giá theo GÓI hiệu lực cho một kỳ: ưu tiên snapshot của kỳ đó; nếu chưa có
// thì KẾ THỪA TIẾN (lấy kỳ đã cấu hình gần nhất TRƯỚC đó) — nên đặt giá kỳ này
// không bao giờ thay đổi các kỳ trước. Cuối cùng fallback đơn giá cũ (toàn cục).
export function resolveUnitPrices(config: ClassTuitionConfig, period: string): PackagePrices {
  const table = config.unit_prices ?? {};
  if (table[period]) return table[period];
  const prior = Object.keys(table).filter(k => k < period).sort();
  if (prior.length) return table[prior[prior.length - 1]];
  const legacy = config.unit_price ?? 0;
  return { online: legacy, advanced: legacy, offline: legacy };
}

function computeFee(config: ClassTuitionConfig, sData: StudentTuitionData, period: string, attended: number, pkg: PackageType): FeeBreakdown {
  const override = sData.session_overrides?.[period];
  const sessions = override ?? attended;
  const unit = resolveUnitPrices(config, period)[pkg] ?? 0;
  const gross = unit * sessions;
  const discount = sData.discounts?.[period];
  let net = gross;
  if (discount) net = discount.type === "percent" ? gross * (1 - discount.value / 100) : gross - discount.value;
  return { sessions, attended, overridden: override !== undefined, unit, gross, discount, net: Math.max(0, Math.round(net)) };
}

function discountLabel(d?: TuitionDiscount): string {
  if (!d || d.value <= 0) return "";
  return d.type === "percent" ? `-${d.value}%` : `-${formatCurrency(d.value)}`;
}

// ── Payment modal ─────────────────────────────────────────────────────────────

function PaymentModal({ studentName: name, defaultAmount, onSave, onClose }: {
  studentName: string; defaultAmount: number;
  onSave: (p: Omit<TuitionPaymentRecord, "id">) => void; onClose: () => void;
}) {
  const [amount, setAmount] = useState(defaultAmount.toString());
  const [period, setPeriod] = useState(currentPeriod());
  const [method, setMethod] = useState<"cash" | "transfer" | "other">("cash");
  const [note, setNote] = useState("");

  const handleSave = () => {
    const amt = parseInt(amount.replace(/\D/g, ""), 10);
    if (!amt) return;
    onSave({ amount: amt, period, paid_at: new Date().toISOString(), method, note: note.trim() || undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="font-semibold text-foreground text-sm">Ghi nhận thanh toán</p>
            <p className="text-xs text-muted-foreground">{name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Số tiền</label>
            <div className="relative">
              <input type="text" value={parseInt(amount || "0").toLocaleString("vi-VN")}
                onChange={e => setAmount(e.target.value.replace(/\D/g, ""))}
                className="w-full h-10 px-3 pr-8 rounded-xl border border-border bg-background text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/40" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">đ</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Kỳ thanh toán</label>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Hình thức</label>
            <div className="flex gap-2">
              {(["cash", "transfer", "other"] as const).map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-colors ${method === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                  {m === "cash" ? "Tiền mặt" : m === "transfer" ? "Chuyển khoản" : "Khác"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Ghi chú (tuỳ chọn)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="VD: Đóng kèm tháng 8…"
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <Button variant="outline" className="flex-1" onClick={onClose}>Huỷ</Button>
          <Button variant="gradient" className="flex-1" onClick={handleSave}><Check className="h-3.5 w-3.5 mr-1.5" />Lưu</Button>
        </div>
      </div>
    </div>
  );
}

// ── History panel ─────────────────────────────────────────────────────────────

function HistoryPanel({ studentName: name, data, classId, studentId, onUpdate, onClose }: {
  studentName: string; data: StudentTuitionData; classId: string; studentId: string;
  onUpdate: () => void; onClose: () => void;
}) {
  const sorted = [...data.payments].sort((a, b) => b.paid_at.localeCompare(a.paid_at));
  async function handleDelete(paymentId: string) { await deleteTuitionPayment(classId, studentId, paymentId); onUpdate(); }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md sm:m-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <p className="font-semibold text-foreground text-sm">Lịch sử thanh toán</p>
            <p className="text-xs text-muted-foreground">{name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sorted.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Chưa có lần đóng tiền nào</div>
          ) : sorted.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{formatCurrency(p.amount)}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {p.method === "cash" ? "Tiền mặt" : p.method === "transfer" ? "Chuyển khoản" : "Khác"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{periodLabel(p.period)} · {new Date(p.paid_at).toLocaleDateString("vi-VN")}</p>
                {p.note && <p className="text-xs text-muted-foreground italic">{p.note}</p>}
              </div>
              <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
        <div className="px-5 pb-4 pt-2 border-t border-border shrink-0 flex justify-between text-xs text-muted-foreground">
          <span>{data.payments.length} giao dịch</span>
          <span className="font-semibold text-foreground">Tổng: {formatCurrency(totalPaid(data))}</span>
        </div>
      </div>
    </div>
  );
}

// ── Invoice status badge ──────────────────────────────────────────────────────

const INVOICE_BADGE: Record<string, { label: string; cls: string }> = {
  none: { label: "Chưa phát hành", cls: "bg-muted text-muted-foreground" },
  pending: { label: "Chờ đóng", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  pending_verification: { label: "Chờ xác minh", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
  paid: { label: "Đã đóng", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
};

// ── Student card ──────────────────────────────────────────────────────────────

function StudentCard({ student, config, period, classId, className, invoice, attended, onUpdate }: {
  student: { id: string; full_name?: string; name?: string; package?: PackageType };
  config: ClassTuitionConfig; period: string; classId: string; className: string;
  invoice?: TuitionInvoice; attended: number; onUpdate: () => void;
}) {
  const sData = config.students[student.id] ?? { payments: [] };
  const pkg = student.package ?? "online";
  const name = studentName(student);
  const fee = computeFee(config, sData, period, attended, pkg);
  const paid = paidInPeriod(sData, period);
  const debt = Math.max(0, fee.net - paid);

  const [sessInput, setSessInput] = useState(String(fee.sessions));
  const [editSess, setEditSess] = useState(false);
  const [discType, setDiscType] = useState<"amount" | "percent">(fee.discount?.type ?? "amount");
  const [discInput, setDiscInput] = useState(String(fee.discount?.value ?? ""));
  const [showPay, setShowPay] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!editSess) setSessInput(String(fee.sessions)); }, [fee.sessions, editSess]);
  useEffect(() => { setDiscType(fee.discount?.type ?? "amount"); setDiscInput(String(fee.discount?.value ?? "")); }, [fee.discount?.type, fee.discount?.value, period]);

  async function patchStudent(mut: (d: StudentTuitionData) => StudentTuitionData) {
    const cur = await getClassTuition(classId);
    cur.students[student.id] = mut(cur.students[student.id] ?? { payments: [] });
    await saveClassTuition(classId, cur);
    onUpdate();
  }

  async function saveSessions() {
    const v = parseInt(sessInput.replace(/\D/g, ""), 10);
    await patchStudent(d => {
      const so = { ...(d.session_overrides ?? {}) };
      if (isNaN(v)) delete so[period]; else so[period] = v;
      return { ...d, session_overrides: so };
    });
    setEditSess(false);
  }
  async function resetSessions() {
    await patchStudent(d => {
      const so = { ...(d.session_overrides ?? {}) };
      delete so[period];
      return { ...d, session_overrides: so };
    });
    setEditSess(false);
  }
  async function saveDiscount() {
    const v = parseInt(discInput.replace(/\D/g, ""), 10) || 0;
    await patchStudent(d => {
      const disc = { ...(d.discounts ?? {}) };
      if (v <= 0) delete disc[period];
      else disc[period] = { type: discType, value: discType === "percent" ? Math.min(100, v) : v };
      return { ...d, discounts: disc };
    });
  }

  async function issueInvoice() {
    if (busy || fee.net <= 0) return;
    setBusy(true);
    await issueTuitionInvoice({ classId, className, studentId: student.id, amount: fee.net, period, dueDate: `${period}-15` });
    setBusy(false);
    onUpdate();
  }
  async function confirmReceipt() {
    if (busy || !invoice || invoice.status !== "pending_verification") return;
    setBusy(true);
    const fresh = (await getInvoices()).find(i => i.id === invoice.id);
    if (fresh && fresh.status === "pending_verification") {
      await confirmInvoicePaid(invoice.id);
      const invPeriod = invoice.period ?? period;
      const freshConfig = await getClassTuition(classId);
      const freshData = freshConfig.students[student.id] ?? { payments: [] };
      if (paidInPeriod(freshData, invPeriod) < invoice.amount) {
        await recordTuitionPayment(classId, student.id, {
          amount: invoice.amount, period: invPeriod, paid_at: new Date().toISOString(),
          method: "transfer", note: "Xác nhận từ biên lai học sinh",
        });
      }
    }
    setBusy(false);
    onUpdate();
  }

  const statusBadge = fee.net === 0
    ? null
    : debt === 0 && paid > 0
    ? { label: "Đã đủ", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 }
    : paid > 0
    ? { label: `Còn ${formatCurrency(debt)}`, cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: AlertCircle }
    : { label: "Chưa đóng", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: Clock };
  const invBadge = INVOICE_BADGE[invoice?.status ?? "none"];

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-4">
        {/* Header row */}
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{initials(name)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <button onClick={() => setShowHist(true)} className="text-sm font-semibold text-foreground hover:text-primary hover:underline text-left leading-tight block truncate">{name}</button>
            <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 ${PKG_COLOR[pkg]}`}>{PKG_LABEL[pkg]}</span>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {statusBadge && (
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full ${statusBadge.cls}`}>
                <statusBadge.icon className="h-3 w-3" />{statusBadge.label}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${invBadge.cls}`}>
              <FileText className="h-2.5 w-2.5" />{invBadge.label}
            </span>
          </div>
        </div>

        {/* Fee breakdown row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          {/* Số buổi */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1 flex items-center gap-1">
              <CalendarCheck className="h-3 w-3" /> Số buổi
            </label>
            {editSess ? (
              <div className="flex items-center gap-1">
                <input type="number" min={0} value={sessInput} autoFocus
                  onChange={e => setSessInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveSessions(); if (e.key === "Escape") setEditSess(false); }}
                  className="w-14 h-8 px-2 rounded-lg border border-primary bg-background text-sm font-semibold text-foreground outline-none" />
                <button onClick={saveSessions} className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" /></button>
                <button onClick={() => setEditSess(false)} className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <button onClick={() => { setSessInput(String(fee.sessions)); setEditSess(true); }} className="h-8 px-2.5 rounded-lg border border-border hover:border-primary/50 text-sm font-semibold text-foreground flex items-center gap-1.5">
                {fee.sessions} buổi
                {fee.overridden
                  ? <span title="Đã chỉnh tay" className="text-[9px] text-primary bg-primary/10 px-1 rounded">sửa</span>
                  : <span className="text-[9px] text-muted-foreground">điểm danh</span>}
              </button>
            )}
            {fee.overridden && !editSess && (
              <button onClick={resetSessions} className="mt-1 text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5">
                <RotateCcw className="h-2.5 w-2.5" /> về {fee.attended} (điểm danh)
              </button>
            )}
          </div>

          {/* Đơn giá */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">Đơn giá/buổi</label>
            <p className="h-8 flex items-center text-sm font-semibold text-foreground">{fee.unit > 0 ? formatCurrency(fee.unit) : <span className="text-muted-foreground text-xs">Chưa đặt</span>}</p>
          </div>

          {/* Giảm giá */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">Giảm học phí</label>
            <div className="flex items-center gap-1">
              <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
                <button onClick={() => setDiscType("amount")} className={`px-2 h-8 text-xs font-semibold transition-colors ${discType === "amount" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>đ</button>
                <button onClick={() => setDiscType("percent")} className={`px-2 h-8 text-xs font-semibold transition-colors ${discType === "percent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>%</button>
              </div>
              <input type="text" inputMode="numeric"
                value={discType === "amount" ? (parseInt(discInput || "0") ? parseInt(discInput).toLocaleString("vi-VN") : "") : discInput}
                onChange={e => setDiscInput(e.target.value.replace(/\D/g, ""))}
                onBlur={saveDiscount}
                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                placeholder="0"
                className="w-full h-8 px-2 rounded-lg border border-border bg-background text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
          </div>

          {/* Thành tiền */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">Thành tiền</label>
            <div className="h-8 flex items-center gap-1.5">
              <span className="text-base font-bold text-foreground">{formatCurrency(fee.net)}</span>
              {discountLabel(fee.discount) && <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-900/20 px-1.5 py-0.5 rounded-full">{discountLabel(fee.discount)}</span>}
            </div>
            {fee.discount && fee.discount.value > 0 && (
              <p className="text-[10px] text-muted-foreground line-through">{formatCurrency(fee.gross)}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border/60">
          <span className="text-xs text-muted-foreground">Đã đóng kỳ này: <span className="font-semibold text-foreground">{formatCurrency(paid)}</span></span>
          <div className="flex items-center gap-1.5">
            {!invoice && fee.net > 0 && (
              <Button size="sm" variant="outline" className="h-8 text-xs px-2.5" disabled={busy} onClick={issueInvoice} title="Phát hành hóa đơn tháng này">
                <FileText className="h-3 w-3 mr-1" />Phát hành HĐ
              </Button>
            )}
            {invoice?.status === "pending_verification" && (
              <Button size="sm" variant="gradient" className="h-8 text-xs px-2.5" disabled={busy} onClick={confirmReceipt} title="Học sinh đã nộp biên lai — xác nhận đã thu">
                <Receipt className="h-3 w-3 mr-1" />Xác nhận đã thu
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-8 text-xs px-3" onClick={() => setShowPay(true)}>
              <Plus className="h-3 w-3 mr-1" />Ghi nhận
            </Button>
          </div>
        </div>
      </div>

      {showPay && (
        <PaymentModal studentName={name} defaultAmount={fee.net}
          onSave={async p => { await recordTuitionPayment(classId, student.id, p); onUpdate(); }}
          onClose={() => setShowPay(false)} />
      )}
      {showHist && (
        <HistoryPanel studentName={name} data={sData} classId={classId} studentId={student.id} onUpdate={onUpdate} onClose={() => setShowHist(false)} />
      )}
    </>
  );
}

// ── Config panel (đơn giá / buổi) ─────────────────────────────────────────────

function ConfigPanel({ classId, config, period, onUpdate }: { classId: string; config: ClassTuitionConfig; period: string; onUpdate: () => void }) {
  const effective = resolveUnitPrices(config, period);
  const hasOwn = !!config.unit_prices?.[period];
  const [inputs, setInputs] = useState<PackagePrices>(effective);
  const [saved, setSaved] = useState(false);

  // Đồng bộ input khi đổi kỳ hoặc dữ liệu nguồn đổi
  useEffect(() => { setInputs(resolveUnitPrices(config, period)); }, [period, config.unit_prices]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    const cur = await getClassTuition(classId);
    cur.unit_prices = { ...(cur.unit_prices ?? {}), [period]: {
      online: inputs.online || 0, advanced: inputs.advanced || 0, offline: inputs.offline || 0,
    } };
    await saveClassTuition(classId, cur);
    setSaved(true); setTimeout(() => setSaved(false), 2500);
    onUpdate();
  }

  return (
    <div className="p-4 rounded-2xl border border-border bg-muted/20 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Đơn giá / buổi theo gói — {periodLabel(period)}</p>
        {!hasOwn && <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Kế thừa từ kỳ trước</span>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(["online", "advanced", "offline"] as const).map(pkg => (
          <div key={pkg}>
            <label className={`text-xs font-medium block mb-1.5 ${PKG_COLOR[pkg].split(" ")[1]}`}>Gói {PKG_LABEL[pkg]}</label>
            <div className="relative">
              <input type="text"
                value={inputs[pkg] ? inputs[pkg].toLocaleString("vi-VN") : ""}
                onChange={e => setInputs(prev => ({ ...prev, [pkg]: parseInt(e.target.value.replace(/\D/g, ""), 10) || 0 }))}
                placeholder="0"
                className="w-full h-10 px-3 pr-7 rounded-xl border border-border bg-background text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/40" />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">đ</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="gradient" onClick={save}><Check className="h-3.5 w-3.5 mr-1" />Lưu đơn giá {periodLabel(period)}</Button>
        {saved && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Đã lưu</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        Đơn giá lưu riêng theo <strong>từng tháng</strong> — đổi giá tháng này <strong>không ảnh hưởng</strong> các tháng đã qua. Học phí = đơn giá (theo gói) × số buổi thực tế (từ điểm danh, chỉnh được) − giảm giá.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  classId: string;
  className?: string;
  students: Array<{ id: string; full_name?: string; name?: string; package?: PackageType }>;
}

export default function TuitionTab({ classId, className, students }: Props) {
  const [config, setConfig] = useState<ClassTuitionConfig>({ package_fees: { online: 0, advanced: 0, offline: 0 }, students: {} });
  const [invoices, setInvoices] = useState<TuitionInvoice[]>([]);
  const [attendance, setAttendance] = useState<TeacherAttendanceRecord[]>([]);
  const [period, setPeriod] = useState(currentPeriod());
  const [showConfig, setShowConfig] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const reload = useCallback(() => {
    getClassTuition(classId).then(setConfig);
    getInvoices().then(list => setInvoices(list.filter(inv => inv.class_id === classId)));
    getAllTeacherAttendance().then(list => setAttendance(list.filter(a => a.class_id === classId)));
  }, [classId]);
  useEffect(() => { reload(); }, [reload]);

  const clsName = className ?? "lớp học";
  const invoiceFor = (studentId: string) => invoices.find(inv => inv.child_id === studentId && inv.period === period);
  const attendedFor = (studentId: string) => attendedSessions(attendance, classId, studentId, period);
  const netFor = (st: Props["students"][number]) =>
    computeFee(config, config.students[st.id] ?? { payments: [] }, period, attendedFor(st.id), st.package ?? "online").net;

  async function issueAll() {
    if (bulkBusy) return;
    setBulkBusy(true);
    for (const st of students) {
      if (invoiceFor(st.id)) continue;
      const net = netFor(st);
      if (net <= 0) continue;
      await issueTuitionInvoice({ classId, className: clsName, studentId: st.id, amount: net, period, dueDate: `${period}-15` });
    }
    setBulkBusy(false);
    reload();
  }

  const missingCount = students.filter(st => !invoiceFor(st.id) && netFor(st) > 0).length;
  const prices = resolveUnitPrices(config, period);
  const unitSet = prices.online > 0 || prices.advanced > 0 || prices.offline > 0;

  const totalExpected = students.reduce((s, st) => s + netFor(st), 0);
  const totalCollected = students.reduce((s, st) => {
    const sData = config.students[st.id];
    return s + (sData ? paidInPeriod(sData, period) : 0);
  }, 0);
  const totalDebt = Math.max(0, totalExpected - totalCollected);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground">Quản lý học phí</h3>
          <p className="text-sm text-muted-foreground">{students.length} học viên · Tính theo buổi thực tế</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="h-9 px-3 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40" />
          {missingCount > 0 && (
            <Button variant="gradient" size="sm" disabled={bulkBusy} onClick={issueAll}>
              <FileText className="h-4 w-4 mr-1.5" />Phát hành tất cả ({missingCount})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowConfig(v => !v)}>
            <Settings className="h-4 w-4 mr-1.5" />Đơn giá
          </Button>
        </div>
      </div>

      {/* Config */}
      {(showConfig || !unitSet) && <ConfigPanel classId={classId} config={config} period={period} onUpdate={reload} />}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl border border-border bg-card">
          <p className="text-xs text-muted-foreground mb-1">{periodLabel(period)} — Dự kiến</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(totalExpected)}</p>
        </div>
        <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-900/10">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Đã thu được</p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(totalCollected)}</p>
        </div>
        <div className={`p-4 rounded-2xl border ${totalDebt > 0 ? "border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-900/10" : "border-border bg-card"}`}>
          <p className={`text-xs mb-1 ${totalDebt > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>Còn chưa thu</p>
          <p className={`text-xl font-bold ${totalDebt > 0 ? "text-red-700 dark:text-red-300" : "text-foreground"}`}>{formatCurrency(totalDebt)}</p>
        </div>
      </div>

      {/* Student cards */}
      {students.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-border/50 rounded-2xl">
          <Wallet className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Lớp chưa có học viên</p>
        </div>
      ) : (
        <div className="space-y-3">
          {students.map(s => (
            <StudentCard key={s.id} student={s} config={config} period={period}
              classId={classId} className={clsName} invoice={invoiceFor(s.id)}
              attended={attendedFor(s.id)} onUpdate={reload} />
          ))}
        </div>
      )}
    </div>
  );
}
