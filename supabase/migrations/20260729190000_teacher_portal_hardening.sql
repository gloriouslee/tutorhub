-- Teacher portal hardening: tenant-scoped reads, class-scoped notifications,
-- per-user notification state, and class-owned homework attachments.

alter table public.notifications
  add column if not exists sender_user_id uuid references auth.users(id) on delete set null;

with unique_teacher_names as (
  select full_name, min(user_id::text)::uuid as user_id
  from public.teachers
  where user_id is not null
  group by full_name
  having count(*) = 1
)
update public.notifications notification
set sender_user_id = teacher.user_id
from unique_teacher_names teacher
where notification.sender_user_id is null
  and notification.sent_by = teacher.full_name;

create index if not exists notifications_sender_created_idx
  on public.notifications (sender_user_id, created_at desc);
create index if not exists notifications_target_class_created_idx
  on public.notifications (target_role, target_class_id, created_at desc);

create table if not exists public.notification_reads (
  notification_id text not null references public.notifications(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  is_deleted boolean not null default false,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);
alter table public.notification_reads enable row level security;
grant select, insert, update, delete on public.notification_reads to authenticated;
drop policy if exists notification_reads_owner on public.notification_reads;
create policy notification_reads_owner on public.notification_reads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists students_scoped_select on public.students;
create policy students_scoped_select on public.students
  for select to authenticated
  using (
    user_id = auth.uid()
    or parent_id = public.my_parent_id()
    or public.get_my_role() = 'admin'
    or (
      public.get_my_role() = 'teacher'
      and public.teaches_student(id)
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
        target_class_id is null
        or (public.get_my_role() = 'teacher' and public.teaches_class(target_class_id))
        or (public.get_my_role() = 'student' and public.enrolled_in_class(target_class_id))
        or (
          public.get_my_role() = 'parent'
          and exists (
            select 1
            from public.classes c
            join public.students s on s.id = any(c.student_ids)
            where c.id = notifications.target_class_id
              and s.parent_id = public.my_parent_id()
          )
        )
      )
    )
  );

alter table public.homework_attachments
  add column if not exists class_id text references public.classes(id) on delete cascade;

update public.homework_attachments attachment
set class_id = homework.class_id
from public.teacher_homework homework
where attachment.class_id is null
  and homework.id = attachment.homework_id;

-- Preserve legacy submission history while switching every client to
-- hw_submissions. Curriculum homework IDs are resolved from their class blob.
insert into public.hw_submissions (
  id, homework_id, student_id, class_id, data, created_at
)
select
  submission.id,
  submission.homework_id,
  submission.student_id,
  coalesce(homework.class_id, curriculum.id),
  to_jsonb(submission) || jsonb_build_object(
    'class_id', coalesce(homework.class_id, curriculum.id)
  ),
  coalesce(submission.submitted_at, now())
from public.submissions submission
left join public.teacher_homework homework
  on homework.id = submission.homework_id
left join public.kv_curriculum curriculum
  on jsonb_path_exists(
    curriculum.data,
    '$[*].sessions[*].lessons[*] ? (@.id == $lesson_id)',
    jsonb_build_object('lesson_id', submission.homework_id)
  )
where coalesce(homework.class_id, curriculum.id) is not null
on conflict (id) do nothing;

create index if not exists homework_attachments_class_idx
  on public.homework_attachments (class_id, homework_id);

drop policy if exists homework_attachments_read on public.homework_attachments;
create policy homework_attachments_read on public.homework_attachments
  for select to authenticated
  using (
    public.get_my_role() = 'admin'
    or public.teaches_class(class_id)
    or public.enrolled_in_class(class_id)
    or exists (
      select 1
      from public.classes c
      join public.students s on s.id = any(c.student_ids)
      where c.id = homework_attachments.class_id
        and s.parent_id = public.my_parent_id()
    )
  );

drop policy if exists homework_attachments_teacher_write on public.homework_attachments;
create policy homework_attachments_teacher_write on public.homework_attachments
  for all to authenticated
  using (public.get_my_role() = 'admin' or public.teaches_class(class_id))
  with check (public.get_my_role() = 'admin' or public.teaches_class(class_id));

-- Profile data now lives in teachers/profiles. Keep only payment configuration
-- in the student/parent-readable settings blob.
update public.kv_teacher_settings
set data = data
  - 'full_name'
  - 'email'
  - 'phone'
  - 'specialization'
  - 'bio'
  - 'avatar_url'
where data ?| array['full_name','email','phone','specialization','bio','avatar_url'];
