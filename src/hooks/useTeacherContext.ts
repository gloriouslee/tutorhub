import type { Class } from "@/types";
import { useAccountContext } from "@/hooks/useAccountContext";

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
  const { context, ready } = useAccountContext();
  if (context?.role !== "teacher") return { ...EMPTY_CONTEXT, ready };

  return {
    teacherId: context.teacherId,
    teacherName: context.teacherName,
    myClasses: context.classes ?? [],
    ready,
  };
}
