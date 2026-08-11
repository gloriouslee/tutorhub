-- Learning growth suite: support alerts, weekly parent reports, topic mastery,
-- XP/badges and personal learning goals. All access goes through role-scoped
-- Route Handlers using the service role; clients never query these tables.

create table if not exists public.student_support_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null unique,
  teacher_id text not null,
  class_id text not null,
  student_id text not null references public.students(id) on delete cascade,
  priority text not null check (priority in ('high', 'medium', 'low')),
  priority_score integer not null default 0,
  signals jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'monitoring', 'resolved')),
  detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists student_support_alerts_teacher_status_idx
  on public.student_support_alerts(teacher_id, status, priority_score desc, last_detected_at desc);
create index if not exists student_support_alerts_student_idx
  on public.student_support_alerts(student_id, last_detected_at desc);

create table if not exists public.weekly_parent_reports (
  id uuid primary key default gen_random_uuid(),
  teacher_id text not null,
  student_id text not null references public.students(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  summary jsonb not null default '{}'::jsonb,
  teacher_comment text,
  delivery_channel text not null default 'notification'
    check (delivery_channel in ('notification', 'email', 'both')),
  delivery_status text not null default 'delivered'
    check (delivery_status in ('pending', 'delivered', 'failed')),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, student_id, week_start)
);
create index if not exists weekly_parent_reports_student_week_idx
  on public.weekly_parent_reports(student_id, week_start desc);
create index if not exists weekly_parent_reports_teacher_week_idx
  on public.weekly_parent_reports(teacher_id, week_start desc);

create table if not exists public.student_xp_events (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  class_id text,
  source_type text not null
    check (source_type in ('homework', 'attendance', 'lesson', 'improvement', 'community', 'manual')),
  source_id text not null,
  points integer not null check (points between -100 and 500),
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (student_id, source_type, source_id)
);
create index if not exists student_xp_events_student_date_idx
  on public.student_xp_events(student_id, occurred_at desc);

create table if not exists public.student_badges (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  class_id text not null default '',
  badge_code text not null,
  title text not null,
  description text not null,
  icon text not null,
  metadata jsonb not null default '{}'::jsonb,
  awarded_at timestamptz not null default now(),
  unique (student_id, badge_code, class_id)
);
create index if not exists student_badges_student_date_idx
  on public.student_badges(student_id, awarded_at desc);

create table if not exists public.learning_goals (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  class_id text,
  title text not null,
  metric text not null check (metric in (
    'homework_completed', 'average_score', 'attendance_rate',
    'lessons_completed', 'xp_earned'
  )),
  target_value numeric(8,2) not null check (target_value > 0),
  current_value numeric(8,2) not null default 0,
  period_start date not null,
  period_end date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled', 'expired')),
  created_by_user_id uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);
create index if not exists learning_goals_student_status_idx
  on public.learning_goals(student_id, status, period_end);

create table if not exists public.student_topic_mastery (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  class_id text not null,
  topic text not null,
  total_questions integer not null default 0 check (total_questions >= 0),
  incorrect_questions integer not null default 0 check (incorrect_questions >= 0),
  mastery_percent numeric(5,2) not null default 0 check (mastery_percent between 0 and 100),
  recommended_resources jsonb not null default '[]'::jsonb,
  last_exam_id text,
  last_exam_title text,
  last_exam_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (student_id, class_id, topic)
);
create index if not exists student_topic_mastery_student_idx
  on public.student_topic_mastery(student_id, mastery_percent, updated_at desc);
create index if not exists student_topic_mastery_class_idx
  on public.student_topic_mastery(class_id, mastery_percent, updated_at desc);

alter table public.student_support_alerts enable row level security;
alter table public.student_support_alerts force row level security;
alter table public.weekly_parent_reports enable row level security;
alter table public.weekly_parent_reports force row level security;
alter table public.student_xp_events enable row level security;
alter table public.student_xp_events force row level security;
alter table public.student_badges enable row level security;
alter table public.student_badges force row level security;
alter table public.learning_goals enable row level security;
alter table public.learning_goals force row level security;
alter table public.student_topic_mastery enable row level security;
alter table public.student_topic_mastery force row level security;

revoke all on public.student_support_alerts from public;
revoke all on public.weekly_parent_reports from public;
revoke all on public.student_xp_events from public;
revoke all on public.student_badges from public;
revoke all on public.learning_goals from public;
revoke all on public.student_topic_mastery from public;
revoke all on public.student_support_alerts from anon, authenticated;
revoke all on public.weekly_parent_reports from anon, authenticated;
revoke all on public.student_xp_events from anon, authenticated;
revoke all on public.student_badges from anon, authenticated;
revoke all on public.learning_goals from anon, authenticated;
revoke all on public.student_topic_mastery from anon, authenticated;

grant select, insert, update, delete on public.student_support_alerts to service_role;
grant select, insert, update, delete on public.weekly_parent_reports to service_role;
grant select, insert, update, delete on public.student_xp_events to service_role;
grant select, insert, update, delete on public.student_badges to service_role;
grant select, insert, update, delete on public.learning_goals to service_role;
grant select, insert, update, delete on public.student_topic_mastery to service_role;
