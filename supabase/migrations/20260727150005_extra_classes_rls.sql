-- Fix: RLS helpers must recognise teacher-created "extra" classes.
--
-- Teacher-created classes live in public.teacher_extra_classes (not the core
-- public.classes table), but teaches_class()/enrolled_in_class() only checked
-- public.classes. As a result every RLS check scoped by those helpers
-- (storage uploads, kv_curriculum writes, per-row tables, ...) failed for extra
-- classes with "new row violates row-level security policy". Extend both
-- helpers to also consider teacher_extra_classes.

create or replace function public.teaches_class(p_class_id text)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.classes
    where id::text = p_class_id and tutor_id::text = public.my_teacher_id()
  ) or exists (
    select 1 from public.teacher_extra_classes
    where id = p_class_id and tutor_id = public.my_teacher_id()
  )
$$;

create or replace function public.enrolled_in_class(p_class_id text)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.classes c
    where c.id::text = p_class_id
      and exists (
        select 1 from unnest(c.student_ids) sid
        where sid::text = public.my_student_id()
      )
  ) or exists (
    select 1 from public.teacher_extra_classes ec
    where ec.id = p_class_id
      and public.my_student_id() = any (ec.student_ids)
  )
$$;
