-- Provision OAuth (Google) sign-ins as self-service students.
--
-- Before this migration handle_new_user() only treated an account as a
-- self-service student when the client passed user_metadata.self_service_signup,
-- which the OAuth flow never sets. A Google sign-in therefore got
--   * must_reset_password = true  -> the route guard trapped them on
--     /reset-password asking for a password they never had, and
--   * no public.students row      -> no studentId, so the student portal was empty.
--
-- OAuth identities are verified by the provider, so they need neither a password
-- nor an email confirmation step. Detect them via app_metadata.provider (set by
-- GoTrue: 'email' for password accounts, 'google' / etc. for OAuth) and treat
-- them exactly like a self-service signup.

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

  -- 'email' is the password provider; anything else is a federated identity.
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

-- Repair accounts created by the previous version of the trigger: a federated
-- identity that was flagged as needing a password reset, plus any missing
-- students row.
update public.profiles p
set must_reset_password = false
from auth.users u
where u.id = p.id
  and p.role = 'student'
  and p.must_reset_password
  and coalesce(u.raw_app_meta_data->>'provider', 'email') <> 'email';

insert into public.students (
  id, user_id, full_name, email, dob, school, grade, learning_type, created_at
)
select
  'stu_' || u.id::text,
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data->>'full_name', ''),
    nullif(u.raw_user_meta_data->>'name', ''),
    split_part(u.email, '@', 1)
  ),
  lower(u.email),
  '', '', '', 'hybrid', now()
from auth.users u
join public.profiles p on p.id = u.id
where p.role = 'student'
  and coalesce(u.raw_app_meta_data->>'provider', 'email') <> 'email'
  and not exists (select 1 from public.students s where s.user_id = u.id)
on conflict (id) do nothing;
