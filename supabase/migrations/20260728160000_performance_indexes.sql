-- Hot-path indexes for account resolution and class membership queries.
-- Kept non-unique so this migration remains safe if legacy data contains duplicates.

create index if not exists parents_user_id_idx
  on public.parents (user_id)
  where user_id is not null;

create index if not exists teachers_user_id_idx
  on public.teachers (user_id)
  where user_id is not null;

create index if not exists students_user_id_idx
  on public.students (user_id)
  where user_id is not null;

create index if not exists classes_tutor_id_idx
  on public.classes (tutor_id)
  where tutor_id is not null;

create index if not exists classes_student_ids_gin_idx
  on public.classes using gin (student_ids);
