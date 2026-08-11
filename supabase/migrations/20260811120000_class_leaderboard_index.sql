-- Support per-class leaderboard reads without scanning all exam scores.
create index if not exists app_exam_scores_class_student_idx
  on public.app_exam_scores (class_id, student_ref);
