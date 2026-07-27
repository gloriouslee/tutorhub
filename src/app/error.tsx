"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("route_error", { digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-bold">Đã xảy ra lỗi</h1>
        <p className="text-muted-foreground">
          Yêu cầu chưa hoàn tất. Vui lòng thử lại; nếu lỗi lặp lại, gửi mã lỗi cho quản trị viên.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground">Mã lỗi: {error.digest}</p>
        )}
        <Button onClick={reset}>Thử lại</Button>
      </div>
    </main>
  );
}
