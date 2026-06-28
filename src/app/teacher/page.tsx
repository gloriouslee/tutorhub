import PortalLayout from "@/components/layout/PortalLayout";
import TeacherDashboard from "./dashboard";

export default function TeacherPage() {
  return (
    <PortalLayout role="teacher" userName="Thầy Hùng Toán" pageTitle="Dashboard">
      <TeacherDashboard />
    </PortalLayout>
  );
}

