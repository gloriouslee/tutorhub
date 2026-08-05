"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import QuestionsWorkspace from "@/components/questions/QuestionsWorkspace";
import { useStudentContext } from "@/hooks/useStudentContext";

export default function StudentQuestionsPage() {
  const { studentId, studentName, myClasses, ready } = useStudentContext();
  return (
    <PortalLayout role="student" userName={studentName || "Học viên"} pageTitle="Hỏi đáp">
      <QuestionsWorkspace
        role="student"
        classes={myClasses}
        studentId={studentId}
        ready={ready}
      />
    </PortalLayout>
  );
}
