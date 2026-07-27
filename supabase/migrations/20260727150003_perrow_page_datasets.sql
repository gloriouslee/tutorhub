-- Per-row tables for the remaining high-traffic KV datasets (slices 7-11):
-- teacher_homework, teacher_extra_classes, hw_submissions, class_attendance,
-- teacher_materials.
--
-- These use TEXT ids to match the application's actual id model ("c1", "s1",
-- "cls_...", "mat_...") rather than the legacy UUID tables in schema.sql, which
-- the current app does not use. Each row keeps its scope columns (for RLS) plus
-- a jsonb `data` payload holding the full domain object (preserves shapes).

-- ── teacher_homework (slice 7 / #1) ─────────────────────────────────────────
create table if not exists public.teacher_homework (
  id         text primary key,
  class_id   text not null,
  data       jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists teacher_homework_class_idx on public.teacher_homework (class_id);

alter table public.teacher_homework enable row level security;
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

-- ── teacher_extra_classes (slice 8 / #3) ────────────────────────────────────
create table if not exists public.teacher_extra_classes (
  id          text primary key,
  tutor_id    text not null,
  student_ids text[] not null default '{}',
  data        jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists teacher_extra_classes_tutor_idx on public.teacher_extra_classes (tutor_id);

alter table public.teacher_extra_classes enable row level security;
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

-- ── hw_submissions (slice 9 / #2) ───────────────────────────────────────────
create table if not exists public.hw_submissions (
  id           text primary key,
  homework_id  text not null,
  student_id   text not null,
  class_id     text,
  data         jsonb not null,
  submitted_at timestamptz not null default now()
);
create index if not exists hw_submissions_hw_idx on public.hw_submissions (homework_id);
create index if not exists hw_submissions_student_idx on public.hw_submissions (student_id);

alter table public.hw_submissions enable row level security;
grant select, insert, update, delete on public.hw_submissions to authenticated;

-- Student owns own submissions; the teacher of the submission's class may
-- read/grade (class_id is set at submit time).
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

-- ── class_attendance (slice 10 / #4) ────────────────────────────────────────
create table if not exists public.class_attendance (
  class_id        text not null,
  student_id      text not null,
  attendance_date text not null,
  data            jsonb not null,
  primary key (class_id, student_id, attendance_date)
);

alter table public.class_attendance enable row level security;
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

-- ── teacher_materials (slice 11 / #5) ───────────────────────────────────────
create table if not exists public.teacher_materials (
  id         text primary key,
  teacher_id text not null,
  class_id   text,
  published  boolean not null default false,
  data       jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists teacher_materials_teacher_idx on public.teacher_materials (teacher_id);

alter table public.teacher_materials enable row level security;
grant select, insert, update, delete on public.teacher_materials to authenticated;

-- Owner teacher/admin manage; any authenticated user may read PUBLISHED items
-- (student marketplace catalog).
drop policy if exists teacher_materials_read on public.teacher_materials;
create policy teacher_materials_read on public.teacher_materials
  for select to authenticated using (
    published
    or public.get_my_role() = 'admin'
    or teacher_id = public.my_teacher_id()
  );
drop policy if exists teacher_materials_write on public.teacher_materials;
create policy teacher_materials_write on public.teacher_materials
  for all to authenticated
  using (public.get_my_role() = 'admin' or teacher_id = public.my_teacher_id())
  with check (public.get_my_role() = 'admin' or teacher_id = public.my_teacher_id());
