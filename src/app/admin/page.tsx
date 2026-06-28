import PortalLayout from "@/components/layout/PortalLayout";
import AdminDashboard from "./dashboard";

export default function AdminPage() {
  return (
    <PortalLayout role="admin" userName="Admin User" pageTitle="Admin Dashboard">
      <AdminDashboard />
    </PortalLayout>
  );
}
