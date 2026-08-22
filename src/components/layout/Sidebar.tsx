"use client";

import { useState, useEffect } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Send,
  BookOpen, Calendar, ClipboardList, GraduationCap,
  LayoutDashboard, User, LogOut,
  Users, DollarSign, Settings, BarChart3,
  CheckSquare, BookMarked, MessageSquare, X, Shield,
  Loader2, PanelLeftClose, UserRoundPlus,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/avatar";
import { UserRole } from "@/types";
import {
  resetAccountContextCache,
  useAccountContext,
} from "@/hooks/useAccountContext";
import { DEFAULT_PORTAL_BRANDING } from "@/lib/portal-branding";
import { cachedClientQuery, invalidateClientQueries } from "@/lib/client-query-cache";

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
    { label: "Bài tập",    href: "/student/homework",       icon: ClipboardList },
    { label: "Cộng đồng",   href: "/student/questions",      icon: Users },
    { label: "Tài liệu",   href: "/student/materials",      icon: BookMarked },
    { label: "Điểm & phân tích", href: "/student/scores",  icon: GraduationCap },
    { label: "Thanh toán", href: "/student/payments",       icon: DollarSign },
    { label: "Hồ sơ",      href: "/student/profile",        icon: User },
  ],
  parent: [
    { label: "Tổng quan",  href: "/parent",                 icon: LayoutDashboard },
    { label: "Con của tôi",href: "/parent/children",        icon: Users },
    { label: "Liên kết",   href: "/parent/invitations",     icon: UserRoundPlus },
    { label: "Lịch học",   href: "/parent/schedule",        icon: Calendar },
    { label: "Tiến độ",    href: "/parent/progress",        icon: BarChart3 },
    { label: "Chuyên cần", href: "/parent/attendance",      icon: CheckSquare },
    { label: "Thanh toán", href: "/parent/payments",        icon: DollarSign },
  ],
  teacher: [
    { label: "Tổng quan",  href: "/teacher",                icon: LayoutDashboard },
    { label: "Lớp của tôi",href: "/teacher/classes",        icon: BookOpen },
    { label: "Bài tập & chấm bài", href: "/teacher/homework", icon: ClipboardList },
    { label: "Điểm danh",  href: "/teacher/attendance",     icon: CheckSquare },
    { label: "Cộng đồng",   href: "/teacher/questions",      icon: Users },
    { label: "Tài liệu",   href: "/teacher/materials",      icon: BookMarked },
    { label: "Học viên",   href: "/teacher/students",       icon: Users },
    { label: "Xu hướng",   href: "/teacher/analytics",      icon: BarChart3 },
    { label: "Duyệt thu",  href: "/teacher/approvals",      icon: DollarSign },
    { label: "Tin tức",    href: "/teacher/announcements",  icon: MessageSquare },
    { label: "Cài đặt",    href: "/teacher/settings",       icon: Settings },
  ],
  admin: [
    { label: "Tổng quan",  href: "/admin",                  icon: LayoutDashboard },
    { label: "Học viên",   href: "/admin/students",         icon: GraduationCap },
    { label: "Giáo viên",  href: "/admin/teachers",         icon: Users },
    { label: "Lớp học",    href: "/admin/classes",          icon: BookOpen },
    { label: "Báo cáo",    href: "/admin/reports",          icon: BarChart3 },
    { label: "Gửi thông báo", href: "/admin/notifications", icon: Send },
    { label: "Tài khoản",  href: "/admin/users",            icon: Shield },
    { label: "Hồ sơ",      href: "/admin/profile",          icon: User },
    { label: "Công cụ",    href: "/admin/settings",         icon: Settings },
  ],
};

function SidebarLinkStatus() {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Đang mở
    </span>
  );
}

