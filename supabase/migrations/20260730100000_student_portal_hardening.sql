-- Student portal hardening:
-- - keep paid/full material payloads behind authenticated server APIs
-- - prevent students from reading classmates' submissions
-- - remove the broad student UPDATE policy on class materials
-- - persist payment receipts and lesson progress

alter table public.purchase_transactions
  add column if not exists receipt_path text;

create table if not exists public.student_lesson_progress (
  student_id  text not null references public.students(id) on delete cascade,
  resource_id text not null,
  lesson_id   text not null,
  completed   boolean not null default false,
  notes       text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (student_id, resource_id, lesson_id)
);
create index if not exists student_lesson_progress_resource_idx
  on public.student_lesson_progress (student_id, resource_id, updated_at desc);
alter table public.student_lesson_progress enable row level security;
revoke all on public.student_lesson_progress from anon, authenticated;
grant select, insert, update, delete on public.student_lesson_progress to service_role;

-- Raw catalog rows contain paid video/file URLs. Students receive a filtered
-- representation from /api/student/materials instead.
drop policy if exists teacher_materials_read on public.teacher_materials;
create policy teacher_materials_read on public.teacher_materials
  for select to authenticated using (
    public.get_my_role() = 'admin'
    or teacher_id = public.my_teacher_id()
  );

-- Students previously had an UPDATE policy intended only for download_count,
-- but PostgreSQL RLS cannot restrict that policy to one column.
drop policy if exists class_materials_student_download on public.class_materials;

-- Students may read class-material objects only through /api/files, where the
-- linked material and package entitlement are checked. Submission objects are
-- restricted to the submitting student at the storage layer as well.
drop policy if exists storage_class_scoped_select on storage.objects;
create policy storage_class_scoped_select on storage.objects
  for select to authenticated
  using (
    (
      bucket_id = 'class-materials'
      and (
        public.get_my_role() = 'admin'
        or public.teaches_class((storage.foldername(name))[1])
        or (storage.foldername(name))[1] = public.my_teacher_id()
      )
    )
    or (
      bucket_id = 'homework-submissions'
      and (
        public.get_my_role() = 'admin'
        or public.teaches_class((storage.foldername(name))[1])
        or (
          (storage.foldername(name))[2] = 'submissions'
          and (storage.foldername(name))[3] = public.my_student_id()
          and public.enrolled_in_class((storage.foldername(name))[1])
        )
      )
    )
  );

insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do update set public = false;

-- Receipt files are uploaded and signed by authenticated Route Handlers using
-- service_role. No direct client storage policy is intentionally created.

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
    if not exists (
      select 1 from public.students
      where id::text = p_child_id and parent_id::text = actor_parent_id
    ) then
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

revoke all on function public.submit_invoice_receipt_secure(text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.submit_invoice_receipt_secure(text, text, uuid, text)
  to service_role;

create or replace function public.increment_class_material_download_secure(
  p_material_id text
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.class_materials
  set download_count = coalesce(download_count, 0) + 1
  where id = p_material_id;
$$;

revoke all on function public.increment_class_material_download_secure(text)
  from public, anon, authenticated;
grant execute on function public.increment_class_material_download_secure(text)
  to service_role;
