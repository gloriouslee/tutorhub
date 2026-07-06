"use client";

import { useState, useEffect } from "react";
import { MOCK_CLASSES } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import { getClasses } from "@/lib/storage";

// Tìm lớp theo id trong dữ liệu thật (Supabase, gồm lớp admin tạo);
// fallback về MOCK_CLASSES khi offline.
async function findClassById(classId: string): Promise<typeof MOCK_CLASSES> {
  try {
    const all = await getClasses();
    const found = all.filter(c => c.id === classId);
    if (found.length > 0) return found as unknown as typeof MOCK_CLASSES;
  } catch { /* offline */ }
  return MOCK_CLASSES.filter(c => c.id === classId);
}

export interface StudentContext {
  studentId:       string;
  studentName:     string;
  myClasses:       typeof MOCK_CLASSES;
  assignedClassId: string;
  ready:           boolean;
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

const DEMO_ID   = "s1";
const DEMO_NAME = "Nguyễn Anh Tuấn";

export function useStudentContext(): StudentContext {
  const [ctx, setCtx] = useState<StudentContext>({
    studentId:       DEMO_ID,
    studentName:     DEMO_NAME,
    myClasses:       MOCK_CLASSES.filter(c => c.student_ids?.includes(DEMO_ID)),
    assignedClassId: "",
    ready:           false,
  });

  useEffect(() => {
    // Demo cookie takes priority — if admin set demo_role, use it directly
    // without checking Supabase session (which may hold a stale enrolled user).
    const demoRole = getCookie("demo_role");
    if (demoRole === "student") {
      // Could be a pure demo (no enrolled cookies) or old-style enrolled cookie
      const enrolledId    = getCookie("enrolled_student_id");
      const enrolledName  = getCookie("enrolled_student_name");
      const enrolledClass = getCookie("enrolled_student_class");
      if (enrolledId && enrolledName) {
        (async () => {
          setCtx({
            studentId:       enrolledId,
            studentName:     enrolledName,
            myClasses:       enrolledClass ? await findClassById(enrolledClass) : [],
            assignedClassId: enrolledClass,
            ready:           true,
          });
        })();
      } else {
        // Pure demo mode — keep default s1 context
        setCtx(prev => ({ ...prev, ready: true }));
      }
      return;
    }

    // No demo cookie — check real Supabase session (enrolled student login)
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const user = session.user;
        const meta = user.user_metadata ?? {};
        if (meta.role === "student") {
          const assignedClassId: string = meta.assigned_class_id ?? "";
          setCtx({
            // Ưu tiên: student_id (admin tạo thủ công) → enr_<id> (qua đơn đăng ký) → auth uuid
            studentId:       meta.student_id
              ?? (meta.enrollment_id ? `enr_${meta.enrollment_id}` : user.id),
            studentName:     meta.full_name ?? user.email ?? "Học viên",
            myClasses:       assignedClassId ? await findClassById(assignedClassId) : [],
            assignedClassId,
            ready:           true,
          });
          return;
        }
      }
      setCtx(prev => ({ ...prev, ready: true }));
    });
  }, []);

  return ctx;
}
