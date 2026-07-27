-- ⚠️ DESTRUCTIVE CLEANUP — retired KV "global blob" tables.
--
-- These 12 kv_* tables were global single-row blobs holding every tenant's data.
-- They have been REPLACED by per-row, RLS-scoped tables (see schema_canonical.sql
-- and the 20260727150001-150004 migrations), and no application code reads or
-- writes them anymore.
--
-- Running this DROPS those tables and any data still inside them. The old blob
-- data is NOT migrated into the new per-row tables — it is orphaned legacy data
-- in a format the app no longer understands.
--
-- RUN ONLY AFTER:
--   1) The per-row migrations / schema_canonical.sql are applied, AND
--   2) You have confirmed there is no legacy blob data you still need
--      (take a backup first: `npm run db:backup`).
--
-- `cascade` also removes the RLS policies and grants attached to each table.

drop table if exists public.kv_teacher_homework       cascade;
drop table if exists public.kv_submissions            cascade;
drop table if exists public.kv_teacher_classes        cascade;
drop table if exists public.kv_teacher_attendance     cascade;
drop table if exists public.kv_teacher_materials      cascade;
drop table if exists public.kv_class_materials        cascade;
drop table if exists public.kv_homework_attachments   cascade;
drop table if exists public.kv_class_overrides        cascade;
drop table if exists public.kv_student_comments       cascade;
drop table if exists public.kv_course_reviews         cascade;
drop table if exists public.kv_schedule_notifications cascade;
drop table if exists public.kv_parent_messages        cascade;

-- Optional: the legacy UUID exam_scores table (superseded by app_exam_scores).
-- Uncomment only if you are sure nothing depends on it.
-- drop table if exists public.exam_scores cascade;
