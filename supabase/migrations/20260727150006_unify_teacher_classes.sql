-- Unify teacher-created classes into the core public.classes table so a single
-- source of truth exists (no more classes vs teacher_extra_classes split).
--
-- 1) Allow teachers to manage their OWN classes directly (RLS-scoped writes),
--    mirroring how admins' classes already live in `classes`.
-- 2) Copy any existing rows from teacher_extra_classes into classes.
--
-- Additive + idempotent: teacher_extra_classes is NOT dropped (kept empty for
-- safety; the both-table checks elsewhere still work).

grant insert, update, delete on public.classes to authenticated;

drop policy if exists classes_teacher_write on public.classes;
create policy classes_teacher_write on public.classes
  for all to authenticated
  using (public.get_my_role() = 'admin' or tutor_id::text = public.my_teacher_id())
  with check (public.get_my_role() = 'admin' or tutor_id::text = public.my_teacher_id());

-- Migrate teacher_extra_classes -> classes (skip ids already present).
insert into public.classes (
  id, class_name, subject, grade, learning_mode, tutor_id, classroom,
  zoom_link, schedule, student_ids, description, max_students, color, created_at
)
select
  ec.id,
  coalesce(ec.data->>'class_name', ''),
  coalesce(ec.data->>'subject', ''),
  case when ec.data->>'grade' ~ '^[0-9]+$' then (ec.data->>'grade')::int else null end,
  coalesce(nullif(ec.data->>'learning_mode', ''), 'hybrid'),
  ec.tutor_id,
  ec.data->>'classroom',
  ec.data->>'zoom_link',
  coalesce(ec.data->'schedule', '[]'::jsonb),
  ec.student_ids,
  ec.data->>'description',
  coalesce(case when ec.data->>'max_students' ~ '^[0-9]+$' then (ec.data->>'max_students')::int end, 15),
  coalesce(nullif(ec.data->>'color', ''), '#6366f1'),
  coalesce((ec.data->>'created_at')::timestamptz, now())
from public.teacher_extra_classes ec
on conflict (id) do nothing;
