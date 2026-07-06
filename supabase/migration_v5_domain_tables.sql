-- Thay bảng app_kv chung bằng các bảng riêng theo từng nhóm dữ liệu.
-- Mỗi bảng cùng cấu trúc (id TEXT, value JSONB) — id là scope của nhóm:
-- class_id, student_id, hoặc 'global' với dữ liệu không phân theo scope.
-- Chạy trong Supabase SQL Editor. (Có thể chạy đè nhiều lần an toàn.)

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    -- theo lớp (id = class_id)
    'kv_curriculum',            -- giáo trình
    'kv_schedules',             -- lịch học override
    'kv_online_links',          -- link phòng học online
    'kv_tuition',               -- cấu hình học phí lớp
    'kv_student_packages',      -- gói học của học viên trong lớp
    'kv_session_notes',         -- ghi chú buổi học
    'kv_class_extra_students',  -- học viên thêm vào lớp
    -- theo học viên (id = student_id)
    'kv_student_comments',      -- nhận xét của giáo viên
    'kv_exam_results',          -- kết quả bài thi online
    'kv_exam_submissions',      -- bài làm thi online
    -- toàn cục (id = 'global')
    'kv_exam_scores',           -- điểm giáo viên nhập
    'kv_course_reviews',        -- đánh giá khóa học
    'kv_invoices',              -- hóa đơn học phí
    'kv_managed_users',         -- tài khoản quản lý (trang admin users)
    'kv_student_accounts',      -- tài khoản học viên (legacy)
    'kv_schedule_notifications',-- thông báo lịch học
    'kv_homework_attachments',  -- file đính kèm bài tập
    'kv_class_materials',       -- tài liệu lớp học
    'kv_class_overrides',       -- phân công lại giáo viên
    'kv_teacher_homework',      -- bài tập giáo viên tạo
    'kv_teacher_classes',       -- lớp giáo viên tạo
    'kv_teacher_attendance',    -- điểm danh giáo viên
    'kv_teacher_materials',     -- khóa học/tài liệu giáo viên tạo
    'kv_submissions',           -- bài nộp (bản localStorage)
    'kv_parent_messages'        -- tin nhắn phụ huynh
  ]
  LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I (
         id         TEXT PRIMARY KEY,
         value      JSONB NOT NULL,
         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "phase1_open_all" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "phase1_open_all" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- Bỏ bảng app_kv chung (nếu đã tạo ở migration v4)
DROP TABLE IF EXISTS public.app_kv;
