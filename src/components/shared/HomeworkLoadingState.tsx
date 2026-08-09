import { ClipboardList, Loader2 } from "lucide-react";

export function HomeworkLoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Đang tải bài tập"
      className="space-y-6 max-w-5xl mx-auto pb-10"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Đang tải bài tập…</p>
          <p className="text-xs text-muted-foreground">
            Hệ thống đang cập nhật đề bài và trạng thái bài nộp mới nhất.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex gap-4">
                <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-muted" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-muted/70" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted/50" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="h-fit rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-muted-foreground">
            <ClipboardList className="h-4 w-4" />
            <span className="text-xs font-semibold">Đang tổng hợp tiến độ</span>
          </div>
          <div className="space-y-3">
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-2 w-full animate-pulse rounded-full bg-muted/70" />
            <div className="h-16 w-full animate-pulse rounded-xl bg-muted/50" />
          </div>
        </div>
      </div>
    </div>
  );
}
