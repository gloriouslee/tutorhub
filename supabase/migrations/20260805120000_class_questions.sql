-- Private student/teacher Q&A threads. These tables are API-only: route handlers
-- resolve the authenticated identity and enforce class ownership before using
-- the service role. No browser receives direct table grants.

create table if not exists public.class_questions (
  id                uuid primary key default gen_random_uuid(),
  class_id          text not null references public.classes(id) on delete cascade,
  student_id        text not null references public.students(id) on delete cascade,
  title             text not null check (char_length(title) between 3 and 160),
  status            text not null default 'open'
                    check (status in ('open', 'answered', 'closed')),
  last_message_role text not null default 'student'
                    check (last_message_role in ('student', 'teacher')),
  last_message_at   timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.class_question_messages (
  id             uuid primary key default gen_random_uuid(),
  question_id    uuid not null references public.class_questions(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_role    text not null check (author_role in ('student', 'teacher')),
  author_name    text not null check (char_length(author_name) between 1 and 160),
  content        text not null check (char_length(content) between 1 and 10000),
  attachment_url text,
  attachment_name text,
  attachment_size text,
  created_at     timestamptz not null default now()
);

create index if not exists class_questions_class_status_idx
  on public.class_questions (class_id, status, last_message_at desc);
create index if not exists class_questions_student_idx
  on public.class_questions (student_id, last_message_at desc);
create index if not exists class_question_messages_thread_idx
  on public.class_question_messages (question_id, created_at);

alter table public.class_questions enable row level security;
alter table public.class_questions force row level security;
alter table public.class_question_messages enable row level security;
alter table public.class_question_messages force row level security;

revoke all on public.class_questions from public, anon, authenticated;
revoke all on public.class_question_messages from public, anon, authenticated;
grant select, insert, update, delete on public.class_questions to service_role;
grant select, insert, update, delete on public.class_question_messages to service_role;
