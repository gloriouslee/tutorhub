export default function LoadingTeacherClass() {
  return (
    <main className="min-h-screen bg-background p-4 md:p-8" aria-busy="true">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-muted" />
        <div className="h-52 animate-pulse rounded-3xl bg-muted/80" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-10 w-24 shrink-0 animate-pulse rounded-lg bg-muted/60" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      </div>
    </main>
  );
}