const roleConfig: Record<UserRole, { label: string; color: string; gradient: string }> = {
  student: { label: "Cổng Học Viên",  color: "text-indigo-600 dark:text-indigo-400", gradient: "from-indigo-500 to-purple-600" },
  parent:  { label: "Cổng Phụ Huynh", color: "text-teal-600  dark:text-teal-400",   gradient: "from-teal-500  to-emerald-600" },
  teacher: { label: "Cổng Giáo Viên", color: "text-amber-600 dark:text-amber-400",  gradient: "from-amber-500 to-orange-600" },
  admin:   { label: "Cổng Quản Trị",  color: "text-rose-600  dark:text-rose-400",   gradient: "from-rose-500  to-pink-600" },
};

// ── Badge computation ─────────────────────────────────────────────────────────

// Badge chuẩn hoá: mỗi số = đúng số liệu trang đích hiển thị.
// Thông báo không còn ở đây — chuông trên thanh trên tự đếm hộp thư của nó.
async function computeBadges(
  role: UserRole,
  sid: string,
  myClassIds: string[],
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  if (role === "student") {
    const questionSummaryPromise = fetch("/api/questions?summary=1", {
      cache: "no-store",
      credentials: "same-origin",
    }).catch(() => null);
    const [
      { getTeacherHomework, getHwSubmissions },
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

    const questionResponse = await questionSummaryPromise;
    if (questionResponse?.ok) {
      const summary = await questionResponse.json() as { count?: number };
      if ((summary.count ?? 0) > 0) {
        result["/student/questions"] = summary.count ?? 0;
      }
    }
  }

  if (role === "parent") {
    const invitationsPromise = fetch("/api/guardians?mine=1&status=pending", {
      cache: "no-store",
      credentials: "same-origin",
    }).catch(() => null);
    const invitationsResponse = await invitationsPromise;
    if (invitationsResponse?.ok) {
      const invitations = await invitationsResponse.json() as unknown[];
      if (invitations.length > 0) {
        result["/parent/invitations"] = invitations.length;
      }
    }
  }

  if (role === "teacher") {
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
  avatarUrl?: string;
  isOpen?: boolean;
  onClose?: () => void;
  desktopHidden?: boolean;
  onDesktopHide?: () => void;
}

export default function Sidebar({
  role,
  userName,
  avatarUrl,
  isOpen = true,
  onClose,
  desktopHidden = false,
  onDesktopHide,
}: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const config   = roleConfig[role];
  // Nhận diện đúng học viên hiện tại từ phiên đăng nhập Supabase.
  const { context: accountContext, ready: contextReady } = useAccountContext();
  // Danh sách con (chỉ dùng khi role = parent) — nguồn sự kiện thông báo
  const studentId = accountContext?.role === "student" ? accountContext.studentId : "";
  const myClasses = accountContext?.role === "student" ? accountContext.classes : [];
  const activeStudentClassId = role === "student"
    ? pathname.match(/^\/student\/classes\/([^/]+)/)?.[1]
    : undefined;
  const activeStudentTeacherId = activeStudentClassId
    ? myClasses.find((item) => item.id === activeStudentClassId)?.tutor_id
    : undefined;
  const portalBranding = accountContext?.role === "student"
    ? activeStudentTeacherId
      ? accountContext.teacherBrandings?.[activeStudentTeacherId] ?? accountContext.portalBranding
      : accountContext.portalBranding
    : accountContext?.role === "teacher"
      ? accountContext.portalBranding
      : DEFAULT_PORTAL_BRANDING;
  const [logoFailed, setLogoFailed] = useState(false);
  const portalLogoUrl = portalBranding.logoUrl;
  const hasTeacherBrandHeader = role === "teacher"
    || (role === "student" && Boolean(activeStudentTeacherId || portalBranding.teacherId));
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

  // Recompute on every navigation so badge clears when user visits the page
  useEffect(() => {
    if ((role === "student" || role === "parent") && !contextReady) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (
        pathname === "/student/homework"
        || pathname === "/student/questions"
        || pathname === "/parent/invitations"
        || pathname === "/teacher/classes"
        || pathname === "/teacher/questions"
      ) {
        invalidateClientQueries(`sidebar-badges:${role}:`);
      }
      const next = await cachedClientQuery(
        `sidebar-badges:${role}:${studentId}:${myClassKey}`,
        () => computeBadges(role, studentId, myClasses.map(c => c.id)),
        30_000,
      );
      if (!cancelled) setBadges(next);
    }, 100);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, pathname, studentId, contextReady, myClassKey]);

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
          "w-[260px] overflow-hidden",
          "transition-[transform,width] duration-300 ease-in-out",
          "lg:static lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full",
          desktopHidden
            ? "lg:w-0 lg:-translate-x-full lg:border-r-0"
            : "lg:w-[260px] lg:translate-x-0",
        )}
      >
        {/* Portal brand */}
        <div className={cn(
          "flex shrink-0 items-center justify-between border-b border-border",
          hasTeacherBrandHeader
            ? "min-h-24 bg-gradient-to-br from-primary/[0.09] via-card to-card px-4 py-4"
            : "h-16 px-5",
        )}>
          <Link
            href={homeHref}
            prefetch={false}
            onMouseEnter={() => router.prefetch(homeHref)}
            onFocus={() => router.prefetch(homeHref)}
            className={cn(
              "flex min-w-0 flex-1 items-center",
              hasTeacherBrandHeader ? "gap-3" : "gap-2.5",
            )}
          >
            <div className="relative shrink-0">
              {portalLogoUrl && !logoFailed ? (
                // A protected image proxy is used here; Next Image cannot forward
                // the signed-in browser session when optimizing the source.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={portalLogoUrl}
                  alt={`Logo ${portalBranding.name}`}
                  onError={() => setLogoFailed(true)}
                  className={cn(
                    "border border-border bg-white object-contain shadow-lg",
                    hasTeacherBrandHeader
                      ? "h-14 w-14 rounded-2xl p-1 ring-4 ring-primary/10"
                      : "h-8 w-8 rounded-xl",
                  )}
                />
              ) : (
                <div className={cn(
                  `flex items-center justify-center bg-gradient-to-br ${config.gradient} shadow-lg`,
                  hasTeacherBrandHeader ? "h-14 w-14 rounded-2xl ring-4 ring-primary/10" : "h-8 w-8 rounded-xl",
                )}>
                  <GraduationCap className={cn("text-white", hasTeacherBrandHeader ? "h-6 w-6" : "h-4 w-4")} />
                </div>
              )}
              {hasTeacherBrandHeader && portalLogoUrl && !logoFailed && (
                <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br ${config.gradient} ring-2 ring-card`} aria-hidden="true">
                  <GraduationCap className="h-2.5 w-2.5 text-white" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn(
                "font-bold text-foreground",
                hasTeacherBrandHeader
                  ? "line-clamp-2 text-[15px] leading-snug"
                  : "max-w-[155px] truncate text-sm leading-none",
              )}>
                {portalBranding.name}
              </p>
              <p className={cn(
                `font-semibold ${config.color}`,
                hasTeacherBrandHeader
                  ? "mt-1 text-[9px] uppercase leading-none tracking-[0.14em]"
                  : "mt-0.5 text-[10px] leading-none",
              )}>{config.label}</p>
            </div>
          </Link>
          <div className={cn("flex items-center gap-1", hasTeacherBrandHeader && "ml-1 self-start")}>
            <button
              type="button"
              onClick={onDesktopHide}
              aria-label="Ẩn thanh bên"
              title="Ẩn thanh bên"
              className="hidden lg:inline-flex p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng menu"
              className="lg:hidden p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
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
                prefetch={item.href.endsWith("/homework") ? null : false}
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
                <SidebarLinkStatus />
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
            <UserAvatar size="sm" name={userName} src={avatarUrl} />
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
