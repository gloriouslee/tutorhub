-- Replace dangerous full-table admin writes with row-level lifecycle helpers,
-- and scope paid-material transactions to the owning teacher.

drop function if exists public.replace_admin_entity_rows_secure(text, jsonb, uuid);

create or replace function public.delete_admin_domain_identity_secure(
  p_entity text,
  p_record_id text,
  p_actor_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  auth_user_id text;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'admin'
  ) then
    raise exception 'forbidden';
  end if;

  if p_entity = 'students' then
    if exists (
      select 1 from public.classes
      where p_record_id = any(coalesce(student_ids, '{}'::text[]))
    ) then
      raise exception 'student_has_classes';
    end if;
    select user_id::text into auth_user_id
    from public.students where id = p_record_id for update;
    delete from public.students where id = p_record_id;
  elsif p_entity = 'teachers' then
    if exists (
      select 1 from public.classes where tutor_id = p_record_id
    ) then
      raise exception 'teacher_has_classes';
    end if;
    select user_id::text into auth_user_id
    from public.teachers where id = p_record_id for update;
    delete from public.teachers where id = p_record_id;
  else
    raise exception 'invalid_entity';
  end if;

  return auth_user_id;
end;
$$;

alter table public.purchase_transactions
  add column if not exists class_id text references public.classes(id) on delete set null,
  add column if not exists teacher_id text references public.teachers(id) on delete set null;

update public.purchase_transactions tx
set class_id = material.class_id,
    teacher_id = class_row.tutor_id
from public.teacher_materials material
left join public.classes class_row on class_row.id = material.class_id
where tx.pkg_id = material.id
  and (tx.class_id is null or tx.teacher_id is null);

create index if not exists purchase_transactions_teacher_status_idx
  on public.purchase_transactions (teacher_id, status, created_at desc);

revoke all on function public.delete_admin_domain_identity_secure(
  text, text, uuid
) from public, anon, authenticated;
grant execute on function public.delete_admin_domain_identity_secure(
  text, text, uuid
) to service_role;
