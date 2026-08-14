import StudentProfile from "@/components/teacher/students/StudentProfile";

export default async function TeacherStudentProfilePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  return <StudentProfile studentId={studentId} />;
}
