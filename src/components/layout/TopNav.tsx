"use client";

import { Bell, Menu, Moon, Search, Sun } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserRole } from "@/types";

interface TopNavProps {
  role: UserRole;
  userName: string;
  pageTitle: string;
  onMenuClick?: () => void;
  notificationCount?: number;
}

export default function TopNav({
  role,
  userName,
  pageTitle,
  onMenuClick,
  notificationCount = 0,
}: TopNavProps) {
  const [isDark, setIsDark] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  const toggleDark = () => {
    document.documentElement.classList.toggle("dark");
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center px-4 gap-4 sticky top-0 z-30">
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-xl hover:bg-accent text-muted-foreground transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Page title */}
      <div className="flex-1">
        <h1 className="text-base font-semibold text-foreground">{pageTitle}</h1>
      </div>

      {/* Search */}
      <div className={cn(
        "hidden md:flex items-center gap-2 bg-muted rounded-xl px-3 py-2 transition-all duration-200",
        searchOpen && "ring-2 ring-ring"
      )}>
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Search..."
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setSearchOpen(false)}
          className="bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground w-48"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          className="p-2 rounded-xl hover:bg-accent text-muted-foreground transition-colors"
          aria-label="Toggle dark mode"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-xl hover:bg-accent text-muted-foreground transition-colors">
          <Bell className="h-4 w-4" />
          {notificationCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-card animate-pulse-ring" />
          )}
        </button>

        {/* Avatar */}
        <div className="ml-1 flex items-center gap-2 pl-2 border-l border-border">
          <Avatar size="sm">
            <AvatarFallback name={userName} />
          </Avatar>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-foreground leading-none">{userName.split(" ")[0]}</p>
            <p className="text-[10px] text-muted-foreground capitalize leading-none mt-0.5">{role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
