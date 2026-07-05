-- Run this in your Supabase SQL Editor
-- Adds tables for enrollment requests and app exam scores

-- =====================
-- ENROLLMENT REQUESTS
-- (sign-up form submissions from the website)
-- =====================
CREATE TABLE IF NOT EXISTS public.enrollment_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name         TEXT        NOT NULL,
  email             TEXT        NOT NULL,
  dob               TEXT        NOT NULL,
  school            TEXT,
  grade             TEXT,
  requested_class_id TEXT,
  parent_phone      TEXT,
  student_phone     TEXT,
  note              TEXT,
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'rejected')),
  assigned_class_id TEXT,
  account_username  TEXT,
  account_password  TEXT,
  reject_reason     TEXT,
  supabase_user_id  UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ
);

ALTER TABLE public.enrollment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_enrollment_requests" ON public.enrollment_requests;
DROP POLICY IF EXISTS "public_select_enrollment_requests" ON public.enrollment_requests;
DROP POLICY IF EXISTS "public_update_enrollment_requests" ON public.enrollment_requests;

CREATE POLICY "public_insert_enrollment_requests"
  ON public.enrollment_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "public_select_enrollment_requests"
  ON public.enrollment_requests FOR SELECT USING (true);

CREATE POLICY "public_update_enrollment_requests"
  ON public.enrollment_requests FOR UPDATE USING (true);


-- =====================
-- APP EXAM SCORES
-- (teacher-entered scores; text IDs to support both mock and real students)
-- =====================
CREATE TABLE IF NOT EXISTS public.app_exam_scores (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_ref TEXT        NOT NULL,   -- Supabase user id or demo id like "s1"
  class_id    TEXT        NOT NULL,
  exam_name   TEXT        NOT NULL,
  score       NUMERIC(5,2) NOT NULL,
  max_score   NUMERIC(5,2) NOT NULL DEFAULT 10,
  exam_date   DATE        NOT NULL,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_exam_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_app_exam_scores" ON public.app_exam_scores;
CREATE POLICY "allow_all_app_exam_scores"
  ON public.app_exam_scores FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS app_exam_scores_student_ref_idx
  ON public.app_exam_scores (student_ref);
