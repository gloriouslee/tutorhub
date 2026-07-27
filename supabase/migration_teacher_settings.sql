-- Bảng cấu hình của giáo viên (QR thanh toán, thông tin ngân hàng).
-- id = teacher_id (vd "t1"). Cùng cấu trúc các bảng kv_* khác.
-- Chạy trong Supabase SQL Editor. (An toàn khi chạy lại nhiều lần.)

CREATE TABLE IF NOT EXISTS public.kv_teacher_settings (
  id         TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.kv_teacher_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "phase1_open_all" ON public.kv_teacher_settings;
-- Default deny. Production policies are defined by the production security migration.
