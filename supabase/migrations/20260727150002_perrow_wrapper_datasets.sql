-- Per-row tables for wrapper-backed KV datasets (slices 2-6):
-- student_comments, schedule_notifications (+ per-user read state),
-- class_materials, homework_attachments, class_teacher_overrides.

-- ── Helper functions ────────────────────────────────────────────────────────
-- A teacher "teaches" a student when the student is enrolled in one of the
-- teacher's classes.
create or replace function public.teaches_student(p_student_id text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.classes c
    where c.tutor_id::text = public.my_teacher_id()
      and exists (
        select 1 from unnest(c.student_ids) sid where sid::text = p_student_id
      )
  )
$$;

-- A parent owns a student when students.parent_id matches the caller's parent id.
create or replace function public.is_my_child(p_student_id text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.students s
    where s.id::text = p_student_id and s.parent_id::text = public.my_parent_id()
  )
$$;

-- ── student_comments (slice 2) ──────────────────────────────────────────────
create table if not exists public.student_comments (
  id           text primary key,
  student_id   text not null,
  comment_text text not null,
  rating       integer check (rating between 1 and 5),
  comment_date text not null,
  created_at   timestamptz not null default now()
);
create index if not exists student_comments_student_idx on public.student_comments (student_id);

alter table public.student_comments enable row level security;
grant select, insert, update, delete on public.student_comments to authenticated;

drop policy if exists student_comments_read on public.student_comments;
create policy student_comments_read on public.student_comments
  for select to authenticated using (
    public.get_my_role() = 'admin'
    or public.teaches_student(student_id)
    or student_id = public.my_student_id()
    or public.is_my_child(student_id)
  );

drop policy if exists student_comments_teacher_write on public.student_comments;
create policy student_comments_teacher_write on public.student_comments
  for all to authenticated
  using (public.get_my_role() = 'admin' or public.teaches_student(student_id))
  with check (public.get_my_role() = 'admin' or public.teaches_student(student_id));

-- ── schedule_notifications (slice 3) ────────────────────────────────────────
create table if not exists public.schedule_notifications (
  id         text primary key,
  class_id   text not null,
  class_name text,
  message    text not null,
  created_at timestamptz not null default now()
);
create index if not exists schedule_notifications_class_idx on public.schedule_notifications (class_id);

alter table public.schedule_notifications enable row level security;
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

-- Per-user read state (replaces the old shared is_read flag).
create table if not exists public.schedule_notification_reads (
  notification_id text not null references public.schedule_notifications(id) on delete cascade,
  user_id         uuid not null default auth.uid(),
  read_at         timestamptz not null default now(),
  primary key (notification_id, user_id)
);

alter table public.schedule_notification_reads enable row level security;
grant select, insert, update, delete on public.schedule_notification_reads to authenticated;

drop policy if exists schedule_reads_owner on public.schedule_notification_reads;
create policy schedule_reads_owner on public.schedule_notification_reads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── class_materials (slice 4) ───────────────────────────────────────────────
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

alter table public.class_materials enable row level security;
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

-- Enrolled students may update the download counter only.
drop policy if exists class_materials_student_download on public.class_materials;
create policy class_materials_student_download on public.class_materials
  for update to authenticated
  using (public.enrolled_in_class(class_id))
  with check (public.enrolled_in_class(class_id));

-- ── homework_attachments (slice 5) ──────────────────────────────────────────
create table if not exists public.homework_attachments (
  id          text primary key,
  homework_id text not null,
  file_url    text not null,
  file_name   text,
  file_size   text,
  file_type   text,
  created_at  timestamptz not null default now()
);
create index if not exists homework_attachments_hw_idx on public.homework_attachments (homework_id);

alter table public.homework_attachments enable row level security;
grant select, insert, update, delete on public.homework_attachments to authenticated;

-- File links are low-sensitivity; readable by any authenticated user, writable
-- only by teachers/admins (route guard already restricts who reaches the editor).
drop policy if exists homework_attachments_read on public.homework_attachments;
create policy homework_attachments_read on public.homework_attachments
  for select to authenticated using (true);

drop policy if exists homework_attachments_teacher_write on public.homework_attachments;
create policy homework_attachments_teacher_write on public.homework_attachments
  for all to authenticated
  using (public.get_my_role() in ('teacher', 'admin'))
  with check (public.get_my_role() in ('teacher', 'admin'));

-- ── class_teacher_overrides (slice 6) ───────────────────────────────────────
create table if not exists public.class_teacher_overrides (
  class_id   text primary key,
  teacher_id text not null,
  updated_at timestamptz not null default now()
);

alter table public.class_teacher_overrides enable row level security;
grant select, insert, update, delete on public.class_teacher_overrides to authenticated;

-- Reassignment map: readable by any authenticated user (used by analytics),
-- writable by admins only.
drop policy if exists class_overrides_read on public.class_teacher_overrides;
create policy class_overrides_read on public.class_teacher_overrides
  for select to authenticated using (true);

drop policy if exists class_overrides_admin_write on public.class_teacher_overrides;
create policy class_overrides_admin_write on public.class_teacher_overrides
  for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
