"use client";

import { useState, useEffect } from "react";
import { MOCK_STUDENTS, MOCK_CLASSES } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import { getClasses } from "@/lib/storage";

// ─────────────────────────────────────────────────────────────────────────────
// Parent context — mirror useStudentContext: xác định phụ huynh + danh sách con,
// và resolve lớp của từng con từ dữ liệu THẬT (Supabase, gồm lớp admin tạo),
// fallback MOCK_CLASSES khi offline.
//
// Demo mode (cookie demo_role=parent): phụ huynh p1 với các con theo roster mock,
// nhưng lớp/điểm danh/điểm thi của các con vẫn đọc từ nguồn thật (parent-data.ts).
// Khi có tài khoản phụ huynh thật (Supabase Auth, role="parent"), lấy danh tính
// từ metadata; children_ids trong metadata (nếu admin gán) sẽ thay roster mock.
// ─────────────────────────────────────────────────────────────────────────────

export interface ParentChild {
  id:      string;
  name:    string;
  grade?:  string;
  school?: string;
  /** Lớp con đang học — từ getClasses() thật (student_ids), merge mock. */
  classes: typeof MOCK_CLASSES;
}

export interface ParentContext {
  parentId:   string;
  parentName: string;
  children:   ParentChild[];
  ready:      boolean;
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

const DEMO_PARENT_ID   = "p1";
const DEMO_PARENT_NAME = "Trần Văn Minh";

// Lớp của một học sinh: ưu tiên dữ liệu thật (bao gồm lớp admin tạo), merge mock.
async function classesOfStudent(studentId: string): Promise<typeof MOCK_CLASSES> {
  const mockClasses = MOCK_CLASSES.filter(c => c.student_ids?.includes(studentId));
  try {
    const all = await getClasses();
    const real = all.filter(c => (c as { student_ids?: string[] }).student_ids?.includes(studentId));
    if (real.length > 0) {
      // Merge: lớp thật thắng khi trùng id, giữ thêm lớp mock chưa có bản thật
      const realIds = new Set(real.map(c => c.id));
      return [...real, ...mockClasses.filter(c => !realIds.has(c.id))] as unknown as typeof MOCK_CLASSES;
    }
  } catch { /* offline → mock */ }
  return mockClasses;
}

async function buildChildren(ids: { id: string; name: string; grade?: string; school?: string }[]): Promise<ParentChild[]> {
  return Promise.all(ids.map(async c => ({ ...c, classes: await classesOfStudent(c.id) })));
}

function demoRoster(parentId: string) {
  return MOCK_STUDENTS
    .filter(s => s.parent_id === parentId)
    .map(s => ({ id: s.id, name: s.full_name, grade: s.grade, school: s.school }));
}

export function useParentContext(): ParentContext {
  const [ctx, setCtx] = useState<ParentContext>({
    parentId:   DEMO_PARENT_ID,
    parentName: DEMO_PARENT_NAME,
    children:   [],
    ready:      false,
  });

  useEffect(() => {
    (async () => {
      // Demo cookie ưu tiên — giống useStudentContext
      const demoRole = getCookie("demo_role");
      if (demoRole === "parent") {
        setCtx({
          parentId:   DEMO_PARENT_ID,
          parentName: DEMO_PARENT_NAME,
          children:   await buildChildren(demoRoster(DEMO_PARENT_ID)),
          ready:      true,
        });
        return;
      }

      // Phiên Supabase thật (tài khoản phụ huynh admin tạo)
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const meta = session?.user?.user_metadata ?? {};
        if (session?.user && meta.role === "parent") {
          // children_ids: string[] — admin gán khi tạo tài khoản phụ huynh.
          // Chưa gán → dùng roster demo để trang không trống.
          const childIds: string[] = Array.isArray(meta.children_ids) ? meta.children_ids : [];
          const roster = childIds.length > 0
            ? childIds.map(id => {
                const mock = MOCK_STUDENTS.find(s => s.id === id);
                return { id, name: mock?.full_name ?? `Học viên ${id}`, grade: mock?.grade, school: mock?.school };
              })
            : demoRoster(DEMO_PARENT_ID);
          setCtx({
            parentId:   session.user.id,
            parentName: meta.full_name ?? session.user.email ?? "Phụ huynh",
            children:   await buildChildren(roster),
            ready:      true,
          });
          return;
        }
      } catch { /* offline */ }

      // Không có phiên nào → demo mặc định
      setCtx({
        parentId:   DEMO_PARENT_ID,
        parentName: DEMO_PARENT_NAME,
        children:   await buildChildren(demoRoster(DEMO_PARENT_ID)),
        ready:      true,
      });
    })();
  }, []);

  return ctx;
}
