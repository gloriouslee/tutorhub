-- ============================================================================
-- TutorHub — CANONICAL SUPABASE SCHEMA (single-run, idempotent)
-- ============================================================================
-- WHAT THIS IS
--   The single canonical database setup for a fresh Supabase project. Running
--   this one file on an empty project produces the complete, production-shaped
--   schema (tables, helper/RPC functions, RLS policies, grants, storage buckets
--   and storage policies) that the TutorHub app expects.
--
--   It is a faithful MERGE of the incremental migrations, not a redesign. It
--   SUPERSEDES and replaces all of the following (do not run them alongside it):
--     - supabase/schema.sql                       (LEGACY UUID prototype)
--     - supabase/migration_v2_production.sql
--     - supabase/migration_app_tables.sql
--     - supabase/migration_v3_transactions.sql
--     - supabase/migration_v5_domain_tables.sql
--     - supabase/migration_missing_columns.sql
--     - supabase/migration_enrollment_package.sql
--     - supabase/migration_teacher_settings.sql
--     - supabase/migrations/20260727140000_production_security.sql
--     - supabase/migrations/20260727150001..150004_perrow_*.sql
--     - supabase/migrations/20260809120000_student_guardians.sql
--     - supabase/storage_open_policies.sql / storage_policies_v2.sql
--
--   IDEMPOTENT: safe to re-run. Uses create extension if not exists,
--   create table if not exists, create or replace function, and
--   drop policy if exists <name> before every create policy. RLS is (re)enabled
--   with alter table ... enable/force row level security (safe to re-run).
--
--   NOTE: `set check_function_bodies = off` is issued so the SQL-language helper
--   functions in section 2 may reference tables that are created later in the
--   file (forward references). This is required for a clean single-pass run.
-- ============================================================================
--
-- ─────────────────────────── COVERAGE MANIFEST ─────────────────────────────
-- TABLES (50)
--   Core (12):    profiles, parents, teachers, students, student_guardians, classes, payments,
--                 attendance, notifications, homework, submissions, materials
--   Domain (10):  class_registration_requests, purchase_transactions,
--                 app_exam_scores, class_leaderboard_settings,
--                 student_support_alerts, weekly_parent_reports,
--                 student_xp_events, student_badges, learning_goals,
--                 student_topic_mastery
--   KV (14):      kv_curriculum, kv_schedules, kv_online_links, kv_tuition,
--                 kv_student_packages, kv_session_notes, kv_class_extra_students,
--                 kv_exam_results, kv_exam_submissions, kv_exam_scores,
--                 kv_invoices, kv_managed_users, kv_student_accounts,
--                 kv_teacher_settings
--   Per-row (13): course_reviews, student_comments, schedule_notifications,
--                 schedule_notification_reads, class_materials,
--                 homework_attachments, class_teacher_overrides,
--                 teacher_homework, teacher_extra_classes, hw_submissions,
--                 class_attendance, teacher_materials, parent_messages
--   Infra (1):    api_rate_limits
--
-- FUNCTIONS (17)
--   Auth helpers (10): get_my_role, my_student_id, my_teacher_id, my_parent_id,
--                     teaches_class, enrolled_in_class, parent_has_student,
--                     parent_id_has_student, teaches_student, is_my_child
--   Trigger fn (1):   handle_new_user  (+ trigger on_auth_user_created)
--   Secure RPC (6):   consume_rate_limit,
--                     review_class_registration_request_secure,
--                     submit_exam_result_secure,
--                     retry_exam_secure, delete_admin_domain_identity_secure,
--                     mutate_invoice_secure
--
-- STORAGE
--   Buckets (3, private): avatars, homework-submissions, class-materials
--   Policies: owner-scoped avatars + class-scoped materials/submissions
--
-- DELIBERATE EXCLUSIONS (see the report accompanying this file)
--   - Legacy UUID `exam_scores` table (schema.sql only) and its grant/policy:
--     the app uses app_exam_scores / kv_exam_scores instead; keeping the UUID
--     table would require FKs to now-TEXT students/classes.
--   - Legacy UUID `enrollments` table (schema.sql only): dropped by v2, unused.
--   - KV blobs replaced by the per-row tables above: kv_teacher_homework,
--     kv_submissions, kv_teacher_classes, kv_teacher_attendance,
--     kv_teacher_materials, kv_class_materials, kv_homework_attachments,
--     kv_class_overrides, kv_student_comments, kv_course_reviews,
--     kv_schedule_notifications, kv_parent_messages.
--     (This file simply does not create them. To DROP them from an existing
--      database, run the destructive supabase/drop_retired_kv.sql separately.)
-- ============================================================================

set check_function_bodies = off;

-- ─────────────────────────── 1. Extensions ─────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";


-- ─────────────────────────── 2. Helper functions ───────────────────────────
-- SECURITY DEFINER helpers avoid recursive RLS lookups. None are executable by
-- anon/public (grants are (re)applied in the RLS section). Defined before the
-- tables they read thanks to `check_function_bodies = off` above.

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select role from public.profiles where id = auth.uid() limit 1 $$;

create or replace function public.my_student_id()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select id::text from public.students where user_id = auth.uid() limit 1 $$;

create or replace function public.my_teacher_id()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select id::text from public.teachers where user_id = auth.uid() limit 1 $$;

create or replace function public.my_parent_id()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select id::text from public.parents where user_id = auth.uid() limit 1 $$;

create or replace function public.teaches_class(p_class_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.classes
    where id::text = p_class_id
      and tutor_id::text = public.my_teacher_id()
  ) or exists (
    select 1 from public.teacher_extra_classes
    where id = p_class_id and tutor_id = public.my_teacher_id()
  )
$$;

create or replace function public.enrolled_in_class(p_class_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.classes c
    where c.id::text = p_class_id
      and exists (
        select 1
        from unnest(c.student_ids) student_id
        where student_id::text = public.my_student_id()
      )
  ) or exists (
    select 1 from public.teacher_extra_classes ec
    where ec.id = p_class_id
      and public.my_student_id() = any (ec.student_ids)
  )
$$;

-- Explicit parent id helper is also used by service-role RPCs where auth.uid()
-- is intentionally unavailable.
create or replace function public.parent_id_has_student(
  p_parent_id text,
  p_student_id text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.student_guardians sg
    where sg.parent_id = p_parent_id
      and sg.student_id = p_student_id
      and sg.status = 'active'
  ) or exists (
    select 1 from public.students s
    where s.id::text = p_student_id
      and s.parent_id::text = p_parent_id
  )
$$;

