import PortalLayout from "@/components/layout/PortalLayout";
import StudentDashboard from "./dashboard";
import { getCurrentUserName } from "@/lib/auth";

export default async function StudentPage() {
  const userName = await getCurrentUserName();
  return (
    <PortalLayout role="student" userName={userName} pageTitle="Dashboard">
      <StudentDashboard />
    </PortalLayout>
  );
}
