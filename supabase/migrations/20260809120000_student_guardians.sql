begin;

-- A student can have multiple parents/guardians, and one guardian can follow
-- multiple children. Existing students.parent_id rows are backfilled as active
-- links so the migration is non-breaking.
create table if not exists public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  parent_id text not null references public.parents(id) on delete cascade,
  relationship text not null default 'guardian'
    check (relationship in ('mother', 'father', 'guardian', 'other')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected', 'revoked')),
  invited_email text,
  invited_by_user_id uuid references public.profiles(id) on delete set null,
  invited_by_role text check (invited_by_role in ('teacher', 'admin')),
  accepted_at timestamptz,
  rejected_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, parent_id)
);

insert into public.student_guardians (
  student_id,
  parent_id,
  relationship,
  status,
  invited_email,
  accepted_at,
  created_at,
  updated_at
)
select
  s.id,
  s.parent_id,
  'guardian',
  'active',
  p.email,
  coalesce(s.created_at, now()),
  coalesce(s.created_at, now()),
  now()
from public.students s
join public.parents p on p.id = s.parent_id
where s.parent_id is not null
on conflict (student_id, parent_id) do nothing;

create index if not exists student_guardians_parent_status_idx
  on public.student_guardians(parent_id, status, student_id);
create index if not exists student_guardians_student_status_idx
  on public.student_guardians(student_id, status, parent_id);
create index if not exists student_guardians_invited_email_idx
  on public.student_guardians(lower(invited_email))
  where invited_email is not null;

alter table public.student_guardians enable row level security;
alter table public.student_guardians force row level security;
revoke all on public.student_guardians from public, anon, authenticated;
grant select on public.student_guardians to authenticated;
grant select, insert, update, delete on public.student_guardians to service_role;

drop policy if exists student_guardians_scoped_select on public.student_guardians;
create policy student_guardians_scoped_select on public.student_guardians
  for select to authenticated
  using (
    public.get_my_role() = 'admin'
    or parent_id = public.my_parent_id()
    or (
      public.get_my_role() = 'teacher'
      and public.teaches_student(student_id)
    )
  );

-- Explicit-id helper is also used inside service-role RPCs where auth.uid() is
-- intentionally unavailable and the actor id is passed as an argument.
create or replace function public.parent_id_has_student(
  p_parent_id text,
  p_student_id text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.student_guardians sg
    where sg.parent_id = p_parent_id
      and sg.student_id = p_student_id
      and sg.status = 'active'
  ) or exists (
    select 1
    from public.students s
    where s.id::text = p_student_id
      and s.parent_id::text = p_parent_id
  )
$$;

