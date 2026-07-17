"use client";

import { useState } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { Database, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { seedRealData, type SeedResult } from "@/lib/seed";
import { formatCurrency } from "@/lib/utils";

export default function AdminSeedPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState("");

  const run = async () => {
    setRunning(true); setError(""); setResult(null);
    try {
      setResult(await seedRealData());
    } catch (e: any) {
      setError(e?.message ?? "Lỗi khi tạo dữ liệu");
    } finally {
      setRunning(false);
    }
  };

  return (
    <PortalLayout role="admin" userName="Admin User" pageTitle="Tạo dữ liệu mẫu">
      <div className="space-y-6 max-w-2xl">
        <SectionHeader title="Tạo dữ liệu mẫu (Dev)" subtitle="Ghi dữ liệu THẬT vào Supabase để báo cáo có số hiển thị" />

        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" /> Học phí · Điểm thi · Điểm danh · Hoá đơn
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>Ghi vào <code>kv_tuition</code>, <code>kv_exam_scores</code>, <code>kv_teacher_attendance</code>, <code>kv_invoices</code> dựa trên danh sách lớp/học viên hiện có. Chạy lại sẽ <strong>ghi đè</strong> các dữ liệu mẫu này (không cộng dồn).</p>
            </div>

            <Button variant="gradient" onClick={run} disabled={running} className="flex items-center gap-2">
              {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo…</> : <><Database className="h-4 w-4" /> Tạo dữ liệu mẫu</>}
            </Button>

            {error && (
              <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl">{error}</div>
            )}

            {result && (
              <div className="text-sm text-emerald-800 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl space-y-1">
                <p className="font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Đã tạo dữ liệu thành công!</p>
                <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  <li>• Học phí: {result.tuitionClasses} lớp</li>
                  <li>• Điểm thi: {result.examScores} bản ghi</li>
                  <li>• Điểm danh: {result.attendance} bản ghi</li>
                  <li>• Hoá đơn: {result.invoices} hoá đơn</li>
                  <li>• Tổng doanh thu ghi nhận: <strong>{formatCurrency(result.revenue)}</strong></li>
                </ul>
                <p className="text-xs text-muted-foreground pt-1">Mở lại trang <strong>Báo cáo</strong> để xem số liệu.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
