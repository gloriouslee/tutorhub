import type { Class } from "@/types";
import { useAccountContext } from "@/hooks/useAccountContext";

export interface TeacherContext {
  userId: string;
  teacherId: string;
  teacherName: string;
  myClasses: Class[];
  ready: boolean;
}

const EMPTY_CONTEXT: TeacherContext = {
  userId: "",
  teacherId: "",
  teacherName: "",
  myClasses: [],
  ready: false,
};

export function useTeacherContext(): TeacherContext {
  const { context, ready } = useAccountContext();
  if (context?.role !== "teacher") return { ...EMPTY_CONTEXT, ready };

  return {
    userId: context.userId,
    teacherId: context.teacherId,
    teacherName: context.teacherName,
    myClasses: context.classes ?? [],
    ready,
  };
}
