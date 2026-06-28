import PortalLayout from "@/components/layout/PortalLayout";
import ParentDashboard from "./dashboard";
import { getCurrentUserName } from "@/lib/auth";

export default async function ParentPage() {
  const userName = await getCurrentUserName();
  return (
    <PortalLayout role="parent" userName={userName} pageTitle="Dashboard">
      <ParentDashboard />
    </PortalLayout>
  );
}