-- Parent owns a student through an accepted guardian link. The legacy column
-- remains as a compatibility fallback while old installations are migrated.
create or replace function public.parent_has_student(p_student_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select public.parent_id_has_student(public.my_parent_id(), p_student_id) $$;

-- A teacher "teaches" a student when the student is in one of the teacher's classes.
create or replace function public.teaches_student(p_student_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.classes c
    where c.tutor_id::text = public.my_teacher_id()
      and exists (
        select 1 from unnest(c.student_ids) sid where sid::text = p_student_id
      )
  )
$$;

-- Compatibility alias used by older per-row policies.
create or replace function public.is_my_child(p_student_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select public.parent_has_student(p_student_id) $$;


-- ─────────────────────────── 3. Core tables ────────────────────────────────
-- profiles: recovered from schema.sql (the only place it is defined) and merged
-- with the columns added by the production-security migration (full_name,
-- must_reset_password).
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text,
  phone               text,
  full_name           text,
  role                text not null check (role in ('student','parent','teacher','admin')) default 'student',
  must_reset_password boolean not null default true,
  -- Account locked by an admin. Checked on every request (see getRequestIdentity)
  -- so a lock applies immediately instead of waiting for the token to expire.
  -- Service-role writes only: authenticated may update (full_name, phone) only.
  disabled            boolean not null default false,
  created_at          timestamptz default now()
);

-- Auto-create a profile on auth signup (production-security version of the fn).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_role       text;
  oauth_signup         boolean;
  self_service_student boolean;
  resolved_name        text;
begin
  requested_role := coalesce(new.raw_app_meta_data->>'role', 'student');
  if requested_role not in ('student', 'parent', 'teacher', 'admin') then
    requested_role := 'student';
  end if;

  -- 'email' is the password provider; anything else is a federated identity
  -- (Google, …). Those are provider-verified, so they need neither a password
  -- nor an email confirmation and count as a self-service student signup.
  oauth_signup :=
    coalesce(new.raw_app_meta_data->>'provider', 'email') <> 'email';

  self_service_student :=
    requested_role = 'student'
    and (
      coalesce(new.raw_user_meta_data->>'self_service_signup', 'false') = 'true'
      or oauth_signup
    );

  -- Google sends the display name as full_name and/or name.
  resolved_name := nullif(
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      ''
    ),
    ''
  );

  insert into public.profiles (
    id, email, full_name, role, must_reset_password
  )
  values (
    new.id,
    new.email,
    resolved_name,
    requested_role,
    requested_role <> 'admin' and not self_service_student
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name);

  if self_service_student then
    insert into public.students (
      id, user_id, full_name, email, dob, school, grade,
      learning_type, avatar_url, created_at
    )
    values (
      'stu_' || new.id::text,
      new.id,
      coalesce(resolved_name, split_part(new.email, '@', 1)),
      lower(new.email),
      '', '', '', 'hybrid',
      nullif(
        coalesce(
          new.raw_user_meta_data->>'avatar_url',
          new.raw_user_meta_data->>'picture',
          ''
        ),
        ''
      ),
      now()
    )
    on conflict (id) do update
    set user_id = excluded.user_id,
        full_name = excluded.full_name,
        email = excluded.email,
        avatar_url = coalesce(public.students.avatar_url, excluded.avatar_url);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Entity tables use TEXT ids (compatible with the app's "s1", "c1", "cls_…" ids).
create table if not exists public.parents (
  id         text primary key,
  user_id    uuid references public.profiles(id) on delete set null,
  full_name  text not null,
  email      text,
  phone      text,
  avatar_url text,
  created_at timestamptz default now()
);

create table if not exists public.teachers (
  id             text primary key,
  user_id        uuid references public.profiles(id) on delete set null,
  full_name      text not null,
  email          text,
  specialization text,
  bio            text,
  avatar_url     text,
  created_at     timestamptz default now()
);

create table if not exists public.students (
  id            text primary key,
  user_id       uuid references public.profiles(id) on delete set null,
  full_name     text not null,
  email         text,
  dob           text,
  school        text,
  grade         text,
  learning_type text check (learning_type in ('online','offline','hybrid')) default 'hybrid',
  parent_id     text references public.parents(id) on delete set null,
  avatar_url    text,
  created_at    timestamptz default now()
);

-- Many-to-many guardian ownership. A link is usable only after the parent
-- accepts the invitation and its status becomes active.
create table if not exists public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  parent_id text not null references public.parents(id) on delete cascade,
  relationship text not null default 'guardian'
    check (relationship in ('mother', 'father', 'guardian', 'other')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected', 'revoked')),
  invited_email text,
  invited_by_user_id uuid references public.profiles(id) on delete set null,
  invited_by_role text check (invited_by_role in ('teacher', 'admin')),
  accepted_at timestamptz,
  rejected_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, parent_id)
);

insert into public.student_guardians (
  student_id, parent_id, relationship, status, invited_email,
  accepted_at, created_at, updated_at
)
select s.id, s.parent_id, 'guardian', 'active', p.email,
  coalesce(s.created_at, now()), coalesce(s.created_at, now()), now()
from public.students s
join public.parents p on p.id = s.parent_id
where s.parent_id is not null
on conflict (student_id, parent_id) do nothing;

create index if not exists student_guardians_parent_status_idx
  on public.student_guardians(parent_id, status, student_id);
create index if not exists student_guardians_student_status_idx
  on public.student_guardians(student_id, status, parent_id);
create index if not exists student_guardians_invited_email_idx
  on public.student_guardians(lower(invited_email))
  where invited_email is not null;

create table if not exists public.classes (
  id            text primary key,
  class_name    text not null,
  subject       text not null,
  grade         integer,
  learning_mode text check (learning_mode in ('online','offline','hybrid')) not null default 'hybrid',
  tutor_id      text references public.teachers(id) on delete set null,
  classroom     text,
  zoom_link     text,
  schedule      jsonb default '[]',
  student_ids   text[] default '{}',
  description   text,
  max_students  integer default 15,
  color         text default '#6366f1',
  created_at    timestamptz default now()
);

create table if not exists public.payments (
  id             text primary key,
  student_id     text references public.students(id) on delete cascade,
  class_id       text references public.classes(id) on delete set null,
  amount         numeric(12,0) not null,
  due_date       date not null,
  paid_date      date,
  payment_status text check (payment_status in ('paid','pending','overdue')) default 'pending',
  description    text,
  created_at     timestamptz default now()
);

create table if not exists public.attendance (
  id              text primary key,
  class_id        text references public.classes(id) on delete cascade,
  student_id      text references public.students(id) on delete cascade,
  attendance_date date not null,
  status          text check (status in ('present','absent','late','excused')) not null,
  notes           text,
  created_at      timestamptz default now()
);

create table if not exists public.notifications (
  id              text primary key,
  title           text not null,
  content         text not null,
  category        text,
  target_role     text check (target_role in ('student','parent','teacher','admin','all')) not null,
  target_class_id text,
  target_student_id text references public.students(id) on delete cascade,
  sent_by         text,
  sender_user_id  uuid references auth.users(id) on delete set null,
  is_read         boolean default false,
  created_at      timestamptz default now()
);

create table if not exists public.homework (
  id          text primary key,
  class_id    text references public.classes(id) on delete cascade,
  title       text not null,
  description text,
  due_date    date not null,
  attachments text[] default '{}',
  created_at  timestamptz default now()
);

create table if not exists public.submissions (
  id                text primary key,
  homework_id       text not null,
  student_id        text not null,
  student_name      text,
  file_url          text,
  file_name         text,
  file_size         bigint,
  text_content      text,
  score             numeric(5,2),
  feedback          text,
  teacher_file_url  text,
  teacher_file_name text,
  status            text check (status in ('submitted','graded','returned')) default 'submitted',
  submitted_at      timestamptz default now(),
  graded_at         timestamptz,
  unique (homework_id, student_id)
);

create table if not exists public.materials (
  id                 text primary key,
  class_id           text,
  title              text not null,
  description        text,
  file_url           text,
  file_type          text,
  file_size          text,
  target_role        text,
  target_grades      text[],
  target_class_ids   text[],
  target_student_ids text[],
  uploaded_by        text,
  created_at         timestamptz default now()
);

create index if not exists idx_students_parent    on public.students (parent_id);
create index if not exists idx_payments_student   on public.payments (student_id);
create index if not exists idx_attendance_student on public.attendance (student_id);
create index if not exists idx_attendance_class   on public.attendance (class_id, attendance_date);
create index if not exists idx_submissions_hw     on public.submissions (homework_id);
create index if not exists parents_user_id_idx on public.parents (user_id) where user_id is not null;
create index if not exists teachers_user_id_idx on public.teachers (user_id) where user_id is not null;
create index if not exists students_user_id_idx on public.students (user_id) where user_id is not null;
create index if not exists classes_tutor_id_idx on public.classes (tutor_id) where tutor_id is not null;
create index if not exists classes_student_ids_gin_idx on public.classes using gin (student_ids);


-- ─────────────────────────── 4. Domain tables ──────────────────────────────
create table if not exists public.class_registration_requests (
  id                 uuid primary key default gen_random_uuid(),
  student_id         text not null references public.students(id) on delete cascade,
  requested_class_id text not null references public.classes(id) on delete cascade,
  assigned_class_id  text references public.classes(id) on delete set null,
  source             text not null default 'class'
                     check (source in ('class', 'material')),
  resource_id        text,
  requested_package  text check (requested_package in ('online', 'advanced', 'offline')),
  requested_unit_price numeric(12, 0)
                     check (requested_unit_price is null or requested_unit_price >= 0),
  tuition_period     text
                     check (tuition_period is null or tuition_period ~ '^[0-9]{4}-[0-9]{2}$'),
  student_note       text,
  teacher_note       text,
  status             text not null default 'pending'
                     check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by        uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  reviewed_at        timestamptz
);
create index if not exists notifications_sender_created_idx on public.notifications (sender_user_id, created_at desc);
create index if not exists notifications_target_class_created_idx on public.notifications (target_role, target_class_id, created_at desc);
create index if not exists notifications_target_student_created_idx on public.notifications (target_student_id, created_at desc);

