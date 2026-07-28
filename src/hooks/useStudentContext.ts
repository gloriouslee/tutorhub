import type { Class } from "@/types";
import { useAccountContext } from "@/hooks/useAccountContext";

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
  const { context, ready } = useAccountContext();
  if (context?.role !== "student") return { ...EMPTY_CONTEXT, ready };

  return {
    studentId: context.studentId,
    studentName: context.studentName,
    myClasses: context.classes ?? [],
    assignedClassId: context.assignedClassId ?? "",
    ready,
  };
}
