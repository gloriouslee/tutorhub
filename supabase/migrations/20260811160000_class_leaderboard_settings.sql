-- Per-class leaderboard visibility, ranking window and student privacy controls.
create table if not exists public.class_leaderboard_settings (
  class_id            text primary key,
  enabled             boolean not null default true,
  period              text not null default 'all_time'
                      check (period in ('all_time', 'last_7_days', 'last_30_days', 'term')),
  term_start_date     date,
  minimum_assessments integer not null default 1
                      check (minimum_assessments between 1 and 20),
  privacy_mode        text not null default 'full_name'
                      check (privacy_mode in ('full_name', 'abbreviated', 'anonymous')),
  updated_by          text,
  updated_at          timestamptz not null default now(),
  check (period <> 'term' or term_start_date is not null)
);

alter table public.class_leaderboard_settings enable row level security;
revoke all on public.class_leaderboard_settings from anon, authenticated;
grant select, insert, update, delete on public.class_leaderboard_settings to service_role;
