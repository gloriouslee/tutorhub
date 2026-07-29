-- Self-service student accounts start with an empty student profile and no
-- class membership. They can browse the catalog and request classes later.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_role text;
  self_service_student boolean;
begin
  requested_role := coalesce(new.raw_app_meta_data->>'role', 'student');
  if requested_role not in ('student', 'parent', 'teacher', 'admin') then
    requested_role := 'student';
  end if;

  self_service_student :=
    requested_role = 'student'
    and coalesce(new.raw_user_meta_data->>'self_service_signup', 'false') = 'true';

  insert into public.profiles (
    id, email, full_name, role, must_reset_password
  )
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    requested_role,
    requested_role <> 'admin' and not self_service_student
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name);

  if self_service_student then
    insert into public.students (
      id,
      user_id,
      full_name,
      email,
      dob,
      school,
      grade,
      learning_type,
      created_at
    )
    values (
      'stu_' || new.id::text,
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
      lower(new.email),
      '',
      '',
      '',
      'hybrid',
      now()
    )
    on conflict (id) do update
    set user_id = excluded.user_id,
        full_name = excluded.full_name,
        email = excluded.email;
  end if;

  return new;
end;
$$;

-- Repair self-service accounts created while an older trigger was still active.
update public.profiles p
set must_reset_password = false
from auth.users u
where u.id = p.id
  and p.role = 'student'
  and coalesce(u.raw_user_meta_data->>'self_service_signup', 'false') = 'true';

insert into public.students (
  id, user_id, full_name, email, dob, school, grade, learning_type, created_at
)
select
  'stu_' || p.id::text,
  p.id,
  coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1)),
  lower(p.email),
  '', '', '', 'hybrid', now()
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'student'
  and coalesce(u.raw_user_meta_data->>'self_service_signup', 'false') = 'true'
  and not exists (
    select 1 from public.students s where s.user_id = p.id
  )
on conflict (id) do nothing;
