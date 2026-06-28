import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  color = "bg-primary",
  size = "md",
  className,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const sizeMap = { sm: "h-1.5", md: "h-2", lg: "h-3" };

  return (
    <div className={cn("space-y-1", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && <span className="text-xs text-muted-foreground">{label}</span>}
          {showValue && <span className="text-xs font-semibold text-foreground">{pct}%</span>}
        </div>
      )}
      <div className={cn("w-full rounded-full bg-muted overflow-hidden", sizeMap[size])}>
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface AttendanceBadgeProps {
  status: "present" | "absent" | "late" | "excused";
}

export function AttendanceBadge({ status }: AttendanceBadgeProps) {
  const map = {
    present: { label: "Present", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    absent: { label: "Absent", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    late: { label: "Late", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    excused: { label: "Excused", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  };
  const { label, cls } = map[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", cls)}>
      {label}
    </span>
  );
}

interface PaymentBadgeProps {
  status: "paid" | "pending" | "overdue";
}

export function PaymentBadge({ status }: PaymentBadgeProps) {
  const map = {
    paid: { label: "Paid", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    pending: { label: "Pending", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    overdue: { label: "Overdue", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  };
  const { label, cls } = map[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", cls)}>
      {label}
    </span>
  );
}

interface LearningModeBadgeProps {
  mode: "online" | "offline" | "hybrid";
}

export function LearningModeBadge({ mode }: LearningModeBadgeProps) {
  const map = {
    online: { label: "Online", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    offline: { label: "Offline", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
    hybrid: { label: "Hybrid", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  };
  const { label, cls } = map[mode] || map.online;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", cls)}>
      {label}
    </span>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
