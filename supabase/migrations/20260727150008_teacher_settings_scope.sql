-- Restrict teacher payment settings (QR / bank account) visibility.
-- Was `using (true)` → readable by EVERY authenticated user. Scope it to:
-- the teacher themselves, admins, students enrolled in that teacher's class,
-- and parents of such students (they need the QR to pay tuition).

drop policy if exists teacher_settings_read on public.kv_teacher_settings;
create policy teacher_settings_read on public.kv_teacher_settings
  for select to authenticated
  using (
    public.get_my_role() = 'admin'
    or id::text = public.my_teacher_id()
    or exists (
      select 1 from public.classes c
      where c.tutor_id::text = id::text
        and (
          public.my_student_id() = any (c.student_ids)
          or exists (
            select 1 from public.students s
            where s.parent_id::text = public.my_parent_id()
              and s.id::text = any (c.student_ids)
          )
        )
    )
  );
