"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopNav from "@/components/layout/TopNav";
import { UserRole } from "@/types";
import { useAccountContext } from "@/hooks/useAccountContext";

interface PortalLayoutProps {
  children: React.ReactNode;
  role: UserRole;
  userName: string;
  pageTitle: string;
}

export default function PortalLayout({ children, role, userName, pageTitle }: PortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { context } = useAccountContext();
  const resolvedUserName =
    context?.role === "student"
      ? context.studentName
      : context?.role === "teacher"
        ? context.teacherName
        : context?.role === "parent"
          ? context.parentName
          : context?.displayName || userName;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        role={role}
        userName={resolvedUserName}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav
          role={role}
          userName={resolvedUserName}
          pageTitle={pageTitle}
          onMenuClick={() => setSidebarOpen(true)}
          notificationCount={0}
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
