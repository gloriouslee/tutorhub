import PortalLayout from "@/components/layout/PortalLayout";
import StudentDashboard from "./dashboard";

export default function StudentPage() {
  return (
    <PortalLayout role="student" userName="Nguyễn Anh Tuấn" pageTitle="Dashboard">
      <StudentDashboard />
    </PortalLayout>
  );
}

