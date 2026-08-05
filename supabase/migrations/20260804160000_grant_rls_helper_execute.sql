-- Restore EXECUTE on the RLS helper functions for `authenticated`.
--
-- 20260727150002_perrow_wrapper_datasets.sql created teaches_student() but never
-- granted EXECUTE on it; the grant exists only in schema_canonical.sql, so any
-- project built up from the migration chain is missing it.
--
-- The consequence is severe and silent. students_scoped_select reads
--   ... or (public.get_my_role() = 'teacher' and public.teaches_student(id))
-- so evaluating that policy raises "permission denied for function
-- teaches_student" and the whole SELECT on public.students fails. Every list
-- built from it — the class roster, /teacher/students, the admin portal — renders
-- as "no students", and getRequestIdentity resolves no studentId, which pins
-- student accounts on /student/onboarding forever.
--
-- Re-grant the full helper set rather than just the one function, so a gap in any
-- other migration is closed at the same time. Granting twice is harmless.

grant execute on function public.get_my_role()            to authenticated, service_role;
grant execute on function public.my_student_id()           to authenticated, service_role;
grant execute on function public.my_teacher_id()           to authenticated, service_role;
grant execute on function public.my_parent_id()            to authenticated, service_role;
grant execute on function public.teaches_class(text)       to authenticated, service_role;
grant execute on function public.enrolled_in_class(text)   to authenticated, service_role;
grant execute on function public.parent_has_student(text)  to authenticated, service_role;
grant execute on function public.teaches_student(text)     to authenticated, service_role;
grant execute on function public.is_my_child(text)         to authenticated, service_role;

-- Verify: every row must come back true. A false here means RLS on the table
-- whose policy calls that function will fail rather than filter.
do $$
declare
  missing text;
begin
  select string_agg(p.proname, ', ')
  into missing
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'get_my_role', 'my_student_id', 'my_teacher_id', 'my_parent_id',
      'teaches_class', 'enrolled_in_class', 'parent_has_student',
      'teaches_student', 'is_my_child'
    )
    and not has_function_privilege('authenticated', p.oid, 'execute');

  if missing is not null then
    raise exception 'authenticated still cannot execute: %', missing;
  end if;
end $$;
