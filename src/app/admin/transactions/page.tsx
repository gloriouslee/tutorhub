"use client";

import { useState, useEffect } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared";
import {
  getTransactions, updateTransactionStatus,
  type PurchaseTransaction, type TxStatus,
} from "@/lib/storage";
import {
  CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw,
  User, BookOpen, DollarSign, Calendar, Search,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const fmt = formatCurrency;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_CONFIG: Record<TxStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:  { label: "Chờ xác nhận", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",  icon: Clock },
  approved: { label: "Đã duyệt",     color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
  rejected: { label: "Từ chối",      color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",         icon: XCircle },
};

type Filter = "all" | TxStatus;

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<PurchaseTransaction[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  const reload = () => { getTransactions().then(setTransactions); };

  useEffect(() => { reload(); }, []);

  const handleAction = async (txId: string, action: "approved" | "rejected") => {
    setProcessing(txId);
    await updateTransactionStatus(txId, action);
    reload();
    setProcessing(null);
  };

  const filtered = transactions
    .filter(t => filter === "all" || t.status === filter)
    .filter(t =>
      !search.trim() ||
      t.student_name.toLowerCase().includes(search.toLowerCase()) ||
      t.pkg_title.toLowerCase().includes(search.toLowerCase()) ||
      t.transfer_note.toLowerCase().includes(search.toLowerCase())
    );

  const pendingCount = transactions.filter(t => t.status === "pending").length;

  const FILTERS: { value: Filter; label: string }[] = [
    { value: "all",      label: `Tất cả (${transactions.length})` },
    { value: "pending",  label: `Chờ duyệt (${pendingCount})` },
    { value: "approved", label: "Đã duyệt" },
    { value: "rejected", label: "Từ chối" },
  ];

  return (
    <PortalLayout role="admin" userName="Admin User" pageTitle="Giao dịch tài liệu">
      <div className="max-w-5xl mx-auto space-y-6">
        <SectionHeader
          title="Giao dịch mua tài liệu"
          subtitle="Xác nhận chuyển khoản để mở khoá tài liệu cho học viên"
          action={
            <Button size="sm" variant="outline" className="gap-1.5" onClick={reload}>
              <RefreshCw className="h-3.5 w-3.5" /> Làm mới
            </Button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {([
            { label: "Chờ xác nhận", value: transactions.filter(t => t.status === "pending").length, icon: Clock, color: "text-amber-500 bg-amber-100 dark:bg-amber-900/30" },
            { label: "Đã duyệt", value: transactions.filter(t => t.status === "approved").length, icon: CheckCircle2, color: "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30" },
            { label: "Tổng thu", value: fmt(transactions.filter(t => t.status === "approved").reduce((s, t) => s + t.amount, 0)), icon: DollarSign, color: "text-primary bg-primary/10" },
          ] as const).map(stat => (
            <Card key={stat.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-bold text-foreground">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter + search */}
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
              placeholder="Tìm học viên, gói tài liệu..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Transaction list */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <AlertCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">
                {transactions.length === 0 ? "Chưa có giao dịch nào" : "Không tìm thấy giao dịch phù hợp"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {transactions.length === 0
                  ? "Khi học viên mua tài liệu và xác nhận chuyển khoản, giao dịch sẽ hiện ở đây"
                  : "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(tx => {
              const sc = STATUS_CONFIG[tx.status];
              const StatusIcon = sc.icon;
              const isProcessing = processing === tx.id;

              return (
                <Card key={tx.id} className={tx.status === "pending" ? "border-amber-200 dark:border-amber-800/50" : ""}>
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">

                      {/* Left info */}
                      <div className="flex-1 space-y-3 min-w-0">
                        {/* Status + time */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${sc.color}`}>
                            <StatusIcon className="h-3 w-3" />{sc.label}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />{formatDateTime(tx.created_at)}
                          </span>
                        </div>

                        {/* Package */}
                        <div className="flex items-start gap-2">
                          <BookOpen className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-foreground">{tx.pkg_title}</p>
                            <p className="text-xs text-muted-foreground">Mã GD: <span className="font-mono">{tx.transfer_note}</span></p>
                          </div>
                        </div>

                        {/* Student */}
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-foreground">{tx.student_name}</p>
                            <p className="text-xs text-muted-foreground">{tx.student_email}</p>
                          </div>
                        </div>
                      </div>

                      {/* Right: amount + actions */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0">
                        <p className="text-xl font-bold text-foreground">{fmt(tx.amount)}</p>

                        {tx.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                              disabled={isProcessing}
                              onClick={() => handleAction(tx.id, "rejected")}
                            >
                              <XCircle className="h-3.5 w-3.5" /> Từ chối
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                              disabled={isProcessing}
                              onClick={() => handleAction(tx.id, "approved")}
                            >
                              {isProcessing
                                ? <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full inline-block" />
                                : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Xác nhận đã nhận
                            </Button>
                          </div>
                        )}

                        {tx.status === "approved" && tx.reviewed_at && (
                          <p className="text-xs text-muted-foreground">Duyệt: {formatDateTime(tx.reviewed_at)}</p>
                        )}
                        {tx.status === "rejected" && tx.reviewed_at && (
                          <p className="text-xs text-muted-foreground">Từ chối: {formatDateTime(tx.reviewed_at)}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
