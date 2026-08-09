"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface SortableDrag {
  /** Định danh danh sách anh em đang kéo, VD "chapters" hay "lessons:ch1:s2". */
  group: string;
  from: number;
  over: number;
}

/**
 * Kéo–thả sắp xếp bằng Pointer Events.
 *
 * Không dùng HTML5 drag-and-drop vì nó không chạy trên cảm ứng — mà phần lớn
 * thao tác nhanh trên lộ trình lại diễn ra trên điện thoại. Pointer Events phủ
 * cả chuột, cảm ứng và bút bằng một đường mã duy nhất.
 *
 * Mỗi phần tử kéo được cần gắn `data-sortable-group` và `data-sortable-index`;
 * vị trí thả được suy ra từ phần tử nằm dưới con trỏ, nên không cần đo tọa độ.
 */
export function useSortable(
  onReorder: (group: string, from: number, to: number) => void,
) {
  const [drag, setDrag] = useState<SortableDrag | null>(null);
  const dragRef = useRef<SortableDrag | null>(null);
  dragRef.current = drag;

  const start = useCallback(
    (group: string, index: number) => (event: React.PointerEvent) => {
      // Chỉ chuột trái; chạm và bút thì luôn nhận.
      if (event.pointerType === "mouse" && event.button !== 0) return;
      // Chặn cuộn trang khi kéo trên cảm ứng, và chặn bôi đen khi kéo bằng chuột.
      event.preventDefault();
      event.stopPropagation();
      setDrag({ group, from: index, over: index });
    },
    [],
  );

  const active = drag !== null;

  useEffect(() => {
    if (!active) return;

    function handleMove(event: PointerEvent) {
      const current = dragRef.current;
      if (!current) return;
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const row = element?.closest<HTMLElement>("[data-sortable-group]");
      if (!row || row.dataset.sortableGroup !== current.group) return;
      const index = Number(row.dataset.sortableIndex);
      if (Number.isNaN(index) || index === current.over) return;
      setDrag({ ...current, over: index });
    }

    function finish() {
      const current = dragRef.current;
      setDrag(null);
      if (current && current.from !== current.over) {
        onReorder(current.group, current.from, current.over);
      }
    }

    function handleKey(event: KeyboardEvent) {
      // Esc huỷ kéo, giữ nguyên thứ tự cũ.
      if (event.key !== "Escape") return;
      dragRef.current = null;
      setDrag(null);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("keydown", handleKey);
    // Trong lúc kéo, con trỏ giữ nguyên hình bàn tay dù đang ở trên phần tử nào.
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("keydown", handleKey);
      document.body.style.cursor = previousCursor;
    };
  }, [active, onReorder]);

  /** Thuộc tính gắn lên phần tử kéo được. */
  const itemProps = useCallback(
    (group: string, index: number) => ({
      "data-sortable-group": group,
      "data-sortable-index": index,
    }),
    [],
  );

  /** Lớp CSS phản hồi trạng thái kéo: mờ phần đang cầm, kẻ vạch nơi sắp thả. */
  const itemClass = useCallback(
    (group: string, index: number) => {
      if (!drag || drag.group !== group) return "";
      if (drag.from === index) return "opacity-40";
      if (drag.over !== index) return "";
      return drag.over > drag.from
        ? "border-b-2 border-b-primary"
        : "border-t-2 border-t-primary";
    },
    [drag],
  );

  return { drag, start, itemProps, itemClass };
}

/** Chuyển phần tử tới vị trí mới (chèn vào, không hoán đổi). */
export function arrayMove<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