create table if not exists public.notification_reads (
  notification_id text not null references public.notifications(id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  is_deleted      boolean not null default false,
  read_at         timestamptz not null default now(),
  primary key (notification_id, user_id)
);
create unique index if not exists class_registration_one_pending_idx
  on public.class_registration_requests (student_id, requested_class_id)
  where status = 'pending';
create index if not exists class_registration_requested_status_idx
  on public.class_registration_requests (requested_class_id, status, created_at desc);
create index if not exists class_registration_student_idx
  on public.class_registration_requests (student_id, created_at desc);

create table if not exists public.class_questions (
  id                uuid primary key default gen_random_uuid(),
  class_id          text not null references public.classes(id) on delete cascade,
  student_id        text not null references public.students(id) on delete cascade,
  title             text not null check (char_length(title) between 3 and 160),
  status            text not null default 'open'
                    check (status in ('open', 'answered', 'closed')),
  last_message_role text not null default 'student'
                    check (last_message_role in ('student', 'teacher')),
  last_message_at   timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create table if not exists public.class_question_messages (
  id              uuid primary key default gen_random_uuid(),
  question_id     uuid not null references public.class_questions(id) on delete cascade,
  author_user_id  uuid references auth.users(id) on delete set null,
  author_role     text not null check (author_role in ('student', 'teacher')),
  author_name     text not null check (char_length(author_name) between 1 and 160),
  content         text not null check (char_length(content) between 1 and 10000),
  attachment_url  text,
  attachment_name text,
  attachment_size text,
  created_at      timestamptz not null default now()
);
create index if not exists class_questions_class_status_idx
  on public.class_questions (class_id, status, last_message_at desc);
create index if not exists class_questions_student_idx
  on public.class_questions (student_id, last_message_at desc);
create index if not exists class_question_messages_thread_idx
  on public.class_question_messages (question_id, created_at);

create table if not exists public.purchase_transactions (
  id            text primary key,
  pkg_id        text not null,
  pkg_title     text not null,
  amount        numeric(12,0) not null,
  student_id    text not null,
  student_name  text,
  student_email text,
  class_id      text references public.classes(id) on delete set null,
  teacher_id    text references public.teachers(id) on delete set null,
  receipt_path  text,
  transfer_note text,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 500)
);
create index if not exists idx_tx_student on public.purchase_transactions (student_id, status);
create index if not exists purchase_transactions_teacher_status_idx
  on public.purchase_transactions (teacher_id, status, created_at desc);

create table if not exists public.student_lesson_progress (
  student_id  text not null references public.students(id) on delete cascade,
  resource_id text not null,
  lesson_id   text not null,
  completed   boolean not null default false,
  notes       text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (student_id, resource_id, lesson_id)
);
create index if not exists student_lesson_progress_resource_idx
  on public.student_lesson_progress (student_id, resource_id, updated_at desc);
alter table public.student_lesson_progress enable row level security;
revoke all on public.student_lesson_progress from anon, authenticated;
grant select, insert, update, delete on public.student_lesson_progress to service_role;

-- app_exam_scores: TEXT-id (v2) shape.
create table if not exists public.app_exam_scores (
  id          text primary key,
  student_ref text not null,
  class_id    text not null,
  exam_name   text not null,
  score       numeric(5,2) not null,
  max_score   numeric(5,2) not null default 10,
  exam_date   date not null,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_scores_student on public.app_exam_scores (student_ref);
create index if not exists app_exam_scores_class_student_idx
  on public.app_exam_scores (class_id, student_ref);

create table if not exists public.class_leaderboard_settings (
  class_id            text primary key,
  enabled             boolean not null default true,
  period              text not null default 'all_time'
                      check (period in ('all_time', 'last_7_days', 'last_30_days', 'term')),
  term_start_date     date,
  minimum_assessments integer not null default 1
                      check (minimum_assessments between 1 and 20),
  privacy_mode        text not null default 'full_name'
                      check (privacy_mode in ('full_name', 'abbreviated', 'anonymous')),
  updated_by          text,
  updated_at          timestamptz not null default now(),
  check (period <> 'term' or term_start_date is not null)
);
alter table public.class_leaderboard_settings enable row level security;
revoke all on public.class_leaderboard_settings from anon, authenticated;
grant select, insert, update, delete on public.class_leaderboard_settings to service_role;

create table if not exists public.student_support_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null unique,
  teacher_id text not null,
  class_id text not null,
  student_id text not null references public.students(id) on delete cascade,
  priority text not null check (priority in ('high', 'medium', 'low')),
  priority_score integer not null default 0,
  signals jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'monitoring', 'resolved')),
  detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists student_support_alerts_teacher_status_idx
  on public.student_support_alerts(teacher_id, status, priority_score desc, last_detected_at desc);
create index if not exists student_support_alerts_student_idx
  on public.student_support_alerts(student_id, last_detected_at desc);

create table if not exists public.weekly_parent_reports (
  id uuid primary key default gen_random_uuid(),
  teacher_id text not null,
  student_id text not null references public.students(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  summary jsonb not null default '{}'::jsonb,
  teacher_comment text,
  delivery_channel text not null default 'notification'
    check (delivery_channel in ('notification', 'email', 'both')),
  delivery_status text not null default 'delivered'
    check (delivery_status in ('pending', 'delivered', 'failed')),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, student_id, week_start)
);
create index if not exists weekly_parent_reports_student_week_idx
  on public.weekly_parent_reports(student_id, week_start desc);
create index if not exists weekly_parent_reports_teacher_week_idx
  on public.weekly_parent_reports(teacher_id, week_start desc);

create table if not exists public.student_xp_events (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  class_id text,
  source_type text not null
    check (source_type in ('homework', 'attendance', 'lesson', 'improvement', 'community', 'manual')),
  source_id text not null,
  points integer not null check (points between -100 and 500),
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (student_id, source_type, source_id)
);
create index if not exists student_xp_events_student_date_idx
  on public.student_xp_events(student_id, occurred_at desc);

create table if not exists public.student_badges (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  class_id text not null default '',
  badge_code text not null,
  title text not null,
  description text not null,
  icon text not null,
  metadata jsonb not null default '{}'::jsonb,
  awarded_at timestamptz not null default now(),
  unique (student_id, badge_code, class_id)
);
create index if not exists student_badges_student_date_idx
  on public.student_badges(student_id, awarded_at desc);

create table if not exists public.learning_goals (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  class_id text,
  title text not null,
  metric text not null check (metric in (
    'homework_completed', 'average_score', 'attendance_rate',
    'lessons_completed', 'xp_earned'
  )),
  target_value numeric(8,2) not null check (target_value > 0),
  current_value numeric(8,2) not null default 0,
  period_start date not null,
  period_end date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled', 'expired')),
  created_by_user_id uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);
create index if not exists learning_goals_student_status_idx
  on public.learning_goals(student_id, status, period_end);

create table if not exists public.student_topic_mastery (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  class_id text not null,
  topic text not null,
  total_questions integer not null default 0 check (total_questions >= 0),
  incorrect_questions integer not null default 0 check (incorrect_questions >= 0),
  mastery_percent numeric(5,2) not null default 0 check (mastery_percent between 0 and 100),
  recommended_resources jsonb not null default '[]'::jsonb,
  last_exam_id text,
  last_exam_title text,
  last_exam_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (student_id, class_id, topic)
);
create index if not exists student_topic_mastery_student_idx
  on public.student_topic_mastery(student_id, mastery_percent, updated_at desc);
create index if not exists student_topic_mastery_class_idx
  on public.student_topic_mastery(class_id, mastery_percent, updated_at desc);

alter table public.student_support_alerts enable row level security;
alter table public.student_support_alerts force row level security;
alter table public.weekly_parent_reports enable row level security;
alter table public.weekly_parent_reports force row level security;
alter table public.student_xp_events enable row level security;
alter table public.student_xp_events force row level security;
alter table public.student_badges enable row level security;
alter table public.student_badges force row level security;
alter table public.learning_goals enable row level security;
alter table public.learning_goals force row level security;
alter table public.student_topic_mastery enable row level security;
alter table public.student_topic_mastery force row level security;
revoke all on public.student_support_alerts from public;
revoke all on public.weekly_parent_reports from public;
revoke all on public.student_xp_events from public;
revoke all on public.student_badges from public;
revoke all on public.learning_goals from public;
revoke all on public.student_topic_mastery from public;
revoke all on public.student_support_alerts from anon, authenticated;
revoke all on public.weekly_parent_reports from anon, authenticated;
revoke all on public.student_xp_events from anon, authenticated;
revoke all on public.student_badges from anon, authenticated;
revoke all on public.learning_goals from anon, authenticated;
revoke all on public.student_topic_mastery from anon, authenticated;
grant select, insert, update, delete on public.student_support_alerts to service_role;
grant select, insert, update, delete on public.weekly_parent_reports to service_role;
grant select, insert, update, delete on public.student_xp_events to service_role;
grant select, insert, update, delete on public.student_badges to service_role;
grant select, insert, update, delete on public.learning_goals to service_role;
grant select, insert, update, delete on public.student_topic_mastery to service_role;


