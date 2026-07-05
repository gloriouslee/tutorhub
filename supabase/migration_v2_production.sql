-- ============================================================================
-- TutorHub — Migration v2: production persistence
-- Chạy TOÀN BỘ file này trong Supabase SQL Editor (Dashboard → SQL Editor).
--
-- Thay đổi chính:
--   1. Sửa lỗi RLS đệ quy vô hạn trên profiles (nguyên nhân mọi query 500)
--   2. Các bảng entity dùng TEXT id (tương thích id "s1", "c1", "cls_..." của app)
--   3. Policy mở cho giai đoạn 1 (app chưa có auth per-user);
--      sẽ siết lại ở giai đoạn 2 khi bật Supabase Auth đầy đủ
-- Các bảng cũ đang rỗng (query luôn lỗi 500 nên app chưa từng ghi được) → DROP an toàn.
-- ============================================================================

-- ── 1. Fix RLS recursion on profiles ────────────────────────────────────────
-- Hàm SECURITY DEFINER đọc role mà không kích hoạt lại policy của profiles
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR ALL USING (public.get_my_role() = 'admin');

-- ── 2. Drop & recreate entity tables with TEXT ids ──────────────────────────
DROP TABLE IF EXISTS public.materials CASCADE;
DROP TABLE IF EXISTS public.submissions CASCADE;
DROP TABLE IF EXISTS public.homework CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.enrollments CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.parents CASCADE;
DROP TABLE IF EXISTS public.teachers CASCADE;

CREATE TABLE public.parents (
  id         TEXT PRIMARY KEY,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name  TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.teachers (
  id             TEXT PRIMARY KEY,
  user_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name      TEXT NOT NULL,
  email          TEXT,
  specialization TEXT,
  bio            TEXT,
  avatar_url     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.students (
  id            TEXT PRIMARY KEY,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name     TEXT NOT NULL,
  email         TEXT,
  dob           TEXT,
  school        TEXT,
  grade         TEXT,
  learning_type TEXT CHECK (learning_type IN ('online','offline','hybrid')) DEFAULT 'hybrid',
  parent_id     TEXT REFERENCES public.parents(id) ON DELETE SET NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.classes (
  id            TEXT PRIMARY KEY,
  class_name    TEXT NOT NULL,
  subject       TEXT NOT NULL,
  grade         INTEGER,
  learning_mode TEXT CHECK (learning_mode IN ('online','offline','hybrid')) NOT NULL DEFAULT 'hybrid',
  tutor_id      TEXT REFERENCES public.teachers(id) ON DELETE SET NULL,
  classroom     TEXT,
  zoom_link     TEXT,
  schedule      JSONB DEFAULT '[]',
  student_ids   TEXT[] DEFAULT '{}',
  description   TEXT,
  max_students  INTEGER DEFAULT 15,
  color         TEXT DEFAULT '#6366f1',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.payments (
  id             TEXT PRIMARY KEY,
  student_id     TEXT REFERENCES public.students(id) ON DELETE CASCADE,
  class_id       TEXT REFERENCES public.classes(id) ON DELETE SET NULL,
  amount         NUMERIC(12,0) NOT NULL,
  due_date       DATE NOT NULL,
  paid_date      DATE,
  payment_status TEXT CHECK (payment_status IN ('paid','pending','overdue')) DEFAULT 'pending',
  description    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.attendance (
  id              TEXT PRIMARY KEY,
  class_id        TEXT REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id      TEXT REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status          TEXT CHECK (status IN ('present','absent','late','excused')) NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.notifications (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  category        TEXT,
  target_role     TEXT CHECK (target_role IN ('student','parent','teacher','admin','all')) NOT NULL,
  target_class_id TEXT,
  sent_by         TEXT,
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.homework (
  id          TEXT PRIMARY KEY,
  class_id    TEXT REFERENCES public.classes(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  due_date    DATE NOT NULL,
  attachments TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.submissions (
  id                TEXT PRIMARY KEY,
  homework_id       TEXT NOT NULL,
  student_id        TEXT NOT NULL,
  student_name      TEXT,
  file_url          TEXT,
  file_name         TEXT,
  file_size         BIGINT,
  text_content      TEXT,
  score             NUMERIC(5,2),
  feedback          TEXT,
  teacher_file_url  TEXT,
  teacher_file_name TEXT,
  status            TEXT CHECK (status IN ('submitted','graded','returned')) DEFAULT 'submitted',
  submitted_at      TIMESTAMPTZ DEFAULT NOW(),
  graded_at         TIMESTAMPTZ,
  UNIQUE (homework_id, student_id)
);

CREATE TABLE public.materials (
  id          TEXT PRIMARY KEY,
  class_id    TEXT,
  title       TEXT NOT NULL,
  description TEXT,
  file_url    TEXT,
  file_type   TEXT,
  file_size   TEXT,
  target_role TEXT,
  target_grades      TEXT[],
  target_class_ids   TEXT[],
  target_student_ids TEXT[],
  uploaded_by TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- enrollment_requests + app_exam_scores giữ nguyên nếu đã tồn tại (đã dùng TEXT/UUID phù hợp)
CREATE TABLE IF NOT EXISTS public.enrollment_requests (
  id                 TEXT PRIMARY KEY,
  full_name          TEXT NOT NULL,
  email              TEXT NOT NULL,
  dob                TEXT,
  school             TEXT,
  grade              TEXT,
  requested_class_id TEXT,
  parent_phone       TEXT,
  student_phone      TEXT,
  note               TEXT,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  assigned_class_id  TEXT,
  account_username   TEXT,
  account_password   TEXT,
  reject_reason      TEXT,
  supabase_user_id   UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.app_exam_scores (
  id          TEXT PRIMARY KEY,
  student_ref TEXT NOT NULL,
  class_id    TEXT NOT NULL,
  exam_name   TEXT NOT NULL,
  score       NUMERIC(5,2) NOT NULL,
  max_score   NUMERIC(5,2) NOT NULL DEFAULT 10,
  exam_date   DATE NOT NULL,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_students_parent    ON public.students (parent_id);
CREATE INDEX IF NOT EXISTS idx_payments_student   ON public.payments (student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance (student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class   ON public.attendance (class_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_submissions_hw     ON public.submissions (homework_id);
CREATE INDEX IF NOT EXISTS idx_scores_student     ON public.app_exam_scores (student_ref);

-- ── 4. Phase-1 policies (open; siết lại ở phase 2 khi có auth) ───────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'parents','teachers','students','classes','payments','attendance',
    'notifications','homework','submissions','materials',
    'enrollment_requests','app_exam_scores'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "phase1_open_all" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "phase1_open_all" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t
    );
  END LOOP;
END $$;
