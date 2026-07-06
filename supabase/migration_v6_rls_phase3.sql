-- ============================================================================
-- RLS GIAI ĐOẠN 3 — phân quyền theo giáo viên / học sinh / lớp
--
-- ⚠️ CHƯA CHẠY FILE NÀY khi app còn chế độ demo (cookie demo_role):
-- các policy dưới đây yêu cầu phiên Supabase Auth thật (auth.uid()).
-- Chạy khi: mọi người dùng đăng nhập bằng Supabase Auth và các nút
-- "Đăng nhập trải nghiệm" đã bị gỡ. Đề thi hiện đã được bảo vệ ở tầng
-- ứng dụng (server-side delivery/grading — đáp án không xuống client).
--
-- Mô hình định danh:
--   profiles.role         : student | parent | teacher | admin
--   teachers.user_id      : auth uid của giáo viên
--   students.user_id      : auth uid của học sinh
--   classes.tutor_id      : id giáo viên phụ trách lớp
--   classes.student_ids[] : id học sinh trong lớp (vd. enr_xxx, sN)
-- ============================================================================

-- ── Helper: role hiện tại (SECURITY DEFINER — tránh đệ quy policy) ──────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid(); $$;

-- id giáo viên gắn với phiên hiện tại (NULL nếu không phải giáo viên)
CREATE OR REPLACE FUNCTION public.my_teacher_id()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$ SELECT id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1; $$;

-- id học sinh gắn với phiên hiện tại (NULL nếu không phải học sinh)
CREATE OR REPLACE FUNCTION public.my_student_id()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$ SELECT id FROM public.students WHERE user_id = auth.uid() LIMIT 1; $$;

-- Giáo viên hiện tại có dạy lớp class_id không?
CREATE OR REPLACE FUNCTION public.teaches_class(class_id TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = class_id AND c.tutor_id = public.my_teacher_id()
  );
$$;

-- Học sinh hiện tại có học lớp class_id không?
CREATE OR REPLACE FUNCTION public.enrolled_in_class(class_id TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = class_id AND public.my_student_id() = ANY(c.student_ids)
  );
$$;

-- ── kv_curriculum (đề thi + giáo trình, id = class_id) ──────────────────────
-- Lưu ý: học sinh KHÔNG được SELECT trực tiếp — đề thi đến học sinh qua
-- API server-side đã lọc đáp án. Chỉ giáo viên dạy lớp + admin thao tác.
DROP POLICY IF EXISTS "phase1_open_all" ON public.kv_curriculum;
DROP POLICY IF EXISTS "p3_curriculum_teacher_all" ON public.kv_curriculum;
CREATE POLICY "p3_curriculum_teacher_all" ON public.kv_curriculum
  FOR ALL
  USING (public.get_my_role() = 'admin' OR public.teaches_class(id))
  WITH CHECK (public.get_my_role() = 'admin' OR public.teaches_class(id));

-- ── kv_exam_results (id = classId_lessonId_studentId) ───────────────────────
-- Học sinh: chỉ đọc kết quả của chính mình. Giáo viên dạy lớp: đọc + chấm.
DROP POLICY IF EXISTS "phase1_open_all" ON public.kv_exam_results;
DROP POLICY IF EXISTS "p3_results_student_read" ON public.kv_exam_results;
DROP POLICY IF EXISTS "p3_results_teacher_all" ON public.kv_exam_results;
CREATE POLICY "p3_results_student_read" ON public.kv_exam_results
  FOR SELECT
  USING (id LIKE '%\_' || public.my_student_id() ESCAPE '\');
CREATE POLICY "p3_results_teacher_all" ON public.kv_exam_results
  FOR ALL
  USING (public.get_my_role() = 'admin'
         OR public.teaches_class(split_part(id, '_', 1)))
  WITH CHECK (public.get_my_role() = 'admin'
              OR public.teaches_class(split_part(id, '_', 1)));
-- (Ghi kết quả khi nộp bài đi qua API service role nên không cần policy INSERT cho học sinh.)

-- ── kv_exam_submissions (registry, id = classId_lessonId) ───────────────────
DROP POLICY IF EXISTS "phase1_open_all" ON public.kv_exam_submissions;
DROP POLICY IF EXISTS "p3_subs_teacher_all" ON public.kv_exam_submissions;
CREATE POLICY "p3_subs_teacher_all" ON public.kv_exam_submissions
  FOR ALL
  USING (public.get_my_role() = 'admin'
         OR public.teaches_class(split_part(id, '_', 1)))
  WITH CHECK (public.get_my_role() = 'admin'
              OR public.teaches_class(split_part(id, '_', 1)));

-- ── Nhóm dữ liệu lớp: giáo viên dạy lớp ghi, học sinh trong lớp đọc ─────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'kv_schedules', 'kv_online_links', 'kv_session_notes',
    'kv_teacher_homework', 'kv_teacher_attendance', 'kv_class_extra_students',
    'kv_student_packages', 'kv_tuition'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "phase1_open_all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "p3_teacher_write" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "p3_class_read" ON public.%I', t);
    -- id = class_id (hoặc 'global' với bảng gộp — global chỉ giáo viên/admin)
    EXECUTE format(
      'CREATE POLICY "p3_teacher_write" ON public.%I FOR ALL
         USING (public.get_my_role() = ''admin''
                OR (id = ''global'' AND public.get_my_role() = ''teacher'')
                OR public.teaches_class(id))
         WITH CHECK (public.get_my_role() = ''admin''
                OR (id = ''global'' AND public.get_my_role() = ''teacher'')
                OR public.teaches_class(id))', t);
    EXECUTE format(
      'CREATE POLICY "p3_class_read" ON public.%I FOR SELECT
         USING (public.enrolled_in_class(id)
                OR (id = ''global'' AND public.get_my_role() IN (''student'',''parent'')))', t);
  END LOOP;
END $$;

-- Các bảng còn lại (kv_invoices, kv_managed_users, purchase_transactions,
-- students/teachers/classes/payments...) siết theo cùng nguyên tắc ở đợt sau —
-- ưu tiên nhóm câu hỏi/đề thi/lớp học theo yêu cầu trước.