-- ─────────────────────────── 5. KV tables ──────────────────────────────────
-- Generic key/value tables (id TEXT scope + JSONB value). Only the KV datasets
-- NOT superseded by per-row tables are kept (see exclusions in the manifest).
do $$
declare t text;
begin
  foreach t in array array[
    -- class-scoped (id = class_id)
    'kv_curriculum',
    'kv_schedules',
    'kv_online_links',
    'kv_tuition',
    'kv_student_packages',
    'kv_session_notes',
    'kv_class_extra_students',
    -- student-scoped (id = student_id / composite)
    'kv_exam_results',
    'kv_exam_submissions',
    -- global (id = 'global')
    'kv_exam_scores',
    'kv_invoices',
    'kv_managed_users',
    'kv_student_accounts',
    -- teacher-scoped (id = teacher_id)
    'kv_teacher_settings'
  ]
  loop
    execute format(
      'create table if not exists public.%I (
         id         text primary key,
         value      jsonb not null,
         updated_at timestamptz not null default now()
       )', t);
  end loop;
end $$;


-- ─────────────────────────── 6. Per-row tables ─────────────────────────────
-- These replace the corresponding kv_* JSON blobs. TEXT ids match the app id
-- model ("c1","s1","cls_…","mat_…"). Policies/grants are applied in section 8.

create table if not exists public.course_reviews (
  id           text primary key,
  course_id    text not null,
  student_id   text not null,
  student_name text,
  rating       integer not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz not null default now(),
  unique (course_id, student_id)
);
create index if not exists course_reviews_course_idx on public.course_reviews (course_id);

