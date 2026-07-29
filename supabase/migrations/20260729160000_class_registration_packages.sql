-- Persist the package and tuition snapshot selected by a student when asking
-- to join a class. Package keys match the existing tuition/material access
-- model: online, advanced, and offline.

alter table public.class_registration_requests
  add column if not exists requested_package text,
  add column if not exists requested_unit_price numeric(12, 0),
  add column if not exists tuition_period text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.class_registration_requests'::regclass
      and conname = 'class_registration_requested_package_check'
  ) then
    alter table public.class_registration_requests
      add constraint class_registration_requested_package_check
      check (requested_package in ('online', 'advanced', 'offline'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.class_registration_requests'::regclass
      and conname = 'class_registration_requested_unit_price_check'
  ) then
    alter table public.class_registration_requests
      add constraint class_registration_requested_unit_price_check
      check (requested_unit_price is null or requested_unit_price >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.class_registration_requests'::regclass
      and conname = 'class_registration_tuition_period_check'
  ) then
    alter table public.class_registration_requests
      add constraint class_registration_tuition_period_check
      check (tuition_period is null or tuition_period ~ '^[0-9]{4}-[0-9]{2}$');
  end if;
end
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

revoke all on function public.review_class_registration_request_secure(
  uuid, text, text, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.review_class_registration_request_secure(
  uuid, text, text, text, uuid, text
) to service_role;
