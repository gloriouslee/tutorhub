import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: { value: number; label: string; positive?: boolean };
  className?: string;
  delay?: number;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-accent",
  trend,
  className,
  delay = 0,
}: StatCardProps) {
  return (
    <Card
      className={cn("stat-card animate-fade-in", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
              {title}
            </p>
            <p className="text-2xl font-bold text-foreground mt-1 leading-none">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                <span
                  className={cn(
                    "text-xs font-semibold",
                    trend.positive !== false ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                  )}
                >
                  {trend.positive !== false ? "↑" : "↓"} {Math.abs(trend.value)}%
                </span>
                <span className="text-xs text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ml-3", iconBg)}>
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
