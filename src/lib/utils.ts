import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getAttendanceColor(status: string): string {
  switch (status) {
    case "present":
      return "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20";
    case "absent":
      return "text-red-600 bg-red-50 dark:bg-red-900/20";
    case "late":
      return "text-amber-600 bg-amber-50 dark:bg-amber-900/20";
    default:
      return "text-slate-600 bg-slate-50 dark:bg-slate-900/20";
  }
}

export function getPaymentStatusColor(status: string): string {
  switch (status) {
    case "paid":
      return "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20";
    case "pending":
      return "text-amber-600 bg-amber-50 dark:bg-amber-900/20";
    case "overdue":
      return "text-red-600 bg-red-50 dark:bg-red-900/20";
    default:
      return "text-slate-600 bg-slate-50 dark:bg-slate-900/20";
  }
}

export function getLearningModeColor(mode: string): string {
  switch (mode) {
    case "online":
      return "text-blue-600 bg-blue-50 dark:bg-blue-900/20";
    case "offline":
      return "text-violet-600 bg-violet-50 dark:bg-violet-900/20";
    case "hybrid":
      return "text-teal-600 bg-teal-50 dark:bg-teal-900/20";
    default:
      return "text-slate-600 bg-slate-50 dark:bg-slate-900/20";
  }
}
