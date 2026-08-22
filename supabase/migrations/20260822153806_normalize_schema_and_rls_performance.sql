-- TutorHub production schema normalization (2026-08-22)
--
-- Goals:
--   1. Retire empty/unused legacy tables after the app moved to canonical stores.
--   2. Add indexes required by foreign-key maintenance.
--   3. make RLS auth lookups statement-stable instead of evaluating per row.
--   4. Split write policies from SELECT policies to avoid duplicate evaluation.

-- Refuse to remove a table if it gained data after the production audit. This
-- turns a concurrent/late write into a safe migration failure rather than loss.
do $$
declare
  table_name text;
  row_count bigint;
begin
  foreach table_name in array array[
    'kv_online_links', 'kv_exam_scores', 'kv_managed_users',
    'kv_student_accounts', 'exam_scores', 'materials', 'submissions',
    'homework', 'payments', 'attendance'
  ]
  loop
    execute format('select count(*) from public.%I', table_name) into row_count;
    if row_count <> 0 then
      raise exception 'Refusing to drop %. It now contains % row(s).', table_name, row_count;
    end if;
  end loop;

  -- The one kv_schedules row belongs to a class that no longer exists. Refuse
  -- the cleanup if a current class ever starts referencing this legacy store.
  if exists (
    select 1
    from public.kv_schedules legacy
    join public.classes current_class on current_class.id = legacy.id
  ) then
    raise exception 'Refusing to drop kv_schedules: it contains a current class schedule.';
  end if;
end
$$;

-- Drop dependants before parents and never use CASCADE: an unexpected database
-- dependency must stop the migration so it can be reviewed explicitly.
drop table if exists public.submissions;
drop table if exists public.homework;
drop table if exists public.materials;
drop table if exists public.exam_scores;
drop table if exists public.payments;
drop table if exists public.attendance;
drop table if exists public.kv_schedules;
drop table if exists public.kv_online_links;
drop table if exists public.kv_exam_scores;
drop table if exists public.kv_managed_users;
drop table if exists public.kv_student_accounts;

-- Foreign-key indexes. Besides joins, these avoid full child-table scans when a
-- referenced profile/class/user is updated or deleted.
create index if not exists class_question_messages_author_user_idx
  on public.class_question_messages (author_user_id);
create index if not exists class_registration_assigned_class_idx
  on public.class_registration_requests (assigned_class_id);
create index if not exists class_registration_reviewed_by_idx
  on public.class_registration_requests (reviewed_by);
create index if not exists learning_goals_created_by_user_idx
  on public.learning_goals (created_by_user_id);
create index if not exists notification_reads_user_idx
  on public.notification_reads (user_id);
create index if not exists purchase_transactions_class_idx
  on public.purchase_transactions (class_id);
create index if not exists student_guardians_invited_by_user_idx
  on public.student_guardians (invited_by_user_id);

-- Exact duplicate of idx_scores_student. Keep the canonical index name.
drop index if exists public.app_exam_scores_student_ref_idx;

-- Cache request identity/role helpers once per statement where their result is
-- independent of the current row. Row-dependent scope helpers remain unwrapped.
drop policy if exists students_scoped_select on public.students;
create policy students_scoped_select on public.students
  for select to authenticated
  using (
    user_id::text = (select auth.uid())::text
    or public.parent_has_student(id)
    or (select public.get_my_role()) = 'admin'
    or ((select public.get_my_role()) = 'teacher' and public.teaches_student(id))
  );

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.get_my_role()) = 'admin');

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists parents_scoped_select on public.parents;
create policy parents_scoped_select on public.parents
  for select to authenticated
  using (
    user_id::text = (select auth.uid())::text
    or (select public.get_my_role()) = 'admin'
  );

drop policy if exists notifications_role_select on public.notifications;
create policy notifications_role_select on public.notifications
  for select to authenticated
  using (
    (select public.get_my_role()) = 'admin'
    or sender_user_id = (select auth.uid())
    or (
      (target_role = 'all' or target_role = (select public.get_my_role()))
      and (
        target_student_id is null
        or ((select public.get_my_role()) = 'student' and target_student_id = (select public.my_student_id()))
        or ((select public.get_my_role()) = 'parent' and public.parent_has_student(target_student_id))
      )
      and (
        target_class_id is null
        or ((select public.get_my_role()) = 'teacher' and public.teaches_class(target_class_id))
        or ((select public.get_my_role()) = 'student' and public.enrolled_in_class(target_class_id))
        or (
          (select public.get_my_role()) = 'parent'
          and exists (
            select 1
            from public.classes class_scope
            where class_scope.id = notifications.target_class_id
              and exists (
                select 1
                from unnest(class_scope.student_ids) as enrolled_student(student_id)
                where public.parent_has_student(enrolled_student.student_id)
              )
          )
        )
      )
    )
  );

drop policy if exists notification_reads_owner on public.notification_reads;
create policy notification_reads_owner on public.notification_reads
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists schedule_reads_owner on public.schedule_notification_reads;
create policy schedule_reads_owner on public.schedule_notification_reads
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- The previous policy accidentally compared classes.tutor_id with classes.id,
-- so students/parents could never read the payment branding for their teacher.
drop policy if exists teacher_settings_read on public.kv_teacher_settings;
create policy teacher_settings_read on public.kv_teacher_settings
  for select to authenticated
  using (
    (select public.get_my_role()) = 'admin'
    or id = (select public.my_teacher_id())
    or exists (
      select 1
      from public.classes class_scope
      where class_scope.tutor_id = kv_teacher_settings.id
        and (
          (select public.my_student_id()) = any(class_scope.student_ids)
          or exists (
            select 1
            from unnest(class_scope.student_ids) as enrolled_student(student_id)
            where public.parent_has_student(enrolled_student.student_id)
          )
        )
    )
  );

