-- Repair package registration on installations that already had an older
-- constraint with the same name. `add ... if not exists` cannot correct a
-- stale definition, so replace it with the canonical three-package check.
alter table public.class_registration_requests
  drop constraint if exists class_registration_requested_package_check;

alter table public.class_registration_requests
  add constraint class_registration_requested_package_check
  check (requested_package is null or requested_package in ('online', 'advanced', 'offline'));

-- Remove an enrolment as one atomic lifecycle operation. Besides the visible
-- roster, clear package/tuition state and close the old approval so the student
-- can submit a fresh request when they return.
create or replace function public.teacher_remove_student_from_class_secure(
  p_class_id text,
  p_student_id text,
  p_teacher_id text,
  p_actor_id uuid
)
returns text[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  roster text[];
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'teacher'
  ) or not exists (
    select 1 from public.teachers
    where id::text = p_teacher_id and user_id = p_actor_id
  ) then
    raise exception 'forbidden';
  end if;

  select coalesce(student_ids, '{}'::text[])
  into roster
  from public.classes
  where id = p_class_id and tutor_id::text = p_teacher_id
  for update;

  if not found then raise exception 'class_not_found'; end if;

  roster := array_remove(roster, p_student_id);
  update public.classes set student_ids = roster where id = p_class_id;

  update public.kv_student_packages
  set value = coalesce(value, '{}'::jsonb) - p_student_id,
      updated_at = now()
  where id = p_class_id;

  update public.kv_tuition
  set value = case
        when jsonb_typeof(value->'students') = 'object'
          then jsonb_set(value, '{students}', (value->'students') - p_student_id, true)
        else value
      end,
      updated_at = now()
  where id = p_class_id;

  update public.kv_class_extra_students
  set value = case
        when jsonb_typeof(value) = 'array' then coalesce(
          (
            select jsonb_agg(entry)
            from jsonb_array_elements(value) entry
            where entry #>> '{}' <> p_student_id
          ),
          '[]'::jsonb
        )
        else '[]'::jsonb
      end,
      updated_at = now()
  where id = p_class_id;

  update public.class_registration_requests
  set status = 'cancelled',
      reviewed_by = p_actor_id,
      reviewed_at = now()
  where student_id = p_student_id
    and status = 'approved'
    and (
      assigned_class_id = p_class_id
      or (assigned_class_id is null and requested_class_id = p_class_id)
    );

  return roster;
end;
$$;

