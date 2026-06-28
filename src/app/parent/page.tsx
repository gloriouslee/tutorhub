import PortalLayout from "@/components/layout/PortalLayout";
import ParentDashboard from "./dashboard";

export default function ParentPage() {
  return (
    <PortalLayout role="parent" userName="Robert Thompson" pageTitle="Dashboard">
      <ParentDashboard />
    </PortalLayout>
  );
}
