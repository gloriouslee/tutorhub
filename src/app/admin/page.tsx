import PortalLayout from "@/components/layout/PortalLayout";
import AdminDashboard from "./dashboard";
import { getCurrentUserName } from "@/lib/auth";

export default async function AdminPage() {
  const userName = await getCurrentUserName();
  return (
    <PortalLayout role="admin" userName={userName} pageTitle="Admin Dashboard">
      <AdminDashboard />
    </PortalLayout>
  );
}
