-- Audit fixes (RLS): exam-result read/write for teachers of classes whose id
-- contains "_" (e.g. cls_123), and teacher-owned storage folders.

-- ── Exam results: robust class-ownership check (id = classId_lessonId_studentId) ──
-- split_part(id,'_',1) was wrong for class ids containing '_'. Match by prefix:
-- the teacher owns SOME class whose id is a prefix of the result id.
drop policy if exists exam_results_scoped_select on public.kv_exam_results;
create policy exam_results_scoped_select on public.kv_exam_results
  for select to authenticated
  using (
    public.get_my_role() = 'admin'
    or id like '%\_' || public.my_student_id() escape '\'
    or exists (
      select 1 from public.classes c
      where c.tutor_id::text = public.my_teacher_id()
        and id like c.id || '\_%' escape '\'
    )
  );

-- Teachers/admins may WRITE exam results (manual grading via gradeExamResult).
-- Students never write directly (exam submit/retry go through service-role RPCs).
grant insert, update on public.kv_exam_results to authenticated;
drop policy if exists exam_results_teacher_write on public.kv_exam_results;
create policy exam_results_teacher_write on public.kv_exam_results
  for insert to authenticated
  with check (
    public.get_my_role() = 'admin'
    or exists (
      select 1 from public.classes c
      where c.tutor_id::text = public.my_teacher_id()
        and id like c.id || '\_%' escape '\'
    )
  );
drop policy if exists exam_results_teacher_update on public.kv_exam_results;
create policy exam_results_teacher_update on public.kv_exam_results
  for update to authenticated
  using (
    public.get_my_role() = 'admin'
    or exists (
      select 1 from public.classes c
      where c.tutor_id::text = public.my_teacher_id()
        and id like c.id || '\_%' escape '\'
    )
  )
  with check (
    public.get_my_role() = 'admin'
    or exists (
      select 1 from public.classes c
      where c.tutor_id::text = public.my_teacher_id()
        and id like c.id || '\_%' escape '\'
    )
  );

-- ── Exam submissions registry: same prefix-based teacher check ────────────────
drop policy if exists exam_registry_teacher_select on public.kv_exam_submissions;
create policy exam_registry_teacher_select on public.kv_exam_submissions
  for select to authenticated
  using (
    public.get_my_role() = 'admin'
    or exists (
      select 1 from public.classes c
      where c.tutor_id::text = public.my_teacher_id()
        and id like c.id || '\_%' escape '\'
    )
  );

-- ── Storage: allow a teacher to read/write their OWN folder in class-materials ─
-- (teacher settings QR/avatar and material-catalog uploads use path
-- "<teacherId>/materials/…", which is not a class folder).
drop policy if exists storage_class_scoped_select on storage.objects;
create policy storage_class_scoped_select on storage.objects
  for select to authenticated using (
    bucket_id in ('class-materials', 'homework-submissions')
    and (
      public.get_my_role() = 'admin'
      or public.teaches_class((storage.foldername(name))[1])
      or public.enrolled_in_class((storage.foldername(name))[1])
      or (storage.foldername(name))[1] = public.my_teacher_id()
    )
  );

drop policy if exists storage_class_scoped_insert on storage.objects;
create policy storage_class_scoped_insert on storage.objects
  for insert to authenticated
  with check (
    (
      bucket_id = 'class-materials'
      and (
        public.get_my_role() = 'admin'
        or public.teaches_class((storage.foldername(name))[1])
        or (storage.foldername(name))[1] = public.my_teacher_id()
        or (
          (storage.foldername(name))[2] = 'homework'
          and public.enrolled_in_class((storage.foldername(name))[1])
        )
      )
    )
    or (
      bucket_id = 'homework-submissions'
      and (storage.foldername(name))[2] = 'submissions'
      and (storage.foldername(name))[3] = public.my_student_id()
      and public.enrolled_in_class((storage.foldername(name))[1])
    )
  );
