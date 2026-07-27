"use client";

import { useEffect, useState } from "react";
import type { Class } from "@/types";

export interface StudentContext {
  studentId: string;
  studentName: string;
  myClasses: Class[];
  assignedClassId: string;
  ready: boolean;
}

const EMPTY_CONTEXT: StudentContext = {
  studentId: "",
  studentName: "",
  myClasses: [],
  assignedClassId: "",
  ready: false,
};

export function useStudentContext(): StudentContext {
  const [context, setContext] = useState<StudentContext>(EMPTY_CONTEXT);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/context", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("student_context_unavailable");
        return response.json() as Promise<{
          role: string;
          studentId: string;
          studentName: string;
          classes: Class[];
          assignedClassId: string;
        }>;
      })
      .then((data) => {
        if (cancelled || data.role !== "student") return;
        setContext({
          studentId: data.studentId,
          studentName: data.studentName,
          myClasses: data.classes ?? [],
          assignedClassId: data.assignedClassId ?? "",
          ready: true,
        });
      })
      .catch(() => {
        if (!cancelled) setContext((current) => ({ ...current, ready: true }));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return context;
}
