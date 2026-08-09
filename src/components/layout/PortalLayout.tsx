"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopNav from "@/components/layout/TopNav";
import { UserRole } from "@/types";
import { useAccountContext } from "@/hooks/useAccountContext";

const SIDEBAR_HIDDEN_KEY = "tutorhub_sidebar_hidden";

interface PortalLayoutProps {
  children: React.ReactNode;
  role: UserRole;
  userName: string;
  pageTitle: string;
}

export default function PortalLayout({ children, role, userName, pageTitle }: PortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const { context } = useAccountContext();
  const resolvedUserName =
    context?.role === "student"
      ? context.studentName
      : context?.role === "teacher"
        ? context.teacherName
        : context?.role === "parent"
          ? context.parentName
          : context?.displayName || userName;
  const resolvedAvatarUrl = context?.role === role ? context.avatarUrl : "";
  // Hộp thư của phụ huynh gồm sự kiện sinh từ dữ liệu của các con.
  const inboxChildren = context?.role === "parent" ? context.children : [];

  useEffect(() => {
    setSidebarHidden(localStorage.getItem(SIDEBAR_HIDDEN_KEY) === "1");
  }, []);

  function setDesktopSidebarHidden(hidden: boolean) {
    setSidebarHidden(hidden);
    localStorage.setItem(SIDEBAR_HIDDEN_KEY, hidden ? "1" : "0");
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        role={role}
        userName={resolvedUserName}
        avatarUrl={resolvedAvatarUrl}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        desktopHidden={sidebarHidden}
        onDesktopHide={() => setDesktopSidebarHidden(true)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav
          role={role}
          userName={resolvedUserName}
          avatarUrl={resolvedAvatarUrl}
          pageTitle={pageTitle}
          onMenuClick={() => setSidebarOpen(true)}
          sidebarHidden={sidebarHidden}
          onSidebarShow={() => setDesktopSidebarHidden(false)}
          inboxChildren={inboxChildren}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
