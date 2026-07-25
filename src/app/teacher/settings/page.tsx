"use client";

import { useState, useEffect, useRef } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/shared";
import { getTeacherSettings, saveTeacherSettings, type TeacherSettings } from "@/lib/storage";
import { uploadClassFile } from "@/lib/upload";
import { QrCode, UploadCloud, Link2, Check, Loader2, Building2, X } from "lucide-react";

const TEACHER_ID = "t1";
const TEACHER_NAME = "Thầy Hùng Toán";

export default function TeacherSettingsPage() {
  const [settings, setSettings] = useState<TeacherSettings>({});
  const [mode, setMode] = useState<"upload" | "link">("upload");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getTeacherSettings(TEACHER_ID).then(s => {
      setSettings(s);
      if (s.qr_image_url) setMode(/^https?:\/\//.test(s.qr_image_url) && !s.qr_image_url.includes("/storage/") ? "link" : "upload");
    });
  }, []);

  function set<K extends keyof TeacherSettings>(key: K, val: TeacherSettings[K]) {
    setSettings(s => ({ ...s, [key]: val }));
    setSaved(false);
  }

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError("");
    try {
      const up = await uploadClassFile(file, TEACHER_ID, "materials");
      set("qr_image_url", up.url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Lỗi tải ảnh lên");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveTeacherSettings(TEACHER_ID, settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalLayout role="teacher" userName={TEACHER_NAME} pageTitle="Cài đặt">
      <div className="max-w-2xl mx-auto space-y-6">
        <SectionHeader
          title="Cài đặt thanh toán"
          subtitle="Cấu hình mã QR & thông tin tài khoản để học viên chuyển khoản học phí"
        />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" /> Mã QR chuyển khoản
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode toggle */}
            <div className="flex rounded-xl border border-border overflow-hidden w-fit text-sm">
              <button
                onClick={() => setMode("upload")}
                className={`flex items-center gap-1.5 px-3.5 py-2 transition-colors ${mode === "upload" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                <UploadCloud className="h-3.5 w-3.5" /> Tải ảnh QR
              </button>
              <button
                onClick={() => setMode("link")}
                className={`flex items-center gap-1.5 px-3.5 py-2 transition-colors ${mode === "link" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                <Link2 className="h-3.5 w-3.5" /> Dùng link
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {/* Input area */}
              <div className="flex-1 space-y-2">
                {mode === "upload" ? (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="w-full border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-all disabled:opacity-60"
                    >
                      {uploading
                        ? <Loader2 className="h-6 w-6 text-primary mx-auto mb-1.5 animate-spin" />
                        : <UploadCloud className="h-6 w-6 text-muted-foreground mx-auto mb-1.5" />}
                      <p className="text-xs text-muted-foreground">{uploading ? "Đang tải lên…" : "Nhấn để chọn ảnh QR (PNG/JPG)"}</p>
                    </button>
                    {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
                  </>
                ) : (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Link ảnh QR / VietQR</label>
                    <Input
                      value={settings.qr_image_url ?? ""}
                      onChange={e => set("qr_image_url", e.target.value)}
                      placeholder="https://img.vietqr.io/... hoặc link ảnh QR"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">Dán link ảnh QR (VietQR, MoMo, ngân hàng…). Học viên sẽ thấy đúng ảnh này.</p>
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="sm:w-40 shrink-0">
                <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Xem trước</p>
                {settings.qr_image_url ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={settings.qr_image_url}
                      alt="QR chuyển khoản"
                      className="w-full aspect-square object-contain rounded-xl border border-border bg-white p-2"
                    />
                    <button
                      onClick={() => set("qr_image_url", "")}
                      title="Xoá QR"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow hover:bg-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="w-full aspect-square rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground">
                    <QrCode className="h-8 w-8 opacity-30" />
                    <p className="text-[10px] mt-1">Chưa có QR</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Thông tin tài khoản
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Ngân hàng</label>
                <Input value={settings.bank_name ?? ""} onChange={e => set("bank_name", e.target.value)} placeholder="VD: TPBank" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Số tài khoản</label>
                <Input value={settings.account_number ?? ""} onChange={e => set("account_number", e.target.value)} placeholder="VD: 12604051999" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Chủ tài khoản</label>
                <Input value={settings.account_holder ?? ""} onChange={e => set("account_holder", e.target.value)} placeholder="VD: LE HUY HOANG" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Ghi chú (tuỳ chọn)</label>
                <Input value={settings.payment_note ?? ""} onChange={e => set("payment_note", e.target.value)} placeholder="VD: Ghi rõ tên HV khi CK" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Check className="h-4 w-4" /> Đã lưu
            </span>
          )}
          <Button variant="gradient" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
            Lưu cài đặt
          </Button>
        </div>
      </div>
    </PortalLayout>
  );
}
