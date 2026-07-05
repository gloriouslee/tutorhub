"use client";

import { useState } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { useStudentContext } from "@/hooks/useStudentContext";
import BrowseView from "@/components/student/BrowseView";
import PlayerView from "@/components/student/PlayerView";
import type { OwnedCourse } from "@/components/student/materialsShared";

// ─────────────────────────────────────────────────────────────────────────────
// Page root
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentMaterialsPage() {
  const { studentName } = useStudentContext();
  const [selectedCourse, setSelectedCourse] = useState<OwnedCourse | null>(null);
  const [courseLocked, setCourseLocked] = useState(false);
  return (
    <PortalLayout role="student" userName={studentName} pageTitle="Tài liệu">
      <div className="max-w-7xl mx-auto">
        {selectedCourse
          ? <PlayerView course={selectedCourse} isPackageLocked={courseLocked} onBack={() => setSelectedCourse(null)} />
          : <BrowseView onSelectCourse={(c, locked) => { setSelectedCourse(c); setCourseLocked(locked); }} />}
      </div>
    </PortalLayout>
  );
}
