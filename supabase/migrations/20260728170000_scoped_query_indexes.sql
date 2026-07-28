-- Support the scoped reads used by student, parent, and teacher dashboards.

create index if not exists class_attendance_student_date_idx
  on public.class_attendance (student_id, attendance_date desc);

create index if not exists hw_submissions_class_idx
  on public.hw_submissions (class_id)
  where class_id is not null;
