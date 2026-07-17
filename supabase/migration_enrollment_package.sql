-- Thêm cột "package" (gói học viên đăng ký) vào bảng enrollment_requests.
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại (IF NOT EXISTS).
alter table public.enrollment_requests
  add column if not exists package text;

comment on column public.enrollment_requests.package is
  'Gói học viên đăng ký: online | advanced | offline';
