import {
  getNotifications,
  getNotificationStates,
  getScheduleNotifications,
  markNotificationState,
  markNotificationsRead,
} from "@/lib/storage";
import type { UserRole } from "@/types";

export interface InboxItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  /** Chỉ thông báo broadcast mới ghi được trạng thái đã đọc lên server. */
  broadcast: boolean;
}

interface InboxChild {
  id: string;
  name: string;
  classes: { id: string; class_name: string }[];
}

/**
 * Hộp thư "đã nhận" của một portal.
 *
 * Gom đúng những nguồn mà trang thông báo của từng role vẫn hiển thị, để chuông
 * ở thanh trên và trang đầy đủ không bao giờ lệch số:
 *   - mọi role : thông báo broadcast gửi cho role đó hoặc cho "all"
 *   - student  : kèm thông báo đổi lịch của các lớp đang học
 *   - parent   : kèm sự kiện sinh ra từ dữ liệu thật của các con
 * Thông báo đã xoá (state.isDeleted) bị loại ở mọi nguồn.
 */
export async function loadInbox(
  role: UserRole,
  children: InboxChild[] = [],
): Promise<{ items: InboxItem[]; unread: number }> {
  const [all, states] = await Promise.all([
    getNotifications().catch(() => []),
    getNotificationStates().catch(() => ({} as Record<string, { isDeleted: boolean }>)),
  ]);

  const isDeleted = (id: string) => states[id]?.isDeleted === true;
  // Có bản ghi trạng thái nghĩa là người dùng đã mở thông báo đó.
  const isRead = (id: string, flag: boolean) => flag || Boolean(states[id]);

  const items: InboxItem[] = all
    .filter((n) => n.target_role === role || n.target_role === "all")
    .filter((n) => !isDeleted(n.id))
    .map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      createdAt: n.created_at,
      isRead: isRead(n.id, n.is_read),
      broadcast: true,
    }));

  if (role === "student") {
    const schedule = await getScheduleNotifications().catch(() => []);
    schedule
      .filter((n) => !isDeleted(n.id))
      .forEach((n) =>
        items.push({
          id: n.id,
          title: `Thay đổi lịch: ${n.class_name}`,
          content: n.message,
          createdAt: n.created_at,
          isRead: isRead(n.id, n.is_read),
          broadcast: false,
        }),
      );
  }

  if (role === "parent" && children.length > 0) {
    const { loadParentEventNotifications } = await import("@/lib/parent-data");
    const events = await loadParentEventNotifications(children).catch(() => []);
    events
      .filter((n) => !isDeleted(n.id))
      .forEach((n) =>
        items.push({
          id: n.id,
          title: n.title,
          content: n.content,
          createdAt: n.created_at,
          isRead: isRead(n.id, n.is_read),
          broadcast: false,
        }),
      );
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items, unread: items.filter((item) => !item.isRead).length };
}

/** Đánh dấu đã đọc theo đúng cách trang thông báo làm, để hai nơi không lệch. */
export async function markInboxRead(items: readonly InboxItem[]): Promise<void> {
  const unread = items.filter((item) => !item.isRead);
  if (unread.length === 0) return;
  const broadcastIds = unread.filter((item) => item.broadcast).map((item) => item.id);
  await Promise.all([
    broadcastIds.length > 0
      ? markNotificationsRead(broadcastIds)
      : Promise.resolve(),
    ...unread.map((item) => markNotificationState(item.id)),
  ]);
}

export function inboxPath(role: UserRole): string {
  return role === "admin" ? "/admin/notifications" : `/${role}/notifications`;
}
