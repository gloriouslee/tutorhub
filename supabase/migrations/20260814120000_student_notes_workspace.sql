-- Append-only, attributable student notes for the teacher student workspace.

alter table public.notifications
  add column if not exists target_student_id text references public.students(id) on delete cascade;
create index if not exists notifications_target_student_created_idx
  on public.notifications(target_student_id, created_at desc);

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

alter table public.student_comments
  add column if not exists author_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists author_name text,
  add column if not exists class_id text,
  add column if not exists visibility text not null default 'shared',
  add column if not exists tag text not null default 'general',
  add column if not exists updated_at timestamptz not null default now();

update public.student_comments
set author_name = coalesce(nullif(author_name, ''), 'Giáo viên')
where author_name is null or author_name = '';

alter table public.student_comments
  alter column author_name set default 'Giáo viên',
  alter column author_name set not null;

alter table public.student_comments
  drop constraint if exists student_comments_visibility_check,
  add constraint student_comments_visibility_check
    check (visibility in ('private', 'shared'));

alter table public.student_comments
  drop constraint if exists student_comments_tag_check,
  add constraint student_comments_tag_check
    check (tag in ('general', 'academic', 'attendance', 'homework', 'wellbeing'));

create index if not exists student_comments_student_created_idx
  on public.student_comments(student_id, created_at desc);
create index if not exists student_comments_author_idx
  on public.student_comments(author_user_id, created_at desc);

drop policy if exists student_comments_read on public.student_comments;
create policy student_comments_read on public.student_comments
  for select to authenticated using (
    public.get_my_role() = 'admin'
    or public.teaches_student(student_id)
    or (
      visibility = 'shared'
      and (
        student_id = public.my_student_id()
        or public.is_my_child(student_id)
      )
    )
  );

drop policy if exists student_comments_teacher_write on public.student_comments;
create policy student_comments_teacher_write on public.student_comments
  for all to authenticated
  using (
    public.get_my_role() = 'admin'
    or (
      public.teaches_student(student_id)
      and author_user_id = auth.uid()
    )
  )
  with check (
    public.get_my_role() = 'admin'
    or (
      public.teaches_student(student_id)
      and author_user_id = auth.uid()
    )
  );
