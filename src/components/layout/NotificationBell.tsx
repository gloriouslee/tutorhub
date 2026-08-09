"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  inboxPath,
  loadInbox,
  markInboxRead,
  type InboxItem,
} from "@/lib/notification-inbox";
import type { UserRole } from "@/types";

interface InboxChild {
  id: string;
  name: string;
  classes: { id: string; class_name: string }[];
}

/**
 * Hộp thư thông báo nằm ngay ở thanh trên, cạnh avatar — thay cho mục "Thông báo"
 * trong sidebar. Số liệu lấy từ cùng nguồn với trang thông báo đầy đủ, nên chấm
 * đỏ và danh sách ở đây luôn khớp với trang đó.
 */
export default function NotificationBell({
  role,
  parentChildren = [],
}: {
  role: UserRole;
  /** Không đặt tên là `children`: React coi prop đó là nội dung lồng trong thẻ. */
  parentChildren?: InboxChild[];
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  const childrenKey = parentChildren.map((child) => child.id).join(",");

  const refresh = useCallback(async () => {
    try {
      const inbox = await loadInbox(role, parentChildren);
      setItems(inbox.items);
      setUnread(inbox.unread);
    } finally {
      setLoading(false);
    }
    // children được so sánh qua childrenKey để không tải lại mỗi lần render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, childrenKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Đóng khi bấm ra ngoài hoặc nhấn Esc.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleMarkAllRead() {
    const previous = items;
    setItems(previous.map((item) => ({ ...item, isRead: true })));
    setUnread(0);
    try {
      await markInboxRead(previous);
    } catch {
      // Không ghi được thì trả lại trạng thái thật thay vì báo đã đọc nhầm.
      setItems(previous);
      setUnread(previous.filter((item) => !item.isRead).length);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unread > 0 ? `Thông báo (${unread} chưa đọc)` : "Thông báo"}
        aria-expanded={open}
        className="relative p-2 rounded-xl hover:bg-accent text-muted-foreground transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-card">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Thông báo</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-primary hover:underline"
              >
                Đánh dấu đã đọc
              </button>
            )}
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                <Bell className="mx-auto mb-2 h-8 w-8 opacity-20" />
                Chưa có thông báo nào.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.slice(0, 8).map((item) => (
                  <li
                    key={item.id}
                    className={`px-4 py-3 ${item.isRead ? "" : "bg-primary/5"}`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          item.isRead ? "bg-transparent" : "bg-primary"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {item.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {item.content}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground/70">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            href={inboxPath(role)}
            onClick={() => setOpen(false)}
            className="block border-t border-border px-4 py-3 text-center text-sm font-medium text-primary hover:bg-accent"
          >
            Xem tất cả thông báo
          </Link>
        </div>
      )}
    </div>
  );
}
