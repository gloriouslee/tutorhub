export default function TeacherStudentProfileLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6" role="status" aria-label="Đang mở hồ sơ học viên">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      <div className="h-12 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-48 animate-pulse rounded-2xl bg-muted" />)}
      </div>
    </div>
  );
}
