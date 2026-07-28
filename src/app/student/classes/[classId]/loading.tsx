export default function LoadingStudentClass() {
  return (
    <main className="min-h-screen bg-background p-4 md:p-8" aria-busy="true">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-muted" />
        <div className="h-48 animate-pulse rounded-3xl bg-muted/80" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      </div>
    </main>
  );
}
