"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="vi">
      <body>
        <main style={{ maxWidth: 560, margin: "15vh auto", padding: 24, textAlign: "center" }}>
          <h1>Hệ thống tạm thời gặp sự cố</h1>
          <p>Không có thay đổi nào được xác nhận. Vui lòng thử lại.</p>
          {error.digest && <p>Mã lỗi: {error.digest}</p>}
          <button onClick={reset}>Thử lại</button>
        </main>
      </body>
    </html>
  );
}
