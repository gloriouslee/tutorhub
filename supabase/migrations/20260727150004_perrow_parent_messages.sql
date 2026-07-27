-- Per-parent messages (slice 12), replacing the global kv_parent_messages blob.
-- One row per parent holding that parent's conversations as jsonb.

create table if not exists public.parent_messages (
  parent_id  text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.parent_messages enable row level security;
grant select, insert, update, delete on public.parent_messages to authenticated;

drop policy if exists parent_messages_owner on public.parent_messages;
create policy parent_messages_owner on public.parent_messages
  for all to authenticated
  using (public.get_my_role() = 'admin' or parent_id = public.my_parent_id())
  with check (public.get_my_role() = 'admin' or parent_id = public.my_parent_id());