-- Replace write policies declared as FOR ALL with command-specific policies.
-- Their old SELECT branch overlapped the dedicated read policy on each table,
-- making Postgres evaluate both permissive expressions for every returned row.
do $$
declare
  target record;
  source_policy record;
  using_expression text;
  check_expression text;
begin
  for target in
    select * from (values
      ('class_attendance', 'class_attendance_write'),
      ('class_materials', 'class_materials_teacher_write'),
      ('class_teacher_overrides', 'class_overrides_admin_write'),
      ('classes', 'classes_teacher_write'),
      ('course_reviews', 'course_reviews_owner_write'),
      ('homework_attachments', 'homework_attachments_teacher_write'),
      ('kv_class_extra_students', 'kv_class_extra_students_teacher_write'),
      ('kv_session_notes', 'kv_session_notes_teacher_write'),
      ('kv_student_packages', 'kv_student_packages_teacher_write'),
      ('kv_tuition', 'kv_tuition_teacher_write'),
      ('schedule_notifications', 'schedule_notifications_teacher_write'),
      ('teacher_extra_classes', 'teacher_extra_classes_write'),
      ('teacher_homework', 'teacher_homework_write'),
      ('teacher_materials', 'teacher_materials_write')
    ) as policies(table_name, policy_name)
  loop
    select
      pg_get_expr(policy.polqual, policy.polrelid) as using_expression,
      pg_get_expr(policy.polwithcheck, policy.polrelid) as check_expression
    into source_policy
    from pg_policy policy
    join pg_class relation on relation.oid = policy.polrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = target.table_name
      and policy.polname = target.policy_name
      and policy.polcmd = '*';

    if not found then
      raise exception 'Expected FOR ALL policy %.% was not found.', target.table_name, target.policy_name;
    end if;

    using_expression := source_policy.using_expression;
    check_expression := source_policy.check_expression;
    execute format('drop policy %I on public.%I', target.policy_name, target.table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (%s)',
      target.policy_name || '_insert', target.table_name, check_expression
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
      target.policy_name || '_update', target.table_name, using_expression, check_expression
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (%s)',
      target.policy_name || '_delete', target.table_name, using_expression
    );
  end loop;
end
$$;

-- student_comments includes auth.uid(), so define its split policies explicitly
-- with the statement-cached form instead of copying the old expression.
drop policy if exists student_comments_teacher_write on public.student_comments;
drop policy if exists student_comments_teacher_write_insert on public.student_comments;
drop policy if exists student_comments_teacher_write_update on public.student_comments;
drop policy if exists student_comments_teacher_write_delete on public.student_comments;
create policy student_comments_teacher_write_insert on public.student_comments
  for insert to authenticated
  with check (
    (select public.get_my_role()) = 'admin'
    or (public.teaches_student(student_id) and author_user_id = (select auth.uid()))
  );
create policy student_comments_teacher_write_update on public.student_comments
  for update to authenticated
  using (
    (select public.get_my_role()) = 'admin'
    or (public.teaches_student(student_id) and author_user_id = (select auth.uid()))
  )
  with check (
    (select public.get_my_role()) = 'admin'
    or (public.teaches_student(student_id) and author_user_id = (select auth.uid()))
  );
create policy student_comments_teacher_write_delete on public.student_comments
  for delete to authenticated
  using (
    (select public.get_my_role()) = 'admin'
    or (public.teaches_student(student_id) and author_user_id = (select auth.uid()))
  );

drop policy if exists teacher_settings_owner_write on public.kv_teacher_settings;
drop policy if exists teacher_settings_owner_write_insert on public.kv_teacher_settings;
drop policy if exists teacher_settings_owner_write_update on public.kv_teacher_settings;
drop policy if exists teacher_settings_owner_write_delete on public.kv_teacher_settings;
create policy teacher_settings_owner_write_insert on public.kv_teacher_settings
  for insert to authenticated
  with check (
    (select public.get_my_role()) = 'admin'
    or id = (select public.my_teacher_id())
  );
create policy teacher_settings_owner_write_update on public.kv_teacher_settings
  for update to authenticated
  using (
    (select public.get_my_role()) = 'admin'
    or id = (select public.my_teacher_id())
  )
  with check (
    (select public.get_my_role()) = 'admin'
    or id = (select public.my_teacher_id())
  );
create policy teacher_settings_owner_write_delete on public.kv_teacher_settings
  for delete to authenticated
  using (
    (select public.get_my_role()) = 'admin'
    or id = (select public.my_teacher_id())
  );

-- Service-only tables are intentionally inaccessible from browser clients.
-- Explicit deny policies document that contract and keep RLS audits unambiguous.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'api_rate_limits', 'class_leaderboard_settings',
    'class_question_messages', 'class_questions',
    'class_registration_requests', 'kv_invoices', 'learning_goals',
    'purchase_transactions', 'student_badges', 'student_lesson_progress',
    'student_support_alerts', 'student_topic_mastery', 'student_xp_events',
    'weekly_parent_reports'
  ]
  loop
    execute format('drop policy if exists service_only_deny on public.%I', table_name);
    execute format(
      'create policy service_only_deny on public.%I as restrictive for all to anon, authenticated using (false) with check (false)',
      table_name
    );
  end loop;
end
$$;
