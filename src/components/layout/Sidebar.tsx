"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BookOpen, Calendar, ClipboardList, GraduationCap,
  LayoutDashboard, Bell, User, LogOut,
  Users, DollarSign, Settings, BarChart3, FileText,
  CheckSquare, BookMarked, MessageSquare, CircleHelp, X, Shield,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserRole } from "@/types";
import {
  resetAccountContextCache,
  useAccountContext,
  type ParentChild,
} from "@/hooks/useAccountContext";
import { DEFAULT_PORTAL_BRANDING } from "@/lib/portal-branding";

// ── Nav config (no static badges) ────────────────────────────────────────────
interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navConfig: Record<UserRole, NavItem[]> = {
  student: [
    { label: "Tổng quan",  href: "/student",               icon: LayoutDashboard },
    { label: "Lớp của tôi",href: "/student/classes",        icon: BookOpen },
    { label: "Lịch học",   href: "/student/schedule",       icon: Calendar },
    { label: "Bài tập",    href: "/student/homework",       icon: ClipboardList },
    { label: "Hỏi đáp",     href: "/student/questions",      icon: CircleHelp },
    { label: "Tài liệu",   href: "/student/materials",      icon: BookMarked },
    { label: "Điểm thi",   href: "/student/scores",         icon: GraduationCap },
    { label: "Thanh toán", href: "/student/payments",       icon: DollarSign },
    { label: "Thông báo",  href: "/student/notifications",  icon: Bell },
    { label: "Hồ sơ",      href: "/student/profile",        icon: User },
  ],
  parent: [
    { label: "Tổng quan",  href: "/parent",                 icon: LayoutDashboard },
    { label: "Con của tôi",href: "/parent/children",        icon: Users },
    { label: "Lịch học",   href: "/parent/schedule",        icon: Calendar },
    { label: "Tiến độ",    href: "/parent/progress",        icon: BarChart3 },
    { label: "Chuyên cần", href: "/parent/attendance",      icon: CheckSquare },
    { label: "Thanh toán", href: "/parent/payments",        icon: DollarSign },
    { label: "Thông báo",  href: "/parent/notifications",   icon: Bell },
  ],
  teacher: [
    { label: "Tổng quan",  href: "/teacher",                icon: LayoutDashboard },
    { label: "Lớp của tôi",href: "/teacher/classes",        icon: BookOpen },
    { label: "Bài tập",    href: "/teacher/homework",       icon: ClipboardList },
    { label: "Điểm danh",  href: "/teacher/attendance",     icon: CheckSquare },
    { label: "Bài nộp",    href: "/teacher/submissions",    icon: FileText },
    { label: "Hỏi đáp",     href: "/teacher/questions",      icon: CircleHelp },
    { label: "Tài liệu",   href: "/teacher/materials",      icon: BookMarked },
    { label: "Học viên",   href: "/teacher/students",       icon: Users },
    { label: "Xu hướng",   href: "/teacher/analytics",      icon: BarChart3 },
    { label: "Duyệt thu",  href: "/teacher/approvals",      icon: DollarSign },
    { label: "Tin tức",    href: "/teacher/announcements",  icon: MessageSquare },
    { label: "Thông báo",  href: "/teacher/notifications",  icon: Bell },
    { label: "Cài đặt",    href: "/teacher/settings",       icon: Settings },
  ],
  admin: [
    { label: "Tổng quan",  href: "/admin",                  icon: LayoutDashboard },
    { label: "Học viên",   href: "/admin/students",         icon: GraduationCap },
    { label: "Giáo viên",  href: "/admin/teachers",         icon: Users },
    { label: "Lớp học",    href: "/admin/classes",          icon: BookOpen },
    { label: "Báo cáo",    href: "/admin/reports",          icon: BarChart3 },
    { label: "Thông báo",  href: "/admin/notifications",    icon: Bell },
    { label: "Tài khoản",  href: "/admin/users",            icon: Shield },
    { label: "Hồ sơ",      href: "/admin/profile",          icon: User },
    { label: "Công cụ",    href: "/admin/settings",         icon: Settings },
  ],
};

const roleConfig: Record<UserRole, { label: string; color: string; gradient: string }> = {
  student: { label: "Cổng Học Viên",  color: "text-indigo-600 dark:text-indigo-400", gradient: "from-indigo-500 to-purple-600" },
  parent:  { label: "Cổng Phụ Huynh", color: "text-teal-600  dark:text-teal-400",   gradient: "from-teal-500  to-emerald-600" },
  teacher: { label: "Cổng Giáo Viên", color: "text-amber-600 dark:text-amber-400",  gradient: "from-amber-500 to-orange-600" },
  admin:   { label: "Cổng Quản Trị",  color: "text-rose-600  dark:text-rose-400",   gradient: "from-rose-500  to-pink-600" },
};

