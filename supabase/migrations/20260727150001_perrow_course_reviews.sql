-- Per-row course reviews, replacing the kv_course_reviews global blob.
-- Slice 1 of the KV blob -> per-row + RLS re-architecture.

create table if not exists public.course_reviews (
  id           text primary key,
  course_id    text not null,
  student_id   text not null,
  student_name text,
  rating       integer not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz not null default now(),
  unique (course_id, student_id)
);
create index if not exists course_reviews_course_idx on public.course_reviews (course_id);

alter table public.course_reviews enable row level security;
grant select, insert, update, delete on public.course_reviews to authenticated;

-- Aggregate ratings are shown to every authenticated user (marketplace).
drop policy if exists course_reviews_read on public.course_reviews;
create policy course_reviews_read on public.course_reviews
  for select to authenticated using (true);

-- Only the authoring student (or an admin) may create/update/delete a review.
drop policy if exists course_reviews_owner_write on public.course_reviews;
create policy course_reviews_owner_write on public.course_reviews
  for all to authenticated
  using (public.get_my_role() = 'admin' or student_id = public.my_student_id())
  with check (public.get_my_role() = 'admin' or student_id = public.my_student_id());