revoke all on function public.teacher_remove_student_from_class_secure(
  text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.teacher_remove_student_from_class_secure(
  text, text, text, uuid
) to service_role;

-- Clone the reusable teaching workspace while intentionally excluding every
-- student-specific dataset (roster, submissions, attendance, progress, XP,
-- payments and registration history).
create or replace function public.teacher_clone_class_secure(
  p_class_id text,
  p_teacher_id text,
  p_actor_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_class public.classes%rowtype;
  new_class_id text := 'cls_' || replace(gen_random_uuid()::text, '-', '');
  homework_row record;
  new_homework_id text;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'teacher'
  ) or not exists (
    select 1 from public.teachers
    where id::text = p_teacher_id and user_id = p_actor_id
  ) then
    raise exception 'forbidden';
  end if;

  select * into source_class
  from public.classes
  where id = p_class_id and tutor_id::text = p_teacher_id
  for share;
  if not found then raise exception 'class_not_found'; end if;

  insert into public.classes (
    id, class_name, subject, grade, learning_mode, tutor_id, classroom,
    zoom_link, schedule, student_ids, description, max_students, color, created_at
  ) values (
    new_class_id,
    source_class.class_name || ' (Bản sao)',
    source_class.subject,
    source_class.grade,
    source_class.learning_mode,
    source_class.tutor_id,
    source_class.classroom,
    source_class.zoom_link,
    source_class.schedule,
    '{}'::text[],
    source_class.description,
    source_class.max_students,
    source_class.color,
    now()
  );

  insert into public.kv_curriculum (id, value, updated_at)
  select new_class_id, value, now() from public.kv_curriculum where id = p_class_id;
  insert into public.kv_schedules (id, value, updated_at)
  select new_class_id, value, now() from public.kv_schedules where id = p_class_id;
  insert into public.kv_online_links (id, value, updated_at)
  select new_class_id, value, now() from public.kv_online_links where id = p_class_id;
  insert into public.kv_session_notes (id, value, updated_at)
  select new_class_id, value, now() from public.kv_session_notes where id = p_class_id;
  insert into public.kv_tuition (id, value, updated_at)
  select
    new_class_id,
    case
      when jsonb_typeof(value->'students') = 'object'
        then jsonb_set(value, '{students}', '{}'::jsonb, true)
      else value
    end,
    now()
  from public.kv_tuition where id = p_class_id;

  for homework_row in
    select id, data from public.teacher_homework where class_id = p_class_id
  loop
    new_homework_id := 'hw_' || replace(gen_random_uuid()::text, '-', '');
    insert into public.teacher_homework (id, class_id, data, created_at)
    values (
      new_homework_id,
      new_class_id,
      homework_row.data || jsonb_build_object(
        'id', new_homework_id,
        'class_id', new_class_id
      ),
      now()
    );

    insert into public.homework_attachments (
      id, homework_id, class_id, file_url, file_name, file_size, file_type, created_at
    )
    select
      'att_' || replace(gen_random_uuid()::text, '-', ''),
      new_homework_id,
      new_class_id,
      file_url,
      file_name,
      file_size,
      file_type,
      now()
    from public.homework_attachments
    where homework_id = homework_row.id;
  end loop;

  insert into public.class_materials (
    id, class_id, title, description, file_url, file_type, file_size, category,
    uploaded_by, created_at, download_count, packages, pinned, kind
  )
  select
    'mat_' || replace(gen_random_uuid()::text, '-', ''),
    new_class_id,
    title,
    description,
    file_url,
    file_type,
    file_size,
    category,
    uploaded_by,
    now(),
    0,
    packages,
    pinned,
    kind
  from public.class_materials
  where class_id = p_class_id;

  insert into public.teacher_materials (
    id, teacher_id, class_id, published, data, created_at
  )
  select
    cloned.id,
    source_material.teacher_id,
    new_class_id,
    source_material.published,
    source_material.data || jsonb_build_object(
      'id', cloned.id,
      'classId', new_class_id,
      'class_id', new_class_id
    ),
    now()
  from public.teacher_materials source_material
  cross join lateral (
    select 'course_' || replace(gen_random_uuid()::text, '-', '') as id
    where source_material.id is not null
  ) cloned
  where source_material.class_id = p_class_id
    and source_material.teacher_id = p_teacher_id;

  return new_class_id;
end;
$$;

revoke all on function public.teacher_clone_class_secure(
  text, text, uuid
) from public, anon, authenticated;
grant execute on function public.teacher_clone_class_secure(
  text, text, uuid
) to service_role;

-- Delete a teacher-owned class and its non-FK class-scoped content. FK-backed
-- records still follow their declared cascade/set-null behavior.
create or replace function public.teacher_delete_class_secure(
  p_class_id text,
  p_teacher_id text,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'teacher'
  ) or not exists (
    select 1 from public.teachers
    where id::text = p_teacher_id and user_id = p_actor_id
  ) then
    raise exception 'forbidden';
  end if;
  if not exists (
    select 1 from public.classes
    where id = p_class_id and tutor_id::text = p_teacher_id
  ) then
    raise exception 'class_not_found';
  end if;

  delete from public.homework_attachments where class_id = p_class_id;
  delete from public.hw_submissions where class_id = p_class_id;
  delete from public.teacher_homework where class_id = p_class_id;
  delete from public.class_attendance where class_id = p_class_id;
  delete from public.teacher_materials
    where class_id = p_class_id and teacher_id = p_teacher_id;
  delete from public.class_materials where class_id = p_class_id;
  delete from public.kv_curriculum where id = p_class_id;
  delete from public.kv_schedules where id = p_class_id;
  delete from public.kv_online_links where id = p_class_id;
  delete from public.kv_tuition where id = p_class_id;
  delete from public.kv_student_packages where id = p_class_id;
  delete from public.kv_session_notes where id = p_class_id;
  delete from public.kv_class_extra_students where id = p_class_id;
  delete from public.classes where id = p_class_id and tutor_id::text = p_teacher_id;
end;
$$;

revoke all on function public.teacher_delete_class_secure(
  text, text, uuid
) from public, anon, authenticated;
grant execute on function public.teacher_delete_class_secure(
  text, text, uuid
) to service_role;
