"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Layers3, UserRound } from "lucide-react";
import type { Class } from "@/types";

export const ALL_STUDENT_SCOPE = "all";

export interface StudentWorkspaceScope {
  teacherId: string;
  classId: string;
}

function normalizeScope(classes: Class[], teacherId: string | null, classId: string | null): StudentWorkspaceScope {
  const selectedClass = classes.find((item) => item.id === classId);
  if (selectedClass) {
    return { teacherId: selectedClass.tutor_id, classId: selectedClass.id };
  }
  if (teacherId && classes.some((item) => item.tutor_id === teacherId)) {
    return { teacherId, classId: ALL_STUDENT_SCOPE };
  }
  return { teacherId: ALL_STUDENT_SCOPE, classId: ALL_STUDENT_SCOPE };
}

export function useStudentWorkspaceScope(classes: Class[]) {
  const router = useRouter();
  const pathname = usePathname();
  const classKey = classes.map((item) => `${item.id}:${item.tutor_id}`).join("|");
  const [scope, setScopeState] = useState<StudentWorkspaceScope>({
    teacherId: ALL_STUDENT_SCOPE,
    classId: ALL_STUDENT_SCOPE,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setScopeState(normalizeScope(classes, params.get("teacher"), params.get("class")));
    // classKey captures membership changes without depending on a new array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classKey]);

  function setScope(next: StudentWorkspaceScope) {
    const normalized = normalizeScope(classes, next.teacherId, next.classId);
    setScopeState(normalized);
    const params = new URLSearchParams(window.location.search);
    if (normalized.teacherId === ALL_STUDENT_SCOPE) params.delete("teacher");
    else params.set("teacher", normalized.teacherId);
    if (normalized.classId === ALL_STUDENT_SCOPE) params.delete("class");
    else params.set("class", normalized.classId);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return { scope, setScope };
}

export function classMatchesStudentScope(cls: Class | undefined, scope: StudentWorkspaceScope) {
  if (!cls) return false;
  if (scope.classId !== ALL_STUDENT_SCOPE) return cls.id === scope.classId;
  if (scope.teacherId !== ALL_STUDENT_SCOPE) return cls.tutor_id === scope.teacherId;
  return true;
}

export default function StudentScopeBar({
  classes,
  scope,
  onChange,
}: {
  classes: Class[];
  scope: StudentWorkspaceScope;
  onChange: (scope: StudentWorkspaceScope) => void;
}) {
  const teachers = useMemo(() => {
    const items = new Map<string, string>();
    classes.forEach((item) => items.set(item.tutor_id, item.tutor_name || "Giáo viên phụ trách"));
    return [...items.entries()].map(([id, name]) => ({ id, name }));
  }, [classes]);
  const visibleClasses = scope.teacherId === ALL_STUDENT_SCOPE
    ? classes
    : classes.filter((item) => item.tutor_id === scope.teacherId);

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4" aria-label="Phạm vi dữ liệu học tập">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3 lg:mr-auto">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Layers3 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Phạm vi học tập</p>
            <p className="truncate text-xs text-muted-foreground">Xem tổng hợp hoặc tập trung vào một giáo viên, một lớp.</p>
          </div>
        </div>

        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 lg:max-w-[280px]">
          <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="sr-only">Lọc theo giáo viên</span>
          <select
            value={scope.teacherId}
            onChange={(event) => onChange({ teacherId: event.target.value, classId: ALL_STUDENT_SCOPE })}
            className="h-10 min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none"
          >
            <option value={ALL_STUDENT_SCOPE}>Tất cả giáo viên</option>
            {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
          </select>
        </label>

        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 lg:max-w-[340px]">
          <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="sr-only">Lọc theo lớp</span>
          <select
            value={scope.classId}
            onChange={(event) => onChange({ teacherId: scope.teacherId, classId: event.target.value })}
            className="h-10 min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none"
          >
            <option value={ALL_STUDENT_SCOPE}>Tất cả lớp</option>
            {visibleClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.class_name} · {cls.tutor_name || "Giáo viên"}</option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
