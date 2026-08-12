begin;

alter table public.purchase_transactions
  add column if not exists rejection_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_transactions_rejection_reason_length'
      and conrelid = 'public.purchase_transactions'::regclass
  ) then
    alter table public.purchase_transactions
      add constraint purchase_transactions_rejection_reason_length
      check (rejection_reason is null or char_length(rejection_reason) <= 500);
  end if;
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
        'submitted_at', now(),
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

commit;
