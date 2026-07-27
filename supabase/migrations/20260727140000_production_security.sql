-- TutorHub production security baseline.
-- IMPORTANT: create and verify the first real admin before applying this file.
-- Apply in staging first, run the RLS integration suite, then promote unchanged.

begin;

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists must_reset_password boolean not null default true;

alter table public.enrollment_requests
  drop column if exists account_password;

-- Roles are authorization data. Move them out of caller-editable user_metadata.
update auth.users u
set raw_app_meta_data =
      coalesce(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', p.role),
    raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) - 'role'
from public.profiles p
where p.id = u.id;

update public.profiles
set must_reset_password = (role <> 'admin');

-- Scrub old JSON-managed accounts. These rows are retained only for migration
-- visibility; application authorization must never read this table.
update public.kv_managed_users
set value = coalesce(
  (
    select jsonb_agg(item - 'password')
    from jsonb_array_elements(
      case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end
    ) item
  ),
  '[]'::jsonb
)
where value::text like '%"password"%';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_role text;
begin
  requested_role := coalesce(new.raw_app_meta_data->>'role', 'student');
  if requested_role not in ('student', 'parent', 'teacher', 'admin') then
    requested_role := 'student';
  end if;

  insert into public.profiles (
    id, email, full_name, role, must_reset_password
  )
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    requested_role,
    requested_role <> 'admin'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$$;

-- SECURITY DEFINER helpers prevent recursive RLS lookups. No helper is
-- executable by anon/public.
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
  )
$$;

create or replace function public.parent_has_student(p_student_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.students
    where id::text = p_student_id
      and parent_id::text = public.my_parent_id()
  )
$$;

revoke all on function public.get_my_role() from public, anon;
revoke all on function public.my_student_id() from public, anon;
revoke all on function public.my_teacher_id() from public, anon;
revoke all on function public.my_parent_id() from public, anon;
revoke all on function public.teaches_class(text) from public, anon;
revoke all on function public.enrolled_in_class(text) from public, anon;
revoke all on function public.parent_has_student(text) from public, anon;
grant execute on function public.get_my_role() to authenticated, service_role;
grant execute on function public.my_student_id() to authenticated, service_role;
grant execute on function public.my_teacher_id() to authenticated, service_role;
grant execute on function public.my_parent_id() to authenticated, service_role;
grant execute on function public.teaches_class(text) to authenticated, service_role;
grant execute on function public.enrolled_in_class(text) to authenticated, service_role;
grant execute on function public.parent_has_student(text) to authenticated, service_role;

-- Drop every historic policy (including every phase1_open_all) and start from
-- no access. The explicit policies below are the complete allow-list.
do $$
declare
  policy_row record;
  table_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname, policy_row.schemaname, policy_row.tablename
    );
  end loop;

  for table_row in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', table_row.tablename);
    execute format('alter table public.%I force row level security', table_row.tablename);
  end loop;
end
$$;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all tables in schema public from authenticated;
grant usage on schema public to authenticated;
grant execute on function public.get_my_role() to authenticated, service_role;
grant execute on function public.my_student_id() to authenticated, service_role;
grant execute on function public.my_teacher_id() to authenticated, service_role;
grant execute on function public.my_parent_id() to authenticated, service_role;
grant execute on function public.teaches_class(text) to authenticated, service_role;
grant execute on function public.enrolled_in_class(text) to authenticated, service_role;
grant execute on function public.parent_has_student(text) to authenticated, service_role;

-- Profiles: a user reads their own row. Admin reads all. Column grants prevent
-- a user from changing role or must_reset_password directly.
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
create policy profiles_self_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.get_my_role() = 'admin');
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

grant select on public.students, public.parents, public.teachers, public.classes
  to authenticated;
create policy students_scoped_select on public.students
  for select to authenticated
  using (
    user_id::text = auth.uid()::text
    or parent_id::text = public.my_parent_id()
    or public.get_my_role() in ('teacher', 'admin')
  );
create policy parents_scoped_select on public.parents
  for select to authenticated
  using (user_id::text = auth.uid()::text or public.get_my_role() = 'admin');
create policy teachers_authenticated_select on public.teachers
  for select to authenticated using (true);
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
      select 1 from public.students s
      where s.parent_id::text = public.my_parent_id()
        and exists (
          select 1
          from unnest(classes.student_ids) student_id
          where student_id::text = s.id::text
        )
    )
  );

grant select on public.payments, public.attendance, public.homework,
  public.submissions, public.materials, public.notifications,
  public.app_exam_scores, public.exam_scores to authenticated;

