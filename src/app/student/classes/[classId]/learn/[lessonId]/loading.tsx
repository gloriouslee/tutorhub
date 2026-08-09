export default function LoadingClassLearningPlayer() {
  return (
    <main className="flex h-dvh min-h-[560px] flex-col overflow-hidden bg-background" aria-busy="true">
      <div className="h-16 shrink-0 animate-pulse bg-slate-950" />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <div className="aspect-video max-h-[calc(100dvh-190px)] w-full animate-pulse bg-slate-900" />
          <div className="space-y-3 p-6">
            <div className="h-5 w-28 animate-pulse rounded-md bg-muted" />
            <div className="h-8 w-3/4 animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded-md bg-muted/70" />
          </div>
        </div>
        <div className="hidden w-[360px] shrink-0 space-y-3 border-l border-border p-4 lg:block">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-muted" />
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      </div>
      <div className="h-16 shrink-0 animate-pulse border-t border-border bg-card" />
    </main>
  );
}
