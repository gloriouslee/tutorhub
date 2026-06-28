import PortalLayout from "@/components/layout/PortalLayout";
import { SectionHeader } from "@/components/shared";
import MaterialsUploadForm from "@/components/shared/MaterialsUploadForm";
import { getCurrentUserName } from "@/lib/auth";
import { MOCK_CLASSES } from "@/lib/mock-data";

export default async function TeacherMaterialsPage() {
  const userName = await getCurrentUserName();
  const teacherClasses = MOCK_CLASSES.slice(0, 4);

  return (
    <PortalLayout role="teacher" userName={userName} pageTitle="Tài liệu">
      <div className="max-w-2xl mx-auto space-y-5">
        <SectionHeader
          title="Tải lên tài liệu"
          subtitle="Upload bài giảng, PDF, bài tập cho học viên trong lớp của bạn"
        />
        <MaterialsUploadForm classes={teacherClasses} />
      </div>
    </PortalLayout>
  );
}
