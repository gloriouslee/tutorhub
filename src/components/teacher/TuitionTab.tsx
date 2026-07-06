"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  getClassTuition, saveClassTuition, recordTuitionPayment, deleteTuitionPayment,
  getInvoices, issueTuitionInvoice, confirmInvoicePaid,
  type ClassTuitionConfig, type StudentTuitionData, type TuitionPaymentRecord, type TuitionInvoice,
} from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import {
  Wallet, Plus, Pencil, Check, X,
  Trash2, Clock, AlertCircle, CheckCircle2, Settings, FileText, Receipt,
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
  return student.payments
    .filter(p => p.period === period)
    .reduce((s, p) => s + p.amount, 0);
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

const PKG_LABEL: Record<PackageType, string> = {
  online: "Online",
  advanced: "Nâng cao",
  offline: "Offline",
};

const PKG_COLOR: Record<PackageType, string> = {
  online: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  advanced: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  offline: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

function getEffectiveFee(
  sData: StudentTuitionData,
  pkg: PackageType | undefined,
  config: ClassTuitionConfig,
): number {
  if (sData.custom_fee !== undefined) return sData.custom_fee;
  const p = pkg ?? "online";
  return config.package_fees?.[p] ?? 0;
}

// ── Payment modal ─────────────────────────────────────────────────────────────

function PaymentModal({
  studentName: name, defaultAmount, onSave, onClose,
}: {
  studentName: string; defaultAmount: number;
  onSave: (p: Omit<TuitionPaymentRecord, "id">) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(defaultAmount.toString());
  const [period, setPeriod] = useState(currentPeriod());
  const [method, setMethod] = useState<"cash" | "transfer" | "other">("cash");
  const [note, setNote]     = useState("");

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
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Số tiền</label>
            <div className="relative">
              <input
                type="text"
                value={parseInt(amount || "0").toLocaleString("vi-VN")}
                onChange={e => setAmount(e.target.value.replace(/\D/g, ""))}
                className="w-full h-10 px-3 pr-8 rounded-xl border border-border bg-background text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/40"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">đ</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Kỳ thanh toán</label>
            <input
              type="month"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Hình thức</label>
            <div className="flex gap-2">
              {(["cash", "transfer", "other"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-colors ${method === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                >
                  {m === "cash" ? "Tiền mặt" : m === "transfer" ? "Chuyển khoản" : "Khác"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Ghi chú (tuỳ chọn)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="VD: Đóng kèm tháng 8…"
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <Button variant="outline" className="flex-1" onClick={onClose}>Huỷ</Button>
          <Button variant="gradient" className="flex-1" onClick={handleSave}>
            <Check className="h-3.5 w-3.5 mr-1.5" />Lưu
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── History panel ─────────────────────────────────────────────────────────────

function HistoryPanel({
  studentName: name, data, classId, studentId, onUpdate, onClose,
}: {
  studentName: string; data: StudentTuitionData;
  classId: string; studentId: string;
  onUpdate: () => void; onClose: () => void;
}) {
  const sorted = [...data.payments].sort((a, b) => b.paid_at.localeCompare(a.paid_at));

  async function handleDelete(paymentId: string) {
    await deleteTuitionPayment(classId, studentId, paymentId);
    onUpdate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md sm:m-4 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <p className="font-semibold text-foreground text-sm">Lịch sử thanh toán</p>
            <p className="text-xs text-muted-foreground">{name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
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
                <p className="text-xs text-muted-foreground mt-0.5">
                  {periodLabel(p.period)} · {new Date(p.paid_at).toLocaleDateString("vi-VN")}
                </p>
                {p.note && <p className="text-xs text-muted-foreground italic">{p.note}</p>}
              </div>
              <button
                onClick={() => handleDelete(p.id)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
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

// ── Student row ───────────────────────────────────────────────────────────────

const INVOICE_BADGE: Record<string, { label: string; cls: string }> = {
  none:                 { label: "Chưa phát hành", cls: "bg-muted text-muted-foreground" },
  pending:              { label: "Chờ đóng",       cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  pending_verification: { label: "Chờ xác minh",   cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
  paid:                 { label: "Đã đóng",        cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
};

function StudentRow({
  student, config, period, classId, className, invoice, onUpdate,
}: {
  student: { id: string; full_name?: string; name?: string; package?: PackageType };
  config: ClassTuitionConfig;
  period: string;
  classId: string;
  className: string;
  invoice?: TuitionInvoice;
  onUpdate: () => void;
}) {
  const sData = config.students[student.id] ?? { payments: [] };
  const pkg   = student.package ?? "online";
  const fee   = getEffectiveFee(sData, pkg, config);
  const paid  = paidInPeriod(sData, period);
  const debt  = Math.max(0, fee - paid);
  const name  = studentName(student);

  const [editFee,   setEditFee]   = useState(false);
  const [feeInput,  setFeeInput]  = useState(fee.toString());
  const [editNote,  setEditNote]  = useState(false);
  const [noteInput, setNoteInput] = useState(sData.notes ?? "");
  const [showPay,   setShowPay]   = useState(false);
  const [showHist,  setShowHist]  = useState(false);
  const [busy,      setBusy]      = useState(false);

  async function issueInvoice() {
    if (busy) return;
    setBusy(true);
    await issueTuitionInvoice({
      classId, className, studentId: student.id,
      amount: fee, period, dueDate: `${period}-15`,
    });
    setBusy(false);
    onUpdate();
  }

  async function confirmReceipt() {
    if (busy || !invoice || invoice.status !== "pending_verification") return;
    setBusy(true);
    // Đọc lại trạng thái mới nhất để tránh ghi nhận trùng
    const fresh = (await getInvoices()).find(i => i.id === invoice.id);
    if (fresh && fresh.status === "pending_verification") {
      await confirmInvoicePaid(invoice.id);
      await recordTuitionPayment(classId, student.id, {
        amount: invoice.amount,
        period: invoice.period ?? period,
        paid_at: new Date().toISOString(),
        method: "transfer",
        note: "Xác nhận từ biên lai học sinh",
      });
    }
    setBusy(false);
    onUpdate();
  }

  async function saveFee() {
    const v = parseInt(feeInput.replace(/\D/g, ""), 10) || 0;
    const cur = await getClassTuition(classId);
    cur.students[student.id] = { ...sData, custom_fee: v };
    await saveClassTuition(classId, cur);
    setEditFee(false);
    onUpdate();
  }

  async function clearCustomFee() {
    const cur = await getClassTuition(classId);
    const existing = cur.students[student.id] ?? { payments: [] };
    delete existing.custom_fee;
    cur.students[student.id] = existing;
    await saveClassTuition(classId, cur);
    onUpdate();
  }

  async function saveNote() {
    const cur = await getClassTuition(classId);
    cur.students[student.id] = { ...sData, notes: noteInput.trim() || undefined };
    await saveClassTuition(classId, cur);
    setEditNote(false);
    onUpdate();
  }

  const statusBadge = fee === 0
    ? null
    : debt === 0
    ? { label: "Đã đủ", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 }
    : paid > 0
    ? { label: `Còn ${formatCurrency(debt)}`, cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: AlertCircle }
    : { label: "Chưa đóng", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: Clock };

  return (
    <>
      <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-border-strong transition-colors">
        {/* Avatar */}
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-primary">{initials(name)}</span>
        </div>

        {/* Name + package */}
        <div className="w-40 shrink-0">
          <button
            onClick={() => setShowHist(true)}
            className="text-sm font-medium text-foreground hover:text-primary hover:underline text-left leading-tight block"
          >
            {name}
          </button>
          <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 ${PKG_COLOR[pkg]}`}>
            {PKG_LABEL[pkg]}
          </span>
        </div>

        {/* Fee per month */}
        <div className="w-36 shrink-0">
          {editFee ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={parseInt(feeInput || "0").toLocaleString("vi-VN")}
                onChange={e => setFeeInput(e.target.value.replace(/\D/g, ""))}
                className="w-24 h-7 px-2 rounded-lg border border-primary bg-background text-xs font-semibold text-foreground outline-none"
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") saveFee(); if (e.key === "Escape") setEditFee(false); }}
              />
              <button onClick={saveFee} className="h-7 w-7 flex items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs"><Check className="h-3 w-3" /></button>
              <button onClick={() => setEditFee(false)} className="h-7 w-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted text-xs"><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <button
                onClick={() => { setFeeInput(fee.toString()); setEditFee(true); }}
                className="flex items-center gap-1 text-left"
              >
                <span className="text-sm font-semibold text-foreground">{formatCurrency(fee)}</span>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              {sData.custom_fee !== undefined ? (
                <button
                  onClick={clearCustomFee}
                  title="Bỏ đặt riêng → dùng học phí theo gói"
                  className="text-[9px] text-primary bg-primary/10 px-1 rounded hover:bg-red-100 hover:text-red-600 transition-colors"
                >
                  riêng
                </button>
              ) : (
                <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100">theo gói</span>
              )}
            </div>
          )}
        </div>

        {/* Status badge */}
        <div className="w-32 shrink-0">
          {statusBadge ? (
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full ${statusBadge.cls}`}>
              <statusBadge.icon className="h-3 w-3" />
              {statusBadge.label}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
          {(() => {
            const b = INVOICE_BADGE[invoice?.status ?? "none"];
            return (
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 ${b.cls}`}>
                <FileText className="h-2.5 w-2.5" />
                {b.label}
              </span>
            );
          })()}
        </div>

        {/* Paid this period */}
        <div className="w-24 shrink-0 text-sm text-foreground font-medium">
          {fee > 0 ? formatCurrency(paid) : "—"}
        </div>

        {/* Notes */}
        <div className="flex-1 min-w-0">
          {editNote ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                placeholder="Ghi chú…"
                className="flex-1 h-7 px-2 rounded-lg border border-primary bg-background text-xs text-foreground outline-none"
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") saveNote(); if (e.key === "Escape") setEditNote(false); }}
              />
              <button onClick={saveNote} className="h-7 w-7 flex items-center justify-center rounded-lg bg-primary text-primary-foreground"><Check className="h-3 w-3" /></button>
              <button onClick={() => setEditNote(false)} className="h-7 w-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <button
              onClick={() => setEditNote(true)}
              className="flex items-center gap-1.5 group text-left w-full"
            >
              <span className={`text-xs truncate ${sData.notes ? "text-foreground" : "text-muted-foreground"}`}>
                {sData.notes ?? "Thêm ghi chú…"}
              </span>
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-1.5">
          {!invoice && fee > 0 && (
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

      {showPay && (
        <PaymentModal
          studentName={name}
          defaultAmount={fee}
          onSave={async p => { await recordTuitionPayment(classId, student.id, p); onUpdate(); }}
          onClose={() => setShowPay(false)}
        />
      )}
      {showHist && (
        <HistoryPanel
          studentName={name}
          data={sData}
          classId={classId}
          studentId={student.id}
          onUpdate={onUpdate}
          onClose={() => setShowHist(false)}
        />
      )}
    </>
  );
}

// ── Config panel ─────────────────────────────────────────────────────────────

function ConfigPanel({ classId, config, onUpdate }: {
  classId: string; config: ClassTuitionConfig; onUpdate: () => void;
}) {
  const fees = config.package_fees ?? { online: 0, advanced: 0, offline: 0 };
  const [inputs, setInputs] = useState({
    online:   fees.online.toString(),
    advanced: fees.advanced.toString(),
    offline:  fees.offline.toString(),
  });

  async function saveAll() {
    const cur = await getClassTuition(classId);
    cur.package_fees = {
      online:   parseInt(inputs.online.replace(/\D/g, ""), 10) || 0,
      advanced: parseInt(inputs.advanced.replace(/\D/g, ""), 10) || 0,
      offline:  parseInt(inputs.offline.replace(/\D/g, ""), 10) || 0,
    };
    await saveClassTuition(classId, cur);
    onUpdate();
  }

  return (
    <div className="p-4 rounded-2xl border border-border bg-muted/20 space-y-3">
      <p className="text-sm font-semibold text-foreground">Học phí theo gói</p>
      <div className="grid grid-cols-3 gap-3">
        {(["online", "advanced", "offline"] as const).map(pkg => (
          <div key={pkg}>
            <label className={`text-xs font-medium block mb-1.5 ${PKG_COLOR[pkg].split(" ")[1]}`}>
              Gói {PKG_LABEL[pkg]}
            </label>
            <div className="relative">
              <input
                type="text"
                value={parseInt(inputs[pkg] || "0").toLocaleString("vi-VN")}
                onChange={e => setInputs(prev => ({ ...prev, [pkg]: e.target.value.replace(/\D/g, "") }))}
                className="w-full h-10 px-3 pr-7 rounded-xl border border-border bg-background text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/40"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">đ</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="gradient" onClick={saveAll}>
          <Check className="h-3.5 w-3.5 mr-1" />Lưu học phí
        </Button>
        <p className="text-xs text-muted-foreground">Học viên sẽ tự động áp dụng mức phí theo gói đăng ký. Có thể đặt riêng từng học viên.</p>
      </div>
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
  const [config,     setConfig]     = useState<ClassTuitionConfig>({ package_fees: { online: 0, advanced: 0, offline: 0 }, students: {} });
  const [invoices,   setInvoices]   = useState<TuitionInvoice[]>([]);
  const [period,     setPeriod]     = useState(currentPeriod());
  const [showConfig, setShowConfig] = useState(false);
  const [bulkBusy,   setBulkBusy]   = useState(false);

  const reload = useCallback(() => {
    getClassTuition(classId).then(setConfig);
    getInvoices().then(list => setInvoices(list.filter(inv => inv.class_id === classId)));
  }, [classId]);

  useEffect(() => { reload(); }, [reload]);

  const clsName = className ?? "lớp học";
  const invoiceFor = (studentId: string) =>
    invoices.find(inv => inv.child_id === studentId && inv.period === period);

  async function issueAll() {
    if (bulkBusy) return;
    setBulkBusy(true);
    for (const st of students) {
      if (invoiceFor(st.id)) continue;
      const sData = config.students[st.id] ?? { payments: [] };
      const fee = getEffectiveFee(sData, st.package ?? "online", config);
      if (fee <= 0) continue;
      await issueTuitionInvoice({
        classId, className: clsName, studentId: st.id,
        amount: fee, period, dueDate: `${period}-15`,
      });
    }
    setBulkBusy(false);
    reload();
  }

  const missingCount = students.filter(st => {
    const sData = config.students[st.id] ?? { payments: [] };
    return !invoiceFor(st.id) && getEffectiveFee(sData, st.package ?? "online", config) > 0;
  }).length;

  // Summary for selected period
  const totalExpected = students.reduce((s, st) => {
    const sData = config.students[st.id];
    return s + getEffectiveFee(sData ?? { payments: [] }, st.package ?? "online", config);
  }, 0);

  const totalCollected = students.reduce((s, st) => {
    const sData = config.students[st.id];
    return s + (sData ? paidInPeriod(sData, period) : 0);
  }, 0);

  const totalDebt = Math.max(0, totalExpected - totalCollected);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">Quản lý học phí</h3>
          <p className="text-sm text-muted-foreground">{students.length} học viên · Chu kỳ hàng tháng</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="h-9 px-3 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
          />
          {missingCount > 0 && (
            <Button variant="gradient" size="sm" disabled={bulkBusy} onClick={issueAll}>
              <FileText className="h-4 w-4 mr-1.5" />Phát hành hóa đơn tháng này ({missingCount})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowConfig(v => !v)}>
            <Settings className="h-4 w-4 mr-1.5" />Cài đặt
          </Button>
        </div>
      </div>

      {/* Config panel */}
      {showConfig && <ConfigPanel classId={classId} config={config} onUpdate={reload} />}

      {/* Summary cards */}
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

      {/* Table header */}
      <div className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
        <div className="w-9 shrink-0" />
        <div className="w-40 shrink-0">Học viên</div>
        <div className="w-36 shrink-0">Học phí/tháng</div>
        <div className="w-32 shrink-0">Trạng thái</div>
        <div className="w-24 shrink-0">Đã đóng</div>
        <div className="flex-1">Ghi chú</div>
        <div className="shrink-0 w-24 text-right">Thao tác</div>
      </div>

      {/* Student rows */}
      {students.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-border/50 rounded-2xl">
          <Wallet className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Lớp chưa có học viên</p>
        </div>
      ) : (
        <div className="space-y-2">
          {students.map(s => (
            <StudentRow
              key={s.id}
              student={s}
              config={config}
              period={period}
              classId={classId}
              className={clsName}
              invoice={invoiceFor(s.id)}
              onUpdate={reload}
            />
          ))}
        </div>
      )}
    </div>
  );
}
