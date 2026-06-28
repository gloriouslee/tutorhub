import PortalLayout from "@/components/layout/PortalLayout";
import TeacherDashboard from "./dashboard";
import { getCurrentUserName } from "@/lib/auth";

export default async function TeacherPage() {
  const userName = await getCurrentUserName();
  return (
    <PortalLayout role="teacher" userName={userName} pageTitle="Dashboard">
      <TeacherDashboard />
    </PortalLayout>
  );
}
