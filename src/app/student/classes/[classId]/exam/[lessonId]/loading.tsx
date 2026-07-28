export default function LoadingStudentExam() {
  return (
    <main className="min-h-screen bg-background p-4 md:p-8" aria-busy="true">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted/70" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-2xl bg-muted/60" />
        ))}
      </div>
    </main>
  );
}