// ── Badge computation ─────────────────────────────────────────────────────────
function ls(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function parseSet(key: string): Set<string> {
  try { return new Set(JSON.parse(ls(key) ?? "[]")); } catch { return new Set(); }
}

// Đếm thông báo chưa đọc theo ĐÚNG logic trang thông báo của từng role:
// nguồn getNotifications() + trừ các thông báo đã đọc/đã xóa trong cache cục bộ.
async function unreadBroadcasts(
  targetRole: "student" | "parent" | "teacher",
  readKey: string,
  deletedKey: string
): Promise<{ unread: number; readIds: Set<string>; deletedIds: Set<string> }> {
  const readIds    = parseSet(readKey);
  const deletedIds = parseSet(deletedKey);
  const { getNotifications, getNotificationStates } = await import("@/lib/storage");
  if (targetRole === "teacher") {
    const states = await getNotificationStates().catch(() => ({}));
    for (const [id, state] of Object.entries(states)) {
      readIds.add(id);
      if (state.isDeleted) deletedIds.add(id);
    }
  }
  const all = await getNotifications();
  const unread = all.filter(n =>
    (n.target_role === targetRole || n.target_role === "all")
    && !deletedIds.has(n.id)
    && !n.is_read
    && !readIds.has(n.id)
  ).length;
  return { unread, readIds, deletedIds };
}

// Badge chuẩn hoá: mỗi số = đúng số liệu trang đích hiển thị
// (student/teacher/parent: thông báo chưa đọc + bài tập chưa nộp;
//  admin: số mục đang chờ xử lý ở từng hàng đợi).
async function computeBadges(
  role: UserRole,
  sid: string,
  myClassIds: string[],
  parentChildren: ParentChild[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  if (role === "student") {
    const questionSummaryPromise = fetch("/api/questions?summary=1", {
      cache: "no-store",
      credentials: "same-origin",
    }).catch(() => null);
    const [
      { getTeacherHomework, getHwSubmissions, getScheduleNotifications },
      { getSubmissionsByStudent },
    ] = await Promise.all([
      import("@/lib/storage"),
      import("@/lib/supabase/submissions"),
    ]);
    // Bài tập "Chưa nộp" — cùng nguồn với trang bài tập: homework giáo viên tạo
    // Trừ các bài đã nộp (Supabase → local fallback).
    const teacherHw = (await getTeacherHomework<{ id: string; class_id: string }>(myClassIds))
      .filter(h => myClassIds.includes(h.class_id));
    const myHw = teacherHw;
    let subs = await getSubmissionsByStudent(sid).catch(() => []);
    if (subs.length === 0) {
      const local = await getHwSubmissions<{ homework_id: string; student_id: string }>({
        studentIds: [sid],
      });
      subs = local.filter(s => s.student_id === sid) as typeof subs;
    }
    const submittedIds = new Set(subs.map(s => s.homework_id));
    const pending = myHw.filter(h => !submittedIds.has(h.id)).length;
    if (pending > 0) result["/student/homework"] = pending;

    // Thông báo: broadcast + thông báo lịch học (cùng cách trang thông báo đếm)
    const { unread, readIds, deletedIds } = await unreadBroadcasts("student", "tutorhub_notif_read", "tutorhub_notif_deleted");
    const scheduleNotifs = await getScheduleNotifications().catch(() => [] as { id: string; is_read: boolean }[]);
    const schedUnread = scheduleNotifs.filter(n => !deletedIds.has(n.id) && !n.is_read && !readIds.has(n.id)).length;
    const totalUnread = unread + schedUnread;
    if (totalUnread > 0) result["/student/notifications"] = totalUnread;

    const questionResponse = await questionSummaryPromise;
    if (questionResponse?.ok) {
      const summary = await questionResponse.json() as { count?: number };
      if ((summary.count ?? 0) > 0) {
        result["/student/questions"] = summary.count ?? 0;
      }
    }
  }

  if (role === "parent") {
    const { loadParentEventNotifications } = await import("@/lib/parent-data");
    // Broadcast + sự kiện sinh từ dữ liệu thật của các con — khớp trang thông báo
    const { unread, readIds, deletedIds } = await unreadBroadcasts("parent", "tutorhub_parent_notif_read", "tutorhub_parent_notif_deleted");
    const events = await loadParentEventNotifications(parentChildren).catch(() => []);
    const eventUnread = events.filter(n => !deletedIds.has(n.id) && !readIds.has(n.id)).length;
    const total = unread + eventUnread;
    if (total > 0) result["/parent/notifications"] = total;
  }

  if (role === "teacher") {
    const { unread } = await unreadBroadcasts("teacher", "tutorhub_teacher_notif_read", "tutorhub_teacher_notif_deleted");
    if (unread > 0) result["/teacher/notifications"] = unread;
    const [registrationResponse, questionResponse] = await Promise.all([
      fetch(
        "/api/class-registration-requests?status=pending",
        { cache: "no-store", credentials: "same-origin" },
      ).catch(() => null),
      fetch("/api/questions?summary=1", {
        cache: "no-store",
        credentials: "same-origin",
      }).catch(() => null),
    ]);
    if (registrationResponse?.ok) {
      const registrations = await registrationResponse.json() as unknown[];
      if (registrations.length > 0) {
        result["/teacher/classes"] = registrations.length;
      }
    }
    if (questionResponse?.ok) {
      const summary = await questionResponse.json() as { count?: number };
      if ((summary.count ?? 0) > 0) {
        result["/teacher/questions"] = summary.count ?? 0;
      }
    }
  }

  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface SidebarProps {
  role: UserRole;
  userName: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ role, userName, isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const config   = roleConfig[role];
  // Nhận diện đúng học viên hiện tại từ phiên đăng nhập Supabase.
  const { context: accountContext, ready: contextReady } = useAccountContext();
  // Danh sách con (chỉ dùng khi role = parent) — nguồn sự kiện thông báo
  const studentId = accountContext?.role === "student" ? accountContext.studentId : "";
  const myClasses = accountContext?.role === "student" ? accountContext.classes : [];
  const parentChildren = accountContext?.role === "parent" ? accountContext.children : [];
  const portalBranding =
    accountContext?.role === "student" || accountContext?.role === "teacher"
      ? accountContext.portalBranding
      : DEFAULT_PORTAL_BRANDING;
  const [logoFailed, setLogoFailed] = useState(false);
  const portalLogoUrl = portalBranding.logoUrl;
  const isCatalogOnlyStudent =
    role === "student"
    && (
      !contextReady
      || accountContext?.role !== "student"
      || myClasses.length === 0
    );
  const items = isCatalogOnlyStudent
    ? navConfig.student.filter((item) =>
        item.href === "/student/classes" || item.href === "/student/materials",
      )
    : navConfig[role];
  const homeHref = isCatalogOnlyStudent ? "/student/classes" : `/${role}`;

  const [badges, setBadges] = useState<Record<string, number>>({});

  const myClassKey  = myClasses.map(c => c.id).join(",");
  const childrenKey = parentChildren.map(c => c.id).join(",");

  // Recompute on every navigation so badge clears when user visits the page
  useEffect(() => {
    if ((role === "student" || role === "parent") && !contextReady) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const next = await computeBadges(role, studentId, myClasses.map(c => c.id), parentChildren);
      if (!cancelled) setBadges(next);
    }, 100);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, pathname, studentId, contextReady, myClassKey, childrenKey]);

  useEffect(() => {
    setLogoFailed(false);
  }, [portalLogoUrl]);

  const handleLogout = async () => {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      await createClient().auth.signOut();
    } catch {}
    resetAccountContextCache();
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
          <Link
            href={homeHref}
            prefetch={false}
            onMouseEnter={() => router.prefetch(homeHref)}
            onFocus={() => router.prefetch(homeHref)}
            className="flex items-center gap-2.5"
          >
            {portalLogoUrl && !logoFailed ? (
              // A protected image proxy is used here; Next Image cannot forward
              // the signed-in browser session when optimizing the source.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={portalLogoUrl}
                alt={`Logo ${portalBranding.name}`}
                onError={() => setLogoFailed(true)}
                className="h-8 w-8 rounded-xl border border-border bg-white object-contain shadow-lg"
              />
            ) : (
              <div className={`h-8 w-8 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg`}>
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
            )}
            <div>
              <p className="max-w-[155px] truncate text-sm font-bold text-foreground leading-none">
                {portalBranding.name}
              </p>
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
          {items.map(item => {
            const isActive = pathname === item.href
              || (item.href !== `/${role}` && pathname.startsWith(item.href));
            const badge = badges[item.href];
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onMouseEnter={() => {
                  if (!isActive) router.prefetch(item.href);
                }}
                onFocus={() => {
                  if (!isActive) router.prefetch(item.href);
                }}
                onClick={onClose}
                className={cn("sidebar-item group", isActive && "active")}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {badge != null && badge > 0 && (
                  <span className={cn(
                    "ml-auto text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1",
                    isActive
                      ? "bg-primary/20 text-primary"
                      : "bg-primary text-primary-foreground"
                  )}>
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User */}
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
