import ClassLearningPlayer from "@/components/student/ClassLearningPlayer";

export default async function StudentClassLearningPage({
  params,
}: {
  params: Promise<{ classId: string; lessonId: string }>;
}) {
  const { classId, lessonId } = await params;
  return <ClassLearningPlayer classId={classId} requestedLessonId={lessonId} />;
}
