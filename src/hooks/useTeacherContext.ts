"use client";

import { useEffect, useState } from "react";
import type { Class } from "@/types";

export interface TeacherContext {
  teacherId: string;
  teacherName: string;
  myClasses: Class[];
  ready: boolean;
}

const EMPTY_CONTEXT: TeacherContext = {
  teacherId: "",
  teacherName: "",
  myClasses: [],
  ready: false,
};

export function useTeacherContext(): TeacherContext {
  const [context, setContext] = useState<TeacherContext>(EMPTY_CONTEXT);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/context", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("teacher_context_unavailable");
        return response.json() as Promise<{
          role: string;
          teacherId: string;
          teacherName: string;
          classes: Class[];
        }>;
      })
      .then((data) => {
        if (cancelled || data.role !== "teacher") return;
        setContext({
          teacherId: data.teacherId,
          teacherName: data.teacherName,
          myClasses: data.classes ?? [],
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
