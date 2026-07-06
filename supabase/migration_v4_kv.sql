-- Bảng key-value chung: đích đến cho toàn bộ dữ liệu app còn nằm trong
-- localStorage mà cần chia sẻ xuyên thiết bị (bài tập/lớp GV tạo, điểm danh,
-- giáo trình, ghi chú buổi học, link online, tin nhắn, hóa đơn, v.v.).
-- Giữ nguyên cấu trúc JSON hiện tại — chỉ đổi nơi lưu.
-- Chạy trong Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.app_kv (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_kv ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "phase1_open_all" ON public.app_kv;
CREATE POLICY "phase1_open_all" ON public.app_kv
  FOR ALL USING (true) WITH CHECK (true);