create table if not exists public.student_comments (
  id           text primary key,
  student_id   text not null,
  comment_text text not null,
  rating       integer check (rating between 1 and 5),
  comment_date text not null,
  author_user_id uuid references public.profiles(id) on delete set null,
  author_name  text not null default 'Giáo viên',
  class_id     text,
  visibility  text not null default 'shared' check (visibility in ('private', 'shared')),
  tag         text not null default 'general' check (tag in ('general', 'academic', 'attendance', 'homework', 'wellbeing')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists student_comments_student_idx on public.student_comments (student_id);
create index if not exists student_comments_student_created_idx on public.student_comments (student_id, created_at desc);
create index if not exists student_comments_author_idx on public.student_comments (author_user_id, created_at desc);

create table if not exists public.schedule_notifications (
  id         text primary key,
  class_id   text not null,
  class_name text,
  message    text not null,
  created_at timestamptz not null default now()
);
create index if not exists schedule_notifications_class_idx on public.schedule_notifications (class_id);

-- Per-user read state (replaces the old shared is_read flag).
create table if not exists public.schedule_notification_reads (
  notification_id text not null references public.schedule_notifications(id) on delete cascade,
  user_id         uuid not null default auth.uid(),
  read_at         timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create table if not exists public.class_materials (
  id             text primary key,
  class_id       text not null,
  title          text not null,
  description    text,
  file_url       text not null,
  file_type      text,
  file_size      text,
  category       text,
  uploaded_by    text,
  created_at     timestamptz not null default now(),
  download_count integer not null default 0,
  packages       jsonb,
  pinned         boolean,
  kind           text
);
create index if not exists class_materials_class_idx on public.class_materials (class_id);

create table if not exists public.homework_attachments (
  id          text primary key,
  homework_id text not null,
  class_id    text references public.classes(id) on delete cascade,
  file_url    text not null,
  file_name   text,
  file_size   text,
  file_type   text,
  created_at  timestamptz not null default now()
);
create index if not exists homework_attachments_hw_idx on public.homework_attachments (homework_id);

create table if not exists public.class_teacher_overrides (
  class_id   text primary key,
  teacher_id text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.teacher_homework (
  id         text primary key,
  class_id   text not null,
  data       jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists teacher_homework_class_idx on public.teacher_homework (class_id);

create table if not exists public.teacher_extra_classes (
  id          text primary key,
  tutor_id    text not null,
  student_ids text[] not null default '{}',
  data        jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists teacher_extra_classes_tutor_idx on public.teacher_extra_classes (tutor_id);

create table if not exists public.hw_submissions (
  id           text primary key,
  homework_id  text not null,
  student_id   text not null,
  class_id     text,
  data         jsonb not null,
  submitted_at timestamptz not null default now()
);
create index if not exists hw_submissions_hw_idx      on public.hw_submissions (homework_id);
create index if not exists hw_submissions_student_idx on public.hw_submissions (student_id);
create index if not exists hw_submissions_class_idx on public.hw_submissions (class_id) where class_id is not null;

create table if not exists public.class_attendance (
  class_id        text not null,
  student_id      text not null,
  attendance_date text not null,
  data            jsonb not null,
  primary key (class_id, student_id, attendance_date)
);
create index if not exists class_attendance_student_date_idx on public.class_attendance (student_id, attendance_date desc);

create table if not exists public.teacher_materials (
  id         text primary key,
  teacher_id text not null,
  class_id   text,
  published  boolean not null default false,
  data       jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists teacher_materials_teacher_idx on public.teacher_materials (teacher_id);

create table if not exists public.parent_messages (
  parent_id  text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);


-- ─────────────────────────── 7. api_rate_limits ────────────────────────────
create table if not exists public.api_rate_limits (
  scope             text not null,
  key_hash          text not null,
  window_started_at timestamptz not null,
  request_count     integer not null check (request_count >= 0),
  primary key (scope, key_hash)
);


-- ─────────────────────── 8. Secure RPC functions ───────────────────────────
-- SECURITY DEFINER application RPCs (executable only by service_role; grants
-- applied at the end of this section).

create or replace function public.consume_rate_limit(
  p_scope text,
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  now_at timestamptz := clock_timestamp();
  current_count integer;
begin
  if p_scope = '' or p_key = '' or p_limit < 1
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    return false;
  end if;

  insert into public.api_rate_limits(scope, key_hash, window_started_at, request_count)
  values (p_scope, p_key, now_at, 1)
  on conflict (scope, key_hash) do update
  set window_started_at =
        case
          when public.api_rate_limits.window_started_at
               <= now_at - make_interval(secs => p_window_seconds)
          then now_at else public.api_rate_limits.window_started_at
        end,
      request_count =
        case
          when public.api_rate_limits.window_started_at
               <= now_at - make_interval(secs => p_window_seconds)
          then 1 else public.api_rate_limits.request_count + 1
        end
  returning request_count into current_count;
  return current_count <= p_limit;
end;
$$;

create or replace function public.review_class_registration_request_secure(
  p_request_id uuid,
  p_action text,
  p_assigned_class_id text,
  p_teacher_id text,
  p_actor_id uuid,
  p_teacher_note text default null
)
returns table(student_id text, assigned_class_id text, student_ids text[])
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row public.class_registration_requests%rowtype;
  destination public.classes%rowtype;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'teacher'
  ) or not exists (
    select 1 from public.teachers
    where id = p_teacher_id and user_id = p_actor_id
  ) then
    raise exception 'forbidden';
  end if;

  select * into request_row
  from public.class_registration_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'registration_not_found'; end if;
  if request_row.status <> 'pending' then
    raise exception 'registration_not_pending';
  end if;
  if not exists (
    select 1 from public.classes
    where id = request_row.requested_class_id and tutor_id = p_teacher_id
  ) then
    raise exception 'forbidden';
  end if;

  if p_action = 'reject' then
    update public.class_registration_requests
    set status = 'rejected',
        teacher_note = nullif(trim(p_teacher_note), ''),
        reviewed_by = p_actor_id,
        reviewed_at = now()
    where id = p_request_id;
    return;
  end if;
  if p_action <> 'approve' or p_assigned_class_id is null then
    raise exception 'invalid_action';
  end if;

  select * into destination
  from public.classes
  where id = p_assigned_class_id and tutor_id = p_teacher_id
  for update;
  if not found then raise exception 'destination_class_not_owned'; end if;
  if destination.max_students is not null
     and coalesce(array_length(destination.student_ids, 1), 0) >= destination.max_students
     and not request_row.student_id = any(coalesce(destination.student_ids, '{}'::text[])) then
    raise exception 'class_full';
  end if;

  update public.classes
  set student_ids = case
    when request_row.student_id = any(coalesce(classes.student_ids, '{}'::text[]))
      then classes.student_ids
    else array_append(coalesce(classes.student_ids, '{}'::text[]), request_row.student_id)
  end
  where id = p_assigned_class_id
  returning classes.student_ids into destination.student_ids;

  insert into public.kv_student_packages (id, value, updated_at)
  values (
    p_assigned_class_id,
    jsonb_build_object(
      request_row.student_id,
      coalesce(request_row.requested_package, 'online')
    ),
    now()
  )
  on conflict (id) do update
  set value = coalesce(public.kv_student_packages.value, '{}'::jsonb)
              || excluded.value,
      updated_at = now();

  update public.class_registration_requests
  set status = 'approved',
      assigned_class_id = p_assigned_class_id,
      teacher_note = nullif(trim(p_teacher_note), ''),
      reviewed_by = p_actor_id,
      reviewed_at = now()
  where id = p_request_id;

  return query
    select request_row.student_id, p_assigned_class_id, destination.student_ids;
end;
$$;

create or replace function public.submit_exam_result_secure(
  p_result_id text,
  p_submissions_id text,
  p_student_id text,
  p_result jsonb,
  p_allow_retry boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  registry jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_submissions_id, 0));
  if exists (
    select 1 from public.kv_exam_results where id::text = p_result_id
  ) then
    raise exception 'already_submitted';
  end if;
  select value into registry
  from public.kv_exam_submissions
  where id::text = p_submissions_id
  for update;
  registry := coalesce(registry, '[]'::jsonb);
  if not p_allow_retry and registry ? p_student_id then
    raise exception 'retry_not_allowed';
  end if;

  insert into public.kv_exam_results(id, value, updated_at)
  values (p_result_id, p_result, now());
  insert into public.kv_exam_submissions(id, value, updated_at)
  values (
    p_submissions_id,
    case when registry ? p_student_id
      then registry else registry || to_jsonb(p_student_id) end,
    now()
  )
  on conflict (id) do update
  set value = excluded.value, updated_at = now();
  return true;
end;
$$;

create or replace function public.retry_exam_secure(
  p_result_id text,
  p_submissions_id text,
  p_student_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_submissions_id, 0));
  delete from public.kv_exam_results where id::text = p_result_id;
  update public.kv_exam_submissions
  set value = coalesce(
    (
      select jsonb_agg(item)
      from jsonb_array_elements(value) item
      where item <> to_jsonb(p_student_id)
    ),
    '[]'::jsonb
  ),
  updated_at = now()
  where id::text = p_submissions_id;
  return true;
end;
$$;

create or replace function public.delete_admin_domain_identity_secure(
  p_entity text,
  p_record_id text,
  p_actor_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  auth_user_id text;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'admin'
  ) then
    raise exception 'forbidden';
  end if;

  if p_entity = 'students' then
    if exists (
      select 1 from public.classes
      where p_record_id = any(coalesce(student_ids, '{}'::text[]))
    ) then raise exception 'student_has_classes'; end if;
    select user_id::text into auth_user_id
    from public.students where id = p_record_id for update;
    delete from public.students where id = p_record_id;
  elsif p_entity = 'teachers' then
    if exists (
      select 1 from public.classes where tutor_id = p_record_id
    ) then raise exception 'teacher_has_classes'; end if;
    select user_id::text into auth_user_id
    from public.teachers where id = p_record_id for update;
    delete from public.teachers where id = p_record_id;
  else
    raise exception 'invalid_entity';
  end if;
  return auth_user_id;
end;
$$;

create or replace function public.mutate_invoice_secure(
  p_action text,
  p_invoice_id text,
  p_child_id text,
  p_actor_id uuid,
  p_invoice jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text;
  actor_student_id text;
  actor_parent_id text;
  actor_teacher_id text;
  invoices jsonb;
  target jsonb;
  output_value jsonb;
begin
  select role into actor_role from public.profiles where id = p_actor_id;
  select id::text into actor_student_id
  from public.students where user_id::text = p_actor_id::text limit 1;
  select id::text into actor_parent_id
  from public.parents where user_id::text = p_actor_id::text limit 1;
  select id::text into actor_teacher_id
  from public.teachers where user_id::text = p_actor_id::text limit 1;

  perform pg_advisory_xact_lock(hashtextextended('kv_invoices:global', 0));
  insert into public.kv_invoices(id, value, updated_at)
  values ('global', '[]'::jsonb, now())
  on conflict (id) do nothing;
  select value into invoices
  from public.kv_invoices where id = 'global' for update;
  invoices := case when jsonb_typeof(invoices) = 'array'
    then invoices else '[]'::jsonb end;
  select item into target
  from jsonb_array_elements(invoices) item
  where item->>'id' = p_invoice_id
  limit 1;

  if p_action = 'submit_receipt' then
    if actor_role = 'student' then
      p_child_id := actor_student_id;
    elsif actor_role = 'parent' then
      if not public.parent_id_has_student(actor_parent_id, p_child_id) then
        raise exception 'forbidden';
      end if;
    else
      raise exception 'forbidden';
    end if;
    if target is null and p_invoice_id <> 'ALL' then
      raise exception 'invoice_not_found';
    end if;
    select coalesce(jsonb_agg(
      case
        when (
          (p_invoice_id = 'ALL' and item->>'child_id' = p_child_id
            and item->>'status' = 'pending')
          or (item->>'id' = p_invoice_id and item->>'child_id' = p_child_id
            and item->>'status' = 'pending')
        )
        then item || jsonb_build_object(
          'status', 'pending_verification',
          'submitted_by', actor_role
        )
        else item
      end
    ), '[]'::jsonb) into output_value
    from jsonb_array_elements(invoices) item;
  elsif p_action = 'mark_paid' then
    if target is null then raise exception 'invoice_not_found'; end if;
    if actor_role = 'teacher' and not exists (
      select 1 from public.classes
      where id::text = target->>'class_id'
        and tutor_id::text = actor_teacher_id
    ) then raise exception 'forbidden';
    elsif actor_role not in ('teacher', 'admin') then
      raise exception 'forbidden';
    end if;
    select coalesce(jsonb_agg(
      case when item->>'id' = p_invoice_id
        then item || jsonb_build_object(
          'status', 'paid',
          'paid_at', coalesce(item->>'paid_at', now()::text)
        )
        else item end
    ), '[]'::jsonb) into output_value
    from jsonb_array_elements(invoices) item;
  elsif p_action = 'issue' then
    if actor_role = 'teacher' and not exists (
      select 1 from public.classes
      where id::text = p_invoice->>'class_id'
        and tutor_id::text = actor_teacher_id
        and exists (
          select 1
          from unnest(classes.student_ids) student_id
          where student_id::text = p_invoice->>'child_id'
        )
    ) then raise exception 'forbidden';
    elsif actor_role not in ('teacher', 'admin') then
      raise exception 'forbidden';
    end if;
    if target is not null then return target; end if;
    output_value := invoices || p_invoice;
  else
    raise exception 'invalid_action';
  end if;

  update public.kv_invoices
  set value = output_value, updated_at = now()
  where id = 'global';
  return case when p_action = 'issue' then p_invoice else 'true'::jsonb end;
end;
$$;


-- ──────────────── 9. RLS: enable/force, grants, policies ────────────────────
-- Enable + force RLS on every table in public, then start from no direct access
-- for anon/authenticated and grant back only the explicit allow-list below.
-- (service_role has BYPASSRLS and is the only path for API-only tables.)
do $$
declare table_row record;
begin
  for table_row in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', table_row.tablename);
    execute format('alter table public.%I force row level security', table_row.tablename);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all tables in schema public from authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.class_questions to service_role;
grant select, insert, update, delete on public.class_question_messages to service_role;

-- Helper function execute grants.
grant execute on function public.get_my_role()               to authenticated, service_role;
grant execute on function public.my_student_id()             to authenticated, service_role;
grant execute on function public.my_teacher_id()             to authenticated, service_role;
grant execute on function public.my_parent_id()              to authenticated, service_role;
grant execute on function public.teaches_class(text)         to authenticated, service_role;
grant execute on function public.enrolled_in_class(text)     to authenticated, service_role;
grant execute on function public.parent_id_has_student(text, text) to authenticated, service_role;
grant execute on function public.parent_has_student(text)    to authenticated, service_role;
grant execute on function public.teaches_student(text)       to authenticated, service_role;
grant execute on function public.is_my_child(text)           to authenticated, service_role;

-- Secure RPCs: service_role only.
revoke all on function public.consume_rate_limit(text, text, integer, integer)                 from public, anon, authenticated;
revoke all on function public.review_class_registration_request_secure(uuid, text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.submit_exam_result_secure(text, text, text, jsonb, boolean)       from public, anon, authenticated;
revoke all on function public.retry_exam_secure(text, text, text)                               from public, anon, authenticated;
revoke all on function public.delete_admin_domain_identity_secure(text, text, uuid)             from public, anon, authenticated;
revoke all on function public.mutate_invoice_secure(text, text, text, uuid, jsonb)              from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer)               to service_role;
grant execute on function public.review_class_registration_request_secure(uuid, text, text, text, uuid, text) to service_role;
grant execute on function public.submit_exam_result_secure(text, text, text, jsonb, boolean)    to service_role;
grant execute on function public.retry_exam_secure(text, text, text)                            to service_role;
grant execute on function public.delete_admin_domain_identity_secure(text, text, uuid)          to service_role;
grant execute on function public.mutate_invoice_secure(text, text, text, uuid, jsonb)           to service_role;

-- ── profiles ────────────────────────────────────────────────────────────────
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.get_my_role() = 'admin');
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ── students / parents / teachers / classes ─────────────────────────────────
grant select on public.students, public.parents, public.teachers, public.classes,
  public.student_guardians
  to authenticated;
grant select, insert, update, delete on public.student_guardians to service_role;
drop policy if exists students_scoped_select on public.students;
create policy students_scoped_select on public.students
  for select to authenticated
  using (
    user_id::text = auth.uid()::text
    or public.parent_has_student(id::text)
    or public.get_my_role() = 'admin'
    or (public.get_my_role() = 'teacher' and public.teaches_student(id))
  );
drop policy if exists parents_scoped_select on public.parents;
create policy parents_scoped_select on public.parents
  for select to authenticated
  using (user_id::text = auth.uid()::text or public.get_my_role() = 'admin');
drop policy if exists student_guardians_scoped_select on public.student_guardians;
create policy student_guardians_scoped_select on public.student_guardians
  for select to authenticated
  using (
    public.get_my_role() = 'admin'
    or parent_id = public.my_parent_id()
    or (public.get_my_role() = 'teacher' and public.teaches_student(student_id))
  );
drop policy if exists teachers_authenticated_select on public.teachers;
create policy teachers_authenticated_select on public.teachers
  for select to authenticated using (true);
drop policy if exists classes_scoped_select on public.classes;
create policy classes_scoped_select on public.classes
  for select to authenticated
  using (
    public.get_my_role() = 'admin'
    or tutor_id::text = public.my_teacher_id()
    or exists (
      select 1
      from unnest(classes.student_ids) student_id
      where student_id::text = public.my_student_id()
    )
    or exists (
      select 1 from unnest(classes.student_ids) student_id
      where public.parent_has_student(student_id::text)
    )
  );
-- Teachers manage their own classes directly (RLS-scoped); admins any.
grant insert, update, delete on public.classes to authenticated;
drop policy if exists classes_teacher_write on public.classes;
create policy classes_teacher_write on public.classes
  for all to authenticated
  using (public.get_my_role() = 'admin' or tutor_id::text = public.my_teacher_id())
  with check (public.get_my_role() = 'admin' or tutor_id::text = public.my_teacher_id());

-- ── payments / attendance / homework / submissions / materials / notifications / app_exam_scores ──
grant select on public.payments, public.attendance, public.homework,
  public.submissions, public.materials, public.notifications,
  public.app_exam_scores to authenticated;

drop policy if exists payments_scoped_select on public.payments;
create policy payments_scoped_select on public.payments
  for select to authenticated
  using (
    student_id::text = public.my_student_id()
    or public.parent_has_student(student_id::text)
    or public.teaches_class(class_id::text)
    or public.get_my_role() = 'admin'
  );
drop policy if exists attendance_scoped_select on public.attendance;
create policy attendance_scoped_select on public.attendance
  for select to authenticated
  using (
    student_id::text = public.my_student_id()
    or public.parent_has_student(student_id::text)
    or public.teaches_class(class_id::text)
    or public.get_my_role() = 'admin'
  );
drop policy if exists homework_scoped_select on public.homework;
create policy homework_scoped_select on public.homework
  for select to authenticated
  using (
    public.enrolled_in_class(class_id::text)
    or public.teaches_class(class_id::text)
    or public.get_my_role() = 'admin'
  );
drop policy if exists submissions_scoped_select on public.submissions;
create policy submissions_scoped_select on public.submissions
  for select to authenticated
  using (
    student_id::text = public.my_student_id()
    or public.get_my_role() = 'admin'
    or exists (
      select 1 from public.homework h
      where h.id::text = submissions.homework_id::text
        and public.teaches_class(h.class_id::text)
    )
  );
grant insert, update on public.submissions to authenticated;
drop policy if exists submissions_student_insert on public.submissions;
create policy submissions_student_insert on public.submissions
  for insert to authenticated
  with check (
    student_id::text = public.my_student_id()
    and exists (
      select 1 from public.homework h
      where h.id::text = submissions.homework_id::text
        and public.enrolled_in_class(h.class_id::text)
    )
  );
drop policy if exists submissions_teacher_update on public.submissions;
create policy submissions_teacher_update on public.submissions
  for update to authenticated
  using (
    public.get_my_role() = 'admin'
    or exists (
      select 1 from public.homework h
      where h.id::text = submissions.homework_id::text
        and public.teaches_class(h.class_id::text)
    )
  )
  with check (
    public.get_my_role() = 'admin'
    or exists (
      select 1 from public.homework h
      where h.id::text = submissions.homework_id::text
        and public.teaches_class(h.class_id::text)
    )
  );
drop policy if exists materials_scoped_select on public.materials;
create policy materials_scoped_select on public.materials
  for select to authenticated
  using (
    public.get_my_role() = 'admin'
    or public.teaches_class(class_id::text)
    or public.enrolled_in_class(class_id::text)
    or (
      target_class_ids is not null
      and exists (
        select 1 from unnest(target_class_ids) target_id
        where public.enrolled_in_class(target_id::text)
      )
    )
  );
drop policy if exists notifications_role_select on public.notifications;
create policy notifications_role_select on public.notifications
  for select to authenticated
  using (
    public.get_my_role() = 'admin'
    or sender_user_id = auth.uid()
    or (
      (target_role = 'all' or target_role = public.get_my_role())
      and (
        target_student_id is null
        or (public.get_my_role() = 'student' and target_student_id = public.my_student_id())
        or (public.get_my_role() = 'parent' and public.parent_has_student(target_student_id))
      )
      and (
        target_class_id is null
        or (public.get_my_role() = 'teacher' and public.teaches_class(target_class_id))
        or (public.get_my_role() = 'student' and public.enrolled_in_class(target_class_id))
        or (
          public.get_my_role() = 'parent'
          and exists (
            select 1 from public.classes c
            where c.id = notifications.target_class_id
              and exists (
                select 1 from unnest(c.student_ids) student_id
                where public.parent_has_student(student_id::text)
              )
          )
        )
      )
    )
  );

alter table public.notification_reads enable row level security;
grant select, insert, update, delete on public.notification_reads to authenticated;
drop policy if exists notification_reads_owner on public.notification_reads;
create policy notification_reads_owner on public.notification_reads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists app_exam_scores_scoped_select on public.app_exam_scores;
create policy app_exam_scores_scoped_select on public.app_exam_scores
  for select to authenticated
  using (
    student_ref::text = public.my_student_id()
    or public.teaches_class(class_id::text)
    or public.get_my_role() = 'admin'
  );

-- class_registration_requests and purchase_transactions are API-only
-- (service_role):
-- no authenticated/anon grants or policies -> default deny.
grant select, insert, update, delete on public.class_registration_requests to service_role;

-- ── KV: curriculum (answer keys; never selectable by students/parents) ───────
grant select, insert, update, delete on public.kv_curriculum to authenticated;
drop policy if exists curriculum_teacher_admin_all on public.kv_curriculum;
create policy curriculum_teacher_admin_all on public.kv_curriculum
  for all to authenticated
  using (public.get_my_role() = 'admin' or public.teaches_class(id::text))
  with check (public.get_my_role() = 'admin' or public.teaches_class(id::text));

-- ── KV: exam results / submissions registry ─────────────────────────────────
grant select, insert, update on public.kv_exam_results to authenticated;
-- Class id can contain '_' (e.g. cls_123), so match by prefix rather than split_part.
drop policy if exists exam_results_scoped_select on public.kv_exam_results;
create policy exam_results_scoped_select on public.kv_exam_results
  for select to authenticated
  using (
    public.get_my_role() = 'admin'
    or id like '%\_' || public.my_student_id() escape '\'
    or exists (select 1 from public.classes c where c.tutor_id::text = public.my_teacher_id() and id like c.id || '\_%' escape '\')
  );
drop policy if exists exam_results_teacher_write on public.kv_exam_results;
create policy exam_results_teacher_write on public.kv_exam_results
  for insert to authenticated
  with check (public.get_my_role() = 'admin' or exists (select 1 from public.classes c where c.tutor_id::text = public.my_teacher_id() and id like c.id || '\_%' escape '\'));
drop policy if exists exam_results_teacher_update on public.kv_exam_results;
create policy exam_results_teacher_update on public.kv_exam_results
  for update to authenticated
  using (public.get_my_role() = 'admin' or exists (select 1 from public.classes c where c.tutor_id::text = public.my_teacher_id() and id like c.id || '\_%' escape '\'))
  with check (public.get_my_role() = 'admin' or exists (select 1 from public.classes c where c.tutor_id::text = public.my_teacher_id() and id like c.id || '\_%' escape '\'));
grant select on public.kv_exam_submissions to authenticated;
drop policy if exists exam_registry_teacher_select on public.kv_exam_submissions;
create policy exam_registry_teacher_select on public.kv_exam_submissions
  for select to authenticated
  using (
    public.get_my_role() = 'admin'
    or exists (select 1 from public.classes c where c.tutor_id::text = public.my_teacher_id() and id like c.id || '\_%' escape '\')
  );

-- ── KV: class-scoped datasets ────────────────────────────────────────────────
-- Students read rows for classes they are enrolled in; only the class
-- teacher/admin may write.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'kv_schedules', 'kv_online_links', 'kv_tuition',
    'kv_student_packages', 'kv_session_notes', 'kv_class_extra_students'
  ]
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_scoped_select', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using
       (public.get_my_role() = ''admin'' or public.teaches_class(id)
        or public.enrolled_in_class(id))',
      table_name || '_scoped_select', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_teacher_write', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using
       (public.get_my_role() = ''admin'' or public.teaches_class(id))
       with check (public.get_my_role() = ''admin'' or public.teaches_class(id))',
      table_name || '_teacher_write', table_name
    );
  end loop;
end $$;

-- ── KV: teacher settings ─────────────────────────────────────────────────────
grant select, insert, update, delete on public.kv_teacher_settings to authenticated;
drop policy if exists teacher_settings_read on public.kv_teacher_settings;
create policy teacher_settings_read on public.kv_teacher_settings
  for select to authenticated using (
    public.get_my_role() = 'admin'
    or id::text = public.my_teacher_id()
    or exists (
      select 1 from public.classes c
      where c.tutor_id::text = id::text
        and (
          public.my_student_id() = any (c.student_ids)
          or exists (
            select 1 from unnest(c.student_ids) student_id
            where public.parent_has_student(student_id::text)
          )
        )
    )
  );
drop policy if exists teacher_settings_owner_write on public.kv_teacher_settings;
create policy teacher_settings_owner_write on public.kv_teacher_settings
  for all to authenticated
  using (public.get_my_role() = 'admin' or id::text = public.my_teacher_id())
  with check (public.get_my_role() = 'admin' or id::text = public.my_teacher_id());

-- ── KV: remaining global tables (kv_exam_scores, kv_invoices, kv_managed_users,
--        kv_student_accounts) stay default-deny. service_role is the only path.

-- ── Per-row: course_reviews ──────────────────────────────────────────────────
grant select, insert, update, delete on public.course_reviews to authenticated;
drop policy if exists course_reviews_read on public.course_reviews;
create policy course_reviews_read on public.course_reviews
  for select to authenticated using (true);
drop policy if exists course_reviews_owner_write on public.course_reviews;
create policy course_reviews_owner_write on public.course_reviews
  for all to authenticated
  using (public.get_my_role() = 'admin' or student_id = public.my_student_id())
  with check (public.get_my_role() = 'admin' or student_id = public.my_student_id());

-- ── Per-row: student_comments ────────────────────────────────────────────────
grant select, insert, update, delete on public.student_comments to authenticated;
drop policy if exists student_comments_read on public.student_comments;
create policy student_comments_read on public.student_comments
  for select to authenticated using (
    public.get_my_role() = 'admin'
    or public.teaches_student(student_id)
    or (
      visibility = 'shared'
      and (student_id = public.my_student_id() or public.is_my_child(student_id))
    )
  );
drop policy if exists student_comments_teacher_write on public.student_comments;
create policy student_comments_teacher_write on public.student_comments
  for all to authenticated
  using (
    public.get_my_role() = 'admin'
    or (public.teaches_student(student_id) and author_user_id = auth.uid())
  )
  with check (
    public.get_my_role() = 'admin'
    or (public.teaches_student(student_id) and author_user_id = auth.uid())
  );

-- ── Per-row: schedule_notifications (+ per-user reads) ───────────────────────
grant select, insert, update, delete on public.schedule_notifications to authenticated;
drop policy if exists schedule_notifications_read on public.schedule_notifications;
create policy schedule_notifications_read on public.schedule_notifications
  for select to authenticated using (
    public.get_my_role() = 'admin'
    or public.teaches_class(class_id)
    or public.enrolled_in_class(class_id)
  );
drop policy if exists schedule_notifications_teacher_write on public.schedule_notifications;
create policy schedule_notifications_teacher_write on public.schedule_notifications
  for all to authenticated
  using (public.get_my_role() = 'admin' or public.teaches_class(class_id))
  with check (public.get_my_role() = 'admin' or public.teaches_class(class_id));

grant select, insert, update, delete on public.schedule_notification_reads to authenticated;
drop policy if exists schedule_reads_owner on public.schedule_notification_reads;
create policy schedule_reads_owner on public.schedule_notification_reads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Per-row: class_materials ─────────────────────────────────────────────────
grant select, insert, update, delete on public.class_materials to authenticated;
drop policy if exists class_materials_read on public.class_materials;
create policy class_materials_read on public.class_materials
  for select to authenticated using (
    public.get_my_role() = 'admin'
    or public.teaches_class(class_id)
    or public.enrolled_in_class(class_id)
  );
drop policy if exists class_materials_teacher_write on public.class_materials;
create policy class_materials_teacher_write on public.class_materials
  for all to authenticated
  using (public.get_my_role() = 'admin' or public.teaches_class(class_id))
  with check (public.get_my_role() = 'admin' or public.teaches_class(class_id));
drop policy if exists class_materials_student_download on public.class_materials;

-- ── Per-row: homework_attachments ────────────────────────────────────────────
grant select, insert, update, delete on public.homework_attachments to authenticated;
drop policy if exists homework_attachments_read on public.homework_attachments;
create policy homework_attachments_read on public.homework_attachments
  for select to authenticated using (
    public.get_my_role() = 'admin'
    or public.teaches_class(class_id)
    or public.enrolled_in_class(class_id)
    or exists (
      select 1 from public.classes c
      where c.id = homework_attachments.class_id
        and exists (
          select 1 from unnest(c.student_ids) student_id
          where public.parent_has_student(student_id::text)
        )
    )
  );
drop policy if exists homework_attachments_teacher_write on public.homework_attachments;
create policy homework_attachments_teacher_write on public.homework_attachments
  for all to authenticated
  using (public.get_my_role() = 'admin' or public.teaches_class(class_id))
  with check (public.get_my_role() = 'admin' or public.teaches_class(class_id));

-- ── Per-row: class_teacher_overrides ─────────────────────────────────────────
grant select, insert, update, delete on public.class_teacher_overrides to authenticated;
drop policy if exists class_overrides_read on public.class_teacher_overrides;
create policy class_overrides_read on public.class_teacher_overrides
  for select to authenticated using (true);
drop policy if exists class_overrides_admin_write on public.class_teacher_overrides;
create policy class_overrides_admin_write on public.class_teacher_overrides
  for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- ── Per-row: teacher_homework ────────────────────────────────────────────────
grant select, insert, update, delete on public.teacher_homework to authenticated;
drop policy if exists teacher_homework_read on public.teacher_homework;
create policy teacher_homework_read on public.teacher_homework
  for select to authenticated using (
    public.get_my_role() = 'admin'
    or public.teaches_class(class_id)
    or public.enrolled_in_class(class_id)
  );
drop policy if exists teacher_homework_write on public.teacher_homework;
create policy teacher_homework_write on public.teacher_homework
  for all to authenticated
  using (public.get_my_role() = 'admin' or public.teaches_class(class_id))
  with check (public.get_my_role() = 'admin' or public.teaches_class(class_id));

-- ── Per-row: teacher_extra_classes ───────────────────────────────────────────
grant select, insert, update, delete on public.teacher_extra_classes to authenticated;
drop policy if exists teacher_extra_classes_read on public.teacher_extra_classes;
create policy teacher_extra_classes_read on public.teacher_extra_classes
  for select to authenticated using (
    public.get_my_role() = 'admin'
    or tutor_id = public.my_teacher_id()
    or public.my_student_id() = any (student_ids)
  );
drop policy if exists teacher_extra_classes_write on public.teacher_extra_classes;
create policy teacher_extra_classes_write on public.teacher_extra_classes
  for all to authenticated
  using (public.get_my_role() = 'admin' or tutor_id = public.my_teacher_id())
  with check (public.get_my_role() = 'admin' or tutor_id = public.my_teacher_id());

-- ── Per-row: hw_submissions ──────────────────────────────────────────────────
grant select, insert, update, delete on public.hw_submissions to authenticated;
drop policy if exists hw_submissions_access on public.hw_submissions;
create policy hw_submissions_access on public.hw_submissions
  for all to authenticated
  using (
    public.get_my_role() = 'admin'
    or student_id = public.my_student_id()
    or (class_id is not null and public.teaches_class(class_id))
  )
  with check (
    public.get_my_role() = 'admin'
    or student_id = public.my_student_id()
    or (class_id is not null and public.teaches_class(class_id))
  );

-- ── Per-row: class_attendance ────────────────────────────────────────────────
grant select, insert, update, delete on public.class_attendance to authenticated;
drop policy if exists class_attendance_read on public.class_attendance;
create policy class_attendance_read on public.class_attendance
  for select to authenticated using (
    public.get_my_role() = 'admin'
    or public.teaches_class(class_id)
    or student_id = public.my_student_id()
    or public.is_my_child(student_id)
  );
drop policy if exists class_attendance_write on public.class_attendance;
create policy class_attendance_write on public.class_attendance
  for all to authenticated
  using (public.get_my_role() = 'admin' or public.teaches_class(class_id))
  with check (public.get_my_role() = 'admin' or public.teaches_class(class_id));

-- ── Per-row: teacher_materials ───────────────────────────────────────────────
grant select, insert, update, delete on public.teacher_materials to authenticated;
drop policy if exists teacher_materials_read on public.teacher_materials;
create policy teacher_materials_read on public.teacher_materials
  for select to authenticated using (
    public.get_my_role() = 'admin'
    or teacher_id = public.my_teacher_id()
  );
drop policy if exists teacher_materials_write on public.teacher_materials;
create policy teacher_materials_write on public.teacher_materials
  for all to authenticated
  using (public.get_my_role() = 'admin' or teacher_id = public.my_teacher_id())
  with check (public.get_my_role() = 'admin' or teacher_id = public.my_teacher_id());

-- ── Per-row: parent_messages ─────────────────────────────────────────────────
grant select, insert, update, delete on public.parent_messages to authenticated;
drop policy if exists parent_messages_owner on public.parent_messages;
create policy parent_messages_owner on public.parent_messages
  for all to authenticated
  using (public.get_my_role() = 'admin' or parent_id = public.my_parent_id())
  with check (public.get_my_role() = 'admin' or parent_id = public.my_parent_id());

-- ── api_rate_limits: no direct client access (service_role via RPC only) ─────
revoke all on public.api_rate_limits from anon, authenticated;


-- ─────────────────────── 10. Storage buckets & policies ─────────────────────
-- All three buckets are PRIVATE. These scoped policies come from the production
-- security migration and SUPERSEDE the phase-1 open policies in
-- storage_open_policies.sql and storage_policies_v2.sql.
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', false),
  ('homework-submissions', 'homework-submissions', false),
  ('class-materials', 'class-materials', false),
  ('payment-receipts', 'payment-receipts', false)
on conflict (id) do nothing;

update storage.buckets
set public = false
where id in ('class-materials', 'homework-submissions', 'avatars', 'payment-receipts');

-- avatars: files live under a folder named for the owner's auth uid.
drop policy if exists storage_avatar_owner_select on storage.objects;
create policy storage_avatar_owner_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists storage_avatar_owner_insert on storage.objects;
create policy storage_avatar_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists storage_avatar_owner_update on storage.objects;
create policy storage_avatar_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists storage_avatar_owner_delete on storage.objects;
create policy storage_avatar_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- class-materials / homework-submissions: first path segment is the class id.
drop policy if exists storage_class_scoped_select on storage.objects;
create policy storage_class_scoped_select on storage.objects
  for select to authenticated
  using (
    (
      bucket_id = 'class-materials'
      and (
        public.get_my_role() = 'admin'
        or public.teaches_class((storage.foldername(name))[1])
        or (storage.foldername(name))[1] = public.my_teacher_id()
      )
    )
    or (
      bucket_id = 'homework-submissions'
      and (
        public.get_my_role() = 'admin'
        or public.teaches_class((storage.foldername(name))[1])
        or (
          (storage.foldername(name))[2] = 'submissions'
          and (storage.foldername(name))[3] = public.my_student_id()
          and public.enrolled_in_class((storage.foldername(name))[1])
        )
      )
    )
  );
drop policy if exists storage_class_scoped_insert on storage.objects;
create policy storage_class_scoped_insert on storage.objects
  for insert to authenticated
  with check (
    (
      bucket_id = 'class-materials'
      and (
        public.get_my_role() = 'admin'
        or public.teaches_class((storage.foldername(name))[1])
        or (storage.foldername(name))[1] = public.my_teacher_id()
        or (
          (storage.foldername(name))[2] = 'homework'
          and public.enrolled_in_class((storage.foldername(name))[1])
        )
      )
    )
    or (
      bucket_id = 'homework-submissions'
      and (storage.foldername(name))[2] = 'submissions'
      and (storage.foldername(name))[3] = public.my_student_id()
      and public.enrolled_in_class((storage.foldername(name))[1])
    )
  );
drop policy if exists storage_class_teacher_update on storage.objects;
create policy storage_class_teacher_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('class-materials', 'homework-submissions')
    and (
      public.get_my_role() = 'admin'
      or public.teaches_class((storage.foldername(name))[1])
    )
  );
drop policy if exists storage_class_teacher_delete on storage.objects;
create policy storage_class_teacher_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('class-materials', 'homework-submissions')
    and (
      public.get_my_role() = 'admin'
      or public.teaches_class((storage.foldername(name))[1])
    )
  );

-- ── Student receipt + material counters: service-only mutations ─────────────
create or replace function public.submit_invoice_receipt_secure(
  p_invoice_id text,
  p_child_id text,
  p_actor_id uuid,
  p_receipt_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text;
  actor_student_id text;
  actor_parent_id text;
  invoices jsonb;
  output_value jsonb;
  matched_count integer;
begin
  select role into actor_role from public.profiles where id = p_actor_id;
  select id::text into actor_student_id
  from public.students where user_id::text = p_actor_id::text limit 1;
  select id::text into actor_parent_id
  from public.parents where user_id::text = p_actor_id::text limit 1;

  if actor_role = 'student' then
    p_child_id := actor_student_id;
  elsif actor_role = 'parent' then
    if not public.parent_id_has_student(actor_parent_id, p_child_id) then
      raise exception 'forbidden';
    end if;
  else
    raise exception 'forbidden';
  end if;

  if p_receipt_path is null
     or p_receipt_path = ''
     or p_receipt_path not like p_child_id || '/%' then
    raise exception 'invalid_receipt';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('kv_invoices:global', 0));
  insert into public.kv_invoices(id, value, updated_at)
  values ('global', '[]'::jsonb, now())
  on conflict (id) do nothing;
  select value into invoices
  from public.kv_invoices where id = 'global' for update;
  invoices := case when jsonb_typeof(invoices) = 'array'
    then invoices else '[]'::jsonb end;

  select count(*) into matched_count
  from jsonb_array_elements(invoices) item
  where item->>'child_id' = p_child_id
    and item->>'status' = 'pending'
    and (p_invoice_id = 'ALL' or item->>'id' = p_invoice_id);
  if matched_count = 0 then raise exception 'invoice_not_found'; end if;

  select coalesce(jsonb_agg(
    case
      when item->>'child_id' = p_child_id
       and item->>'status' = 'pending'
       and (p_invoice_id = 'ALL' or item->>'id' = p_invoice_id)
      then item || jsonb_build_object(
        'status', 'pending_verification',
        'submitted_by', actor_role,
        'submitted_at', now(),
        'receipt_path', p_receipt_path
      )
      else item
    end
  ), '[]'::jsonb) into output_value
  from jsonb_array_elements(invoices) item;

  update public.kv_invoices
  set value = output_value, updated_at = now()
  where id = 'global';
  return jsonb_build_object('updated', matched_count);
end;
$$;

revoke all on function public.submit_invoice_receipt_secure(text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.submit_invoice_receipt_secure(text, text, uuid, text)
  to service_role;

create or replace function public.increment_class_material_download_secure(
  p_material_id text
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.class_materials
  set download_count = coalesce(download_count, 0) + 1
  where id = p_material_id;
$$;

revoke all on function public.increment_class_material_download_secure(text)
  from public, anon, authenticated;
grant execute on function public.increment_class_material_download_secure(text)
  to service_role;

-- ============================================================================
-- End of canonical schema.
-- ============================================================================
