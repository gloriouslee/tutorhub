"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import QuestionsWorkspace from "@/components/questions/QuestionsWorkspace";
import { useTeacherContext } from "@/hooks/useTeacherContext";

export default function TeacherQuestionsPage() {
  const { teacherName, myClasses, ready } = useTeacherContext();
  return (
    <PortalLayout role="teacher" userName={teacherName || "Giáo viên"} pageTitle="Hỏi đáp">
      <QuestionsWorkspace role="teacher" classes={myClasses} ready={ready} />
    </PortalLayout>
  );
}