create policy payments_scoped_select on public.payments
  for select to authenticated
  using (
    student_id::text = public.my_student_id()
    or public.parent_has_student(student_id::text)
    or public.teaches_class(class_id::text)
    or public.get_my_role() = 'admin'
  );
create policy attendance_scoped_select on public.attendance
  for select to authenticated
  using (
    student_id::text = public.my_student_id()
    or public.parent_has_student(student_id::text)
    or public.teaches_class(class_id::text)
    or public.get_my_role() = 'admin'
  );
create policy homework_scoped_select on public.homework
  for select to authenticated
  using (
    public.enrolled_in_class(class_id::text)
    or public.teaches_class(class_id::text)
    or public.get_my_role() = 'admin'
  );
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
create policy notifications_role_select on public.notifications
  for select to authenticated
  using (
    public.get_my_role() = 'admin'
    or target_role = 'all'
    or target_role = public.get_my_role()
  );
create policy app_exam_scores_scoped_select on public.app_exam_scores
  for select to authenticated
  using (
    student_ref::text = public.my_student_id()
    or public.teaches_class(class_id::text)
    or public.get_my_role() = 'admin'
  );
create policy exam_scores_scoped_select on public.exam_scores
  for select to authenticated
  using (
    student_id::text = public.my_student_id()
    or public.parent_has_student(student_id::text)
    or public.teaches_class(class_id::text)
    or public.get_my_role() = 'admin'
  );

-- Enrollment requests and purchase transactions are API-only. No direct
-- authenticated or anon policies are created.

-- Curriculum contains answer keys: never selectable by students/parents.
grant select, insert, update, delete on public.kv_curriculum to authenticated;
create policy curriculum_teacher_admin_all on public.kv_curriculum
  for all to authenticated
  using (public.get_my_role() = 'admin' or public.teaches_class(id::text))
  with check (public.get_my_role() = 'admin' or public.teaches_class(id::text));

grant select on public.kv_exam_results to authenticated;
create policy exam_results_scoped_select on public.kv_exam_results
  for select to authenticated
  using (
    id like '%\_' || public.my_student_id() escape '\'
    or public.teaches_class(split_part(id, '_', 1))
    or public.get_my_role() = 'admin'
  );
grant select on public.kv_exam_submissions to authenticated;
create policy exam_registry_teacher_select on public.kv_exam_submissions
  for select to authenticated
  using (
    public.teaches_class(split_part(id, '_', 1))
    or public.get_my_role() = 'admin'
  );

-- Class-scoped KV data. Writes remain limited to the class teacher/admin;
-- students only receive rows for classes they are enrolled in.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'kv_schedules', 'kv_online_links', 'kv_tuition',
    'kv_student_packages', 'kv_session_notes', 'kv_class_extra_students'
  ]
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using
       (public.get_my_role() = ''admin'' or public.teaches_class(id)
        or public.enrolled_in_class(id))',
      table_name || '_scoped_select', table_name
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using
       (public.get_my_role() = ''admin'' or public.teaches_class(id))
       with check (public.get_my_role() = ''admin'' or public.teaches_class(id))',
      table_name || '_teacher_write', table_name
    );
  end loop;
end
$$;

grant select on public.kv_teacher_settings to authenticated;
grant insert, update, delete on public.kv_teacher_settings to authenticated;
create policy teacher_settings_read on public.kv_teacher_settings
  for select to authenticated using (true);
create policy teacher_settings_owner_write on public.kv_teacher_settings
  for all to authenticated
  using (public.get_my_role() = 'admin' or id::text = public.my_teacher_id())
  with check (public.get_my_role() = 'admin' or id::text = public.my_teacher_id());

-- All other legacy/global KV tables remain default-deny. Server APIs using the
-- service role are the only supported access path.

create table if not exists public.api_rate_limits (
  scope text not null,
  key_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  primary key (scope, key_hash)
);
alter table public.api_rate_limits enable row level security;
alter table public.api_rate_limits force row level security;
revoke all on public.api_rate_limits from anon, authenticated;

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
  perform 1
  from public.classes
  where id::text = p_assigned_class_id
  for update;
  if not found then raise exception 'class_not_found'; end if;

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

  update public.classes
  set student_ids =
    case
      when student_id_value = any(coalesce(student_ids, '{}'::text[]))
      then student_ids
      else array_append(coalesce(student_ids, '{}'::text[]), student_id_value)
    end
  where id::text = p_assigned_class_id;

  if request_row.package is not null then
    insert into public.kv_student_packages(id, value, updated_at)
    values (
      p_assigned_class_id,
      jsonb_build_object(student_id_value, request_row.package),
      now()
    )
    on conflict (id) do update
    set value = coalesce(public.kv_student_packages.value, '{}'::jsonb)
                || jsonb_build_object(student_id_value, request_row.package),
        updated_at = now();
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