create or replace function public.parent_has_student(p_student_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.parent_id_has_student(public.my_parent_id(), p_student_id)
$$;

create or replace function public.is_my_child(p_student_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.parent_has_student(p_student_id)
$$;

revoke all on function public.parent_id_has_student(text, text) from public, anon;
revoke all on function public.parent_has_student(text) from public, anon;
revoke all on function public.is_my_child(text) from public, anon;
grant execute on function public.parent_id_has_student(text, text)
  to authenticated, service_role;
grant execute on function public.parent_has_student(text)
  to authenticated, service_role;
grant execute on function public.is_my_child(text)
  to authenticated, service_role;

-- Replace the few policies that encoded students.parent_id directly. All other
-- parent-aware policies already call parent_has_student/is_my_child.
drop policy if exists students_scoped_select on public.students;
create policy students_scoped_select on public.students
  for select to authenticated
  using (
    user_id::text = auth.uid()::text
    or public.parent_has_student(id::text)
    or public.get_my_role() = 'admin'
    or (public.get_my_role() = 'teacher' and public.teaches_student(id))
  );

drop policy if exists classes_scoped_select on public.classes;
create policy classes_scoped_select on public.classes
  for select to authenticated
  using (
    public.get_my_role() = 'admin'
    or tutor_id::text = public.my_teacher_id()
    or exists (
      select 1 from unnest(classes.student_ids) student_id
      where student_id::text = public.my_student_id()
    )
    or exists (
      select 1 from unnest(classes.student_ids) student_id
      where public.parent_has_student(student_id::text)
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

drop policy if exists teacher_settings_read on public.kv_teacher_settings;
create policy teacher_settings_read on public.kv_teacher_settings
  for select to authenticated using (
    public.get_my_role() = 'admin'
    or id::text = public.my_teacher_id()
    or exists (
      select 1 from public.classes c
      where c.tutor_id::text = id::text
        and (
          public.my_student_id() = any (c.student_ids)
          or exists (
            select 1 from unnest(c.student_ids) student_id
            where public.parent_has_student(student_id::text)
          )
        )
    )
  );

drop policy if exists homework_attachments_read on public.homework_attachments;
create policy homework_attachments_read on public.homework_attachments
  for select to authenticated using (
    public.get_my_role() = 'admin'
    or public.teaches_class(class_id)
    or public.enrolled_in_class(class_id)
    or exists (
      select 1 from public.classes c
      where c.id = homework_attachments.class_id
        and exists (
          select 1 from unnest(c.student_ids) student_id
          where public.parent_has_student(student_id::text)
        )
    )
  );

-- Parent authorization inside invoice mutations must use the new many-to-many
-- relationship. The remaining mutation logic is unchanged.
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
      if not public.parent_id_has_student(actor_parent_id, p_child_id) then
        raise exception 'forbidden';
      end if;
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
          select 1 from unnest(classes.student_ids) student_id
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

create or replace function public.submit_invoice_receipt_secure(
  p_invoice_id text,
  p_child_id text,
  p_actor_id uuid,
  p_receipt_path text
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
  invoices jsonb;
  output_value jsonb;
  matched_count integer;
begin
  select role into actor_role from public.profiles where id = p_actor_id;
  select id::text into actor_student_id
  from public.students where user_id::text = p_actor_id::text limit 1;
  select id::text into actor_parent_id
  from public.parents where user_id::text = p_actor_id::text limit 1;

  if actor_role = 'student' then
    p_child_id := actor_student_id;
  elsif actor_role = 'parent' then
    if not public.parent_id_has_student(actor_parent_id, p_child_id) then
      raise exception 'forbidden';
    end if;
  else
    raise exception 'forbidden';
  end if;

  if p_receipt_path is null
     or p_receipt_path = ''
     or p_receipt_path not like p_child_id || '/%' then
    raise exception 'invalid_receipt';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('kv_invoices:global', 0));
  insert into public.kv_invoices(id, value, updated_at)
  values ('global', '[]'::jsonb, now())
  on conflict (id) do nothing;
  select value into invoices
  from public.kv_invoices where id = 'global' for update;
  invoices := case when jsonb_typeof(invoices) = 'array'
    then invoices else '[]'::jsonb end;

  select count(*) into matched_count
  from jsonb_array_elements(invoices) item
  where item->>'child_id' = p_child_id
    and item->>'status' = 'pending'
    and (p_invoice_id = 'ALL' or item->>'id' = p_invoice_id);
  if matched_count = 0 then raise exception 'invoice_not_found'; end if;

  select coalesce(jsonb_agg(
    case
      when item->>'child_id' = p_child_id
       and item->>'status' = 'pending'
       and (p_invoice_id = 'ALL' or item->>'id' = p_invoice_id)
      then item || jsonb_build_object(
        'status', 'pending_verification',
        'submitted_by', actor_role,
        'receipt_path', p_receipt_path
      )
      else item
    end
  ), '[]'::jsonb) into output_value
  from jsonb_array_elements(invoices) item;

  update public.kv_invoices
  set value = output_value, updated_at = now()
  where id = 'global';
  return jsonb_build_object('updated', matched_count);
end;
$$;

revoke all on function public.mutate_invoice_secure(text, text, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.mutate_invoice_secure(text, text, text, uuid, jsonb)
  to service_role;
revoke all on function public.submit_invoice_receipt_secure(text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.submit_invoice_receipt_secure(text, text, uuid, text)
  to service_role;

commit;
