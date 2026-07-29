-- Student class discovery and teacher-managed registration workflow.
-- Class requests are API-only; the service-role API validates the actor and
-- the RPC below performs the approval + roster mutation atomically.

create table if not exists public.class_registration_requests (
  id                 uuid primary key default gen_random_uuid(),
  student_id         text not null references public.students(id) on delete cascade,
  requested_class_id text not null references public.classes(id) on delete cascade,
  assigned_class_id  text references public.classes(id) on delete set null,
  source             text not null default 'class'
                     check (source in ('class', 'material')),
  resource_id        text,
  student_note       text,
  teacher_note       text,
  status             text not null default 'pending'
                     check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by        uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  reviewed_at        timestamptz
);

create unique index if not exists class_registration_one_pending_idx
  on public.class_registration_requests (student_id, requested_class_id)
  where status = 'pending';
create index if not exists class_registration_requested_status_idx
  on public.class_registration_requests (requested_class_id, status, created_at desc);
create index if not exists class_registration_student_idx
  on public.class_registration_requests (student_id, created_at desc);

alter table public.class_registration_requests enable row level security;
revoke all on public.class_registration_requests from anon, authenticated;
grant select, insert, update, delete on public.class_registration_requests to service_role;

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

-- Admission approval creates a login/profile only. If the applicant selected a
-- class, a pending class request is created for that class's teacher instead of
-- the admin directly changing the roster.
create or replace function public.approve_enrollment_request_secure(
  p_enrollment_id text,
  p_assigned_class_id text,
  p_auth_user_id uuid,
  p_actor_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row public.enrollment_requests%rowtype;
  student_id_value text := 'enr_' || p_enrollment_id;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'admin'
  ) then
    raise exception 'forbidden';
  end if;

  select * into request_row
  from public.enrollment_requests
  where id::text = p_enrollment_id
  for update;
  if not found then raise exception 'enrollment_not_found'; end if;
  if request_row.status <> 'pending' then
    raise exception 'enrollment_not_pending';
  end if;

  if p_assigned_class_id is not null and not exists (
    select 1 from public.classes where id = p_assigned_class_id
  ) then
    raise exception 'class_not_found';
  end if;

  insert into public.profiles (
    id, email, full_name, role, must_reset_password
  ) values (
    p_auth_user_id, lower(request_row.email), request_row.full_name,
    'student', true
  )
  on conflict (id) do update
  set role = 'student', must_reset_password = true;

  insert into public.students (
    id, user_id, full_name, email, dob, school, grade,
    learning_type, created_at
  ) values (
    student_id_value, p_auth_user_id, request_row.full_name,
    lower(request_row.email), request_row.dob, request_row.school,
    request_row.grade, 'hybrid', now()
  )
  on conflict (id) do update
  set user_id = excluded.user_id,
      full_name = excluded.full_name,
      email = excluded.email,
      dob = excluded.dob,
      school = excluded.school,
      grade = excluded.grade;

  if p_assigned_class_id is not null then
    insert into public.class_registration_requests (
      student_id, requested_class_id, source, student_note
    ) values (
      student_id_value,
      p_assigned_class_id,
      'class',
      request_row.note
    )
    on conflict (student_id, requested_class_id)
      where status = 'pending'
    do nothing;
  end if;

  update public.enrollment_requests
  set status = 'approved',
      assigned_class_id = p_assigned_class_id,
      account_username = lower(request_row.email),
      supabase_user_id = p_auth_user_id,
      reviewed_at = now(),
      reject_reason = null
  where id::text = p_enrollment_id;

  return student_id_value;
end;
$$;
