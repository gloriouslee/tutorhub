-- ============================================================
-- 1. TABLE: submissions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.submissions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id  text        NOT NULL,
  student_id   text        NOT NULL,
  student_name text,
  file_url     text,
  file_name    text,
  file_size    integer,
  status       text        NOT NULL DEFAULT 'submitted'
                           CHECK (status IN ('submitted', 'graded', 'returned')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  score        numeric(4,2),
  feedback     text,
  graded_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by student or homework
CREATE INDEX IF NOT EXISTS submissions_student_id_idx  ON public.submissions (student_id);
CREATE INDEX IF NOT EXISTS submissions_homework_id_idx ON public.submissions (homework_id);

-- ============================================================
-- 2. RLS (enable when auth is wired up)
-- ============================================================
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Temporarily allow all access via anon key (no auth yet)
CREATE POLICY "allow_all_anon" ON public.submissions
  FOR ALL USING (true) WITH CHECK (true);

-- When auth is ready, replace the policy above with:
--
-- CREATE POLICY "students_own_submissions" ON public.submissions
--   FOR SELECT USING (student_id = auth.uid()::text);
--
-- CREATE POLICY "students_insert_own" ON public.submissions
--   FOR INSERT WITH CHECK (student_id = auth.uid()::text);
--
-- CREATE POLICY "teachers_read_all" ON public.submissions
--   FOR SELECT USING (auth.jwt() ->> 'role' = 'teacher');
--
-- CREATE POLICY "teachers_update_grade" ON public.submissions
--   FOR UPDATE USING (auth.jwt() ->> 'role' = 'teacher');

-- ============================================================
-- 3. STORAGE BUCKET: homework-submissions
--    Run this in the Supabase Dashboard → Storage → New Bucket
--    OR uncomment if using supabase-js admin client:
-- ============================================================

-- INSERT INTO storage.buckets (id, name, public)
--   VALUES ('homework-submissions', 'homework-submissions', true)
--   ON CONFLICT DO NOTHING;

-- Storage RLS: allow anon upload + public read (switch to private later)
-- CREATE POLICY "anon_upload" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'homework-submissions');
--
-- CREATE POLICY "public_read" ON storage.objects
--   FOR SELECT USING (bucket_id = 'homework-submissions');
