import StudentExamPlayer from "@/components/student/StudentExamPlayer";

export default async function StudentExamPage({
  params,
}: {
  params: Promise<{ classId: string; lessonId: string }>;
}) {
  const { classId, lessonId } = await params;
  return <StudentExamPlayer classId={classId} lessonId={lessonId} />;
}