create or replace function public.delete_enrollment_request_secure(
  p_enrollment_id text,
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

  update public.classes
  set student_ids = array_remove(coalesce(student_ids, '{}'::text[]), student_id_value)
  where id::text = request_row.assigned_class_id::text;
  delete from public.students where id::text = student_id_value;
  delete from public.enrollment_requests where id::text = p_enrollment_id;
  return request_row.supabase_user_id::text;
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

create or replace function public.replace_admin_entity_rows_secure(
  p_table_name text,
  p_rows jsonb,
  p_actor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  update_columns text;
begin
  if p_table_name not in (
    'students', 'teachers', 'classes', 'payments', 'attendance', 'notifications'
  ) then
    raise exception 'invalid_entity';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'invalid_rows';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'admin'
  ) then
    raise exception 'forbidden';
  end if;

  select string_agg(
    format('%1$I = excluded.%1$I', column_name),
    ', ' order by ordinal_position
  )
  into update_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = p_table_name
    and column_name <> 'id';

  execute format(
    'insert into public.%1$I
       select * from jsonb_populate_recordset(null::public.%1$I, $1)
     on conflict (id) do update set %2$s',
    p_table_name,
    update_columns
  ) using p_rows;

  execute format(
    'delete from public.%I
     where not exists (
       select 1 from jsonb_array_elements($1) row_value
       where row_value->>''id'' = id::text
     )',
    p_table_name
  ) using p_rows;
  return true;
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
      if not exists (
        select 1 from public.students
        where id::text = p_child_id
          and parent_id::text = actor_parent_id
      ) then raise exception 'forbidden'; end if;
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

revoke all on function public.consume_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.approve_enrollment_request_secure(text, text, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.delete_enrollment_request_secure(text, uuid)
  from public, anon, authenticated;
revoke all on function public.submit_exam_result_secure(text, text, text, jsonb, boolean)
  from public, anon, authenticated;
revoke all on function public.retry_exam_secure(text, text, text)
  from public, anon, authenticated;
revoke all on function public.replace_admin_entity_rows_secure(text, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.mutate_invoice_secure(text, text, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer)
  to service_role;
grant execute on function public.approve_enrollment_request_secure(text, text, uuid, uuid)
  to service_role;
grant execute on function public.delete_enrollment_request_secure(text, uuid)
  to service_role;
grant execute on function public.submit_exam_result_secure(text, text, text, jsonb, boolean)
  to service_role;
grant execute on function public.retry_exam_secure(text, text, text)
  to service_role;
grant execute on function public.replace_admin_entity_rows_secure(text, jsonb, uuid)
  to service_role;
grant execute on function public.mutate_invoice_secure(text, text, text, uuid, jsonb)
  to service_role;

-- All application buckets become private. Existing open policies are removed.
update storage.buckets
set public = false
where id in ('class-materials', 'homework-submissions', 'avatars');

do $$
declare policy_row record;
begin
  for policy_row in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format(
      'drop policy if exists %I on storage.objects',
      policy_row.policyname
    );
  end loop;
end
$$;

create policy storage_avatar_owner_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy storage_avatar_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
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
create policy storage_avatar_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy storage_class_scoped_select on storage.objects
  for select to authenticated
  using (
    bucket_id in ('class-materials', 'homework-submissions')
    and (
      public.get_my_role() = 'admin'
      or public.teaches_class((storage.foldername(name))[1])
      or public.enrolled_in_class((storage.foldername(name))[1])
    )
  );
create policy storage_class_scoped_insert on storage.objects
  for insert to authenticated
  with check (
    (
      bucket_id = 'class-materials'
      and (
        public.get_my_role() = 'admin'
        or public.teaches_class((storage.foldername(name))[1])
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
create policy storage_class_teacher_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('class-materials', 'homework-submissions')
    and (
      public.get_my_role() = 'admin'
      or public.teaches_class((storage.foldername(name))[1])
    )
  );
create policy storage_class_teacher_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('class-materials', 'homework-submissions')
    and (
      public.get_my_role() = 'admin'
      or public.teaches_class((storage.foldername(name))[1])
    )
  );

commit;
