"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createTransaction } from "@/lib/storage";
import {
  CheckCircle2, Copy, Zap, Crown, Tag, AlertCircle,
  ArrowLeft, CreditCard, Clock, ShieldCheck,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Package catalogue (must match student/materials/page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

const PACKAGES: Record<string, { id: string; title: string; subject: string; grade: number; price: number; originalPrice?: number; tier: "basic" | "pro" | "elite" }> = {
  pp1: { id: "pp1", title: "Toán 12 — Siêu Ôn Luyện THPT Quốc Gia", subject: "Toán học", grade: 12, price: 299000, originalPrice: 499000, tier: "pro" },
  pp2: { id: "pp2", title: "Vật Lý 12 — Điện xoay chiều & Sóng", subject: "Vật lý", grade: 12, price: 199000, tier: "basic" },
  pp3: { id: "pp3", title: "Hóa Học 12 — Lý thuyết & Bài tập nâng cao", subject: "Hóa học", grade: 12, price: 349000, originalPrice: 550000, tier: "elite" },
  pp4: { id: "pp4", title: "Tiếng Anh 12 — Ngữ pháp & Từ vựng", subject: "Tiếng Anh", grade: 12, price: 149000, tier: "basic" },
};

const BANK = {
  name: "Vietcombank",
  account: "1234567890",
  owner: "TRAN VAN HUNG",
  branch: "Chi nhánh Hà Nội",
};

const TIER_CONFIG = {
  basic: { label: "Basic", icon: Tag, color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  pro:   { label: "Pro",   icon: Zap, color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  elite: { label: "Elite", icon: Crown, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
};

function fmt(n: number) { return n.toLocaleString("vi-VN") + "đ"; }

// ─────────────────────────────────────────────────────────────────────────────
// QR placeholder (bank transfer QR style)
// ─────────────────────────────────────────────────────────────────────────────

function QRPlaceholder({ amount, note }: { amount: number; note: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-40 h-40 bg-white rounded-xl border-2 border-border flex items-center justify-center relative overflow-hidden">
        {/* Simulated QR pattern */}
        <svg width="130" height="130" viewBox="0 0 130 130" className="opacity-90">
          {/* Corner squares */}
          <rect x="5" y="5" width="35" height="35" fill="none" stroke="#000" strokeWidth="4" />
          <rect x="12" y="12" width="21" height="21" fill="#000" />
          <rect x="90" y="5" width="35" height="35" fill="none" stroke="#000" strokeWidth="4" />
          <rect x="97" y="12" width="21" height="21" fill="#000" />
          <rect x="5" y="90" width="35" height="35" fill="none" stroke="#000" strokeWidth="4" />
          <rect x="12" y="97" width="21" height="21" fill="#000" />
          {/* Fake data dots */}
          {[48,54,60,66,72,78,84].map(x =>
            [10,16,22,28,34,40,46,52,58,64,70,76,82,88,94,100,106,112,118].map(y =>
              Math.sin(x * y) > 0.2
                ? <rect key={`${x}-${y}`} x={x} y={y} width="5" height="5" fill="#000" opacity="0.85" />
                : null
            )
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white p-1 rounded">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Quét để thanh toán nhanh</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy button
// ─────────────────────────────────────────────────────────────────────────────

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg border border-border">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate">{value}</p>
      </div>
      <button
        onClick={handleCopy}
        className={`shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
          copied
            ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800"
            : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
        }`}
      >
        {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Đã sao" : "Sao chép"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main checkout component
// ─────────────────────────────────────────────────────────────────────────────

function CheckoutContent() {
  const params = useSearchParams();
  const router = useRouter();
  const pkgId = params.get("pkg") ?? "";
  const pkg = PACKAGES[pkgId];

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Mock student identity (in real app: from auth session)
  const STUDENT_ID = "s1";
  const STUDENT_NAME = "Nguyễn Anh Tuấn";
  const STUDENT_EMAIL = "tuan.nva@gmail.com";

  const transferNote = `TUTORHUB ${pkgId.toUpperCase()} ${STUDENT_ID}`.toUpperCase();

  const handleConfirm = async () => {
    if (!pkg) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 800));
    createTransaction({
      pkg_id: pkg.id,
      pkg_title: pkg.title,
      amount: pkg.price,
      student_id: STUDENT_ID,
      student_name: STUDENT_NAME,
      student_email: STUDENT_EMAIL,
      transfer_note: transferNote,
    });
    setSubmitting(false);
    setSubmitted(true);
  };

  if (!pkg) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <AlertCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-lg font-semibold">Không tìm thấy gói tài liệu</h2>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/student/materials")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Quay lại
        </Button>
      </div>
    );
  }

  const tier = TIER_CONFIG[pkg.tier];
  const TierIcon = tier.icon;
  const discount = pkg.originalPrice
    ? Math.round((1 - pkg.price / pkg.originalPrice) * 100) : null;

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto">
        <Card className="border-emerald-200 dark:border-emerald-800/50">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Đã ghi nhận giao dịch</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Chúng tôi sẽ xác nhận chuyển khoản và mở khoá tài liệu cho bạn trong vòng <strong>1–4 giờ</strong> (trong giờ hành chính).
              Bạn sẽ nhận thông báo khi giao dịch được duyệt.
            </p>

            <div className="bg-muted/30 rounded-xl p-4 mb-6 text-left space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Chi tiết giao dịch</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gói tài liệu</span>
                <span className="font-medium text-foreground text-right max-w-[60%] line-clamp-1">{pkg.title}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Số tiền</span>
                <span className="font-bold text-foreground">{fmt(pkg.price)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Nội dung CK</span>
                <span className="font-mono text-xs text-foreground">{transferNote}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Trạng thái</span>
                <span className="flex items-center gap-1 text-amber-600 font-medium">
                  <Clock className="h-3.5 w-3.5" /> Chờ xác nhận
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={() => router.push("/student/materials")}>Quay về Tài liệu</Button>
              <Button variant="outline" onClick={() => router.push("/student/payments")}>Xem lịch sử thanh toán</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="h-4 w-4" /> Quay lại
      </button>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6">

        {/* Left: bank transfer info */}
        <div className="space-y-4">
          <div>
            <h1 className="text-lg font-bold text-foreground">Thanh toán chuyển khoản</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Chuyển khoản theo thông tin bên dưới, sau đó nhấn xác nhận</p>
          </div>

          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Thông tin tài khoản nhận</p>
                <Badge variant="outline" className="text-xs">{BANK.name}</Badge>
              </div>
              <CopyField label="Số tài khoản" value={BANK.account} />
              <CopyField label="Chủ tài khoản" value={BANK.owner} />
              <CopyField label="Số tiền (VND)" value={pkg.price.toLocaleString("vi-VN")} />
              <CopyField label="Nội dung chuyển khoản" value={transferNote} />

              <div className="flex items-start gap-2 pt-1 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Vui lòng nhập <strong>chính xác</strong> nội dung chuyển khoản để hệ thống xác nhận tự động.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* QR */}
          <Card>
            <CardContent className="p-5 flex flex-col items-center gap-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide self-start w-full">Quét mã QR</p>
              <QRPlaceholder amount={pkg.price} note={transferNote} />
              <p className="text-xs text-muted-foreground text-center">
                Mở app ngân hàng → Quét mã QR → Kiểm tra số tiền và nội dung → Xác nhận
              </p>
            </CardContent>
          </Card>

          {/* Confirm button */}
          <Button
            className="w-full h-11 gap-2 text-base"
            disabled={submitting}
            onClick={handleConfirm}
          >
            {submitting
              ? <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full inline-block" /> Đang gửi...</>
              : <><CheckCircle2 className="h-5 w-5" /> Tôi đã chuyển khoản</>}
          </Button>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            Giao dịch được xác nhận thủ công bởi admin trong 1–4 giờ. Bạn sẽ nhận thông báo khi được duyệt.
          </div>
        </div>

        {/* Right: order summary */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardContent className="p-5 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Đơn hàng</p>

              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${tier.color}`}>
                  <TierIcon className="h-3 w-3" />{tier.label}
                </span>
                {discount && (
                  <span className="text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">
                    -{discount}%
                  </span>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground leading-snug">{pkg.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{pkg.subject} · Khối {pkg.grade}</p>
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                {pkg.originalPrice && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Giá gốc</span>
                    <span className="line-through text-muted-foreground">{fmt(pkg.originalPrice)}</span>
                  </div>
                )}
                {discount && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Giảm giá</span>
                    <span className="text-emerald-600">-{fmt(pkg.originalPrice! - pkg.price)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold border-t border-border pt-2">
                  <span>Tổng cộng</span>
                  <span className="text-primary">{fmt(pkg.price)}</span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Truy cập trọn đời
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Tải tài liệu offline
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Cập nhật miễn phí
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <PortalLayout role="student" userName="" pageTitle="Thanh toán">
      <Suspense fallback={<div className="py-20 text-center text-muted-foreground text-sm">Đang tải...</div>}>
        <CheckoutContent />
      </Suspense>
    </PortalLayout>
  );
}
