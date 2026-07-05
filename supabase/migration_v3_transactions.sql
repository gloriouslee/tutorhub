-- Giao dịch mua tài liệu: chuyển từ localStorage sang Supabase để
-- học viên mua trên máy của họ, admin duyệt trên máy khác, và hệ thống
-- tự mở khóa tài liệu cho học viên khi được duyệt.
-- Chạy trong Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.purchase_transactions (
  id            TEXT PRIMARY KEY,
  pkg_id        TEXT NOT NULL,
  pkg_title     TEXT NOT NULL,
  amount        NUMERIC(12,0) NOT NULL,
  student_id    TEXT NOT NULL,
  student_name  TEXT,
  student_email TEXT,
  transfer_note TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tx_student ON public.purchase_transactions (student_id, status);

ALTER TABLE public.purchase_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "phase1_open_all" ON public.purchase_transactions;
CREATE POLICY "phase1_open_all" ON public.purchase_transactions
  FOR ALL USING (true) WITH CHECK (true);
