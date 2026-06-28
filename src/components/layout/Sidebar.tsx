"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BookOpen, Calendar, ClipboardList, GraduationCap,
  LayoutDashboard, Bell, User, LogOut, ChevronLeft,
  Users, DollarSign, Settings, BarChart3, FileText,
  CheckSquare, BookMarked, MessageSquare, Home, X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserRole } from "@/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

const navConfig: Record<UserRole, NavItem[]> = {
  student: [
    { label: "Tổng quan", href: "/student", icon: LayoutDashboard },
    { label: "Lớp của tôi", href: "/student/classes", icon: BookOpen },
    { label: "Lịch học", href: "/student/schedule", icon: Calendar },
    { label: "Bài tập", href: "/student/homework", icon: ClipboardList, badge: 2 },
    { label: "Chuyên cần", href: "/student/attendance", icon: CheckSquare },
    { label: "Điểm thi", href: "/student/scores", icon: GraduationCap },
    { label: "Tài liệu", href: "/student/materials", icon: BookMarked },
    { label: "Thanh toán", href: "/student/payments", icon: DollarSign },
    { label: "Thông báo", href: "/student/notifications", icon: Bell, badge: 3 },
    { label: "Hồ sơ", href: "/student/profile", icon: User },
  ],
  parent: [
    { label: "Tổng quan", href: "/parent", icon: LayoutDashboard },
    { label: "Con của tôi", href: "/parent/children", icon: Users },
    { label: "Lịch học", href: "/parent/schedule", icon: Calendar },
    { label: "Chuyên cần", href: "/parent/attendance", icon: CheckSquare },
    { label: "Thanh toán", href: "/parent/payments", icon: DollarSign },
    { label: "Tiến độ", href: "/parent/progress", icon: BarChart3 },
    { label: "Thông báo", href: "/parent/notifications", icon: Bell, badge: 2 },
  ],
  teacher: [
    { label: "Tổng quan", href: "/teacher", icon: LayoutDashboard },
    { label: "Lớp của tôi", href: "/teacher/classes", icon: BookOpen },
    { label: "Chuyên cần", href: "/teacher/attendance", icon: CheckSquare },
    { label: "Bài tập", href: "/teacher/homework", icon: ClipboardList },
    { label: "Bài nộp", href: "/teacher/submissions", icon: FileText },
    { label: "Tài liệu", href: "/teacher/materials", icon: BookMarked },
    { label: "Học viên", href: "/teacher/students", icon: Users },
    { label: "Tin tức", href: "/teacher/announcements", icon: MessageSquare },
    { label: "Thông báo", href: "/teacher/notifications", icon: Bell, badge: 1 },
  ],
  admin: [
    { label: "Tổng quan", href: "/admin", icon: LayoutDashboard },
    { label: "Học viên", href: "/admin/students", icon: GraduationCap },
    { label: "Giáo viên", href: "/admin/teachers", icon: Users },
    { label: "Lớp học", href: "/admin/classes", icon: BookOpen },
    { label: "Tài liệu", href: "/admin/materials", icon: BookMarked },
    { label: "Chuyên cần", href: "/admin/attendance", icon: CheckSquare },
    { label: "Thanh toán", href: "/admin/payments", icon: DollarSign },
    { label: "Báo cáo", href: "/admin/reports", icon: BarChart3 },
    { label: "Thông báo", href: "/admin/notifications", icon: Bell },
    { label: "Cài đặt", href: "/admin/settings", icon: Settings },
  ],
};

const roleConfig: Record<UserRole, { label: string; color: string; gradient: string }> = {
  student: { label: "Cổng Học Viên", color: "text-indigo-600 dark:text-indigo-400", gradient: "from-indigo-500 to-purple-600" },
  parent: { label: "Cổng Phụ Huynh", color: "text-teal-600 dark:text-teal-400", gradient: "from-teal-500 to-emerald-600" },
  teacher: { label: "Cổng Giáo Viên", color: "text-amber-600 dark:text-amber-400", gradient: "from-amber-500 to-orange-600" },
  admin: { label: "Cổng Quản Trị", color: "text-rose-600 dark:text-rose-400", gradient: "from-rose-500 to-pink-600" },
};

interface SidebarProps {
  role: UserRole;
  userName: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ role, userName, isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const items = navConfig[role];
  const config = roleConfig[role];

  const handleLogout = () => {
    document.cookie = "demo_role=; path=/; max-age=0";
    router.push("/login");
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full flex flex-col",
          "bg-card border-r border-border",
          "transition-transform duration-300 ease-in-out",
          "lg:translate-x-0 lg:static lg:z-auto",
          "w-[260px]",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-border shrink-0">
          <Link href={`/${role}`} className="flex items-center gap-2.5">
            <div className={`h-8 w-8 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg`}>
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-none">TutorHub</p>
              <p className={`text-[10px] font-medium ${config.color} leading-none mt-0.5`}>{config.label}</p>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {items.map((item) => {
            const isActive = pathname === item.href || (item.href !== `/${role}` && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn("sidebar-item group", isActive && "active")}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <span className={cn(
                    "ml-auto text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1",
                    isActive
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground group-hover:bg-accent-foreground/10"
                  )}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-border p-3 shrink-0">
          <div 
            onClick={handleLogout}
            className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-accent transition-colors cursor-pointer group"
          >
            <Avatar size="sm">
              <AvatarFallback name={userName} />
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{userName}</p>
              <p className="text-[11px] text-muted-foreground capitalize">
                {role === "student" ? "Học viên" : role === "parent" ? "Phụ huynh" : role === "teacher" ? "Giáo viên" : "Quản trị viên"}
              </p>
            </div>
            <LogOut className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </div>
        </div>
      </aside>
    </>
  );
}
