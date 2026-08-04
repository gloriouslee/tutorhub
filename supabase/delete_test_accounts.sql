-- ============================================================================
-- Xóa hoàn toàn một số tài khoản (dùng để dọn tài khoản test).
--
-- Vì sao cần script này thay vì chỉ xóa ở Authentication → Users:
--   * profiles      : on delete cascade  -> tự xóa theo. OK.
--   * students      : user_id ... on delete SET NULL -> row students VẪN CÒN,
--                     thành row rác không thuộc về ai.
--   * submissions / app_exam_scores / purchase_transactions / classes.student_ids
--                   : student_id là TEXT, KHÔNG có khoá ngoại -> không tự dọn.
--
-- Cách dùng: sửa danh sách email ở BƯỚC 1, chạy BƯỚC 2 để xem trước,
-- rồi mới chạy BƯỚC 3.
-- ============================================================================


-- ─── BƯỚC 1 + 2: XEM TRƯỚC (không thay đổi gì) ───────────────────────────────
-- Chạy riêng khối này. Kiểm tra đúng người rồi hãy sang bước 3.

with targets as (
  select u.id as user_id, u.email
  from auth.users u
  where lower(u.email) in (
    -- 👇 SỬA DANH SÁCH EMAIL Ở ĐÂY
    'congminhutt@gmail.com',
    'viphacker45@gmail.com'
  )
),
target_students as (
  select distinct s.id as student_id
  from public.students s
  join targets t
    on s.user_id = t.user_id
    or lower(s.email) = lower(t.email)
)
select
  t.email,
  p.role,
  ts.student_id,
  (select count(*) from public.submissions      x where x.student_id = ts.student_id) as submissions,
  (select count(*) from public.payments         x where x.student_id = ts.student_id) as payments,
  (select count(*) from public.attendance       x where x.student_id = ts.student_id) as attendance,
  (select count(*) from public.app_exam_scores  x where x.student_ref = ts.student_id) as exam_scores,
  (select count(*) from public.classes          c where ts.student_id = any(c.student_ids)) as trong_lop
from targets t
left join public.profiles p on p.id = t.user_id
left join target_students ts
  on ts.student_id in (
    select s.id from public.students s
    where s.user_id = t.user_id or lower(s.email) = lower(t.email)
  )
order by t.email;


-- ─── BƯỚC 3: XÓA THẬT ────────────────────────────────────────────────────────
-- Chạy toàn bộ khối dưới đây trong MỘT lần (từ `begin;` tới `commit;`).

begin;

create temp table _targets on commit drop as
select u.id as user_id, lower(u.email) as email
from auth.users u
where lower(u.email) in (
  -- 👇 SỬA DANH SÁCH EMAIL Ở ĐÂY (giống bước 2)
  'congminhutt@gmail.com',
  'viphacker45@gmail.com'
);

create temp table _target_students on commit drop as
select distinct s.id as student_id
from public.students s
join _targets t
  on s.user_id = t.user_id
  or lower(s.email) = t.email;

-- Chặn tai nạn: không cho xóa tài khoản admin (tự khóa mình khỏi hệ thống).
do $$
begin
  if exists (
    select 1 from _targets t
    join public.profiles p on p.id = t.user_id
    where p.role = 'admin'
  ) then
    raise exception 'Danh sách có tài khoản ADMIN. Dừng lại để bạn không tự mất quyền truy cập.';
  end if;
  if not exists (select 1 from _targets) then
    raise exception 'Không tìm thấy email nào trong danh sách. Kiểm tra lại chính tả.';
  end if;
end $$;

-- 3a. Các bảng dùng student_id dạng text, KHÔNG có khoá ngoại -> phải xóa tay.
delete from public.submissions
where student_id in (select student_id from _target_students);

delete from public.app_exam_scores
where student_ref in (select student_id from _target_students);

delete from public.purchase_transactions
where student_id in (select student_id from _target_students);

-- Kết quả bài thi lưu theo khoá ghép '<classId>_<studentId>'.
delete from public.kv_exam_results k
where exists (
  select 1 from _target_students ts
  where k.id like '%\_' || ts.student_id escape '\'
);

-- 3b. Gỡ học sinh khỏi mảng student_ids của các lớp (giữ nguyên thứ tự còn lại).
update public.classes c
set student_ids = coalesce((
  select array_agg(sid order by ord)
  from unnest(c.student_ids) with ordinality as u(sid, ord)
  where sid not in (select student_id from _target_students)
), '{}')
where exists (
  select 1 from unnest(c.student_ids) sid
  where sid in (select student_id from _target_students)
);

-- 3c. Gói học phí lưu dạng jsonb { studentId: package } theo từng lớp.
update public.kv_student_packages k
set value = coalesce((
  select jsonb_object_agg(e.key, e.value)
  from jsonb_each(k.value) as e
  where e.key not in (select student_id from _target_students)
), '{}'::jsonb)
where exists (
  select 1 from jsonb_each(k.value) as e
  where e.key in (select student_id from _target_students)
);

-- 3d. Xóa row students. Cascade sẽ tự dọn:
--     payments, attendance, class_registration_requests, student_lesson_progress.
delete from public.students
where id in (select student_id from _target_students);

-- 3e. Xóa tài khoản đăng nhập. Cascade tự dọn profiles và notification_reads.
delete from auth.users
where id in (select user_id from _targets);

commit;


-- ─── TÙY CHỌN: dọn row students rác của luồng đăng ký cũ đã bỏ ───────────────
-- Xem trước:
--   select id, full_name, email, created_at from public.students
--   where user_id is null and id like 'enr_%' order by created_at;
--
-- Chỉ xóa những row chưa được xếp vào lớp nào (điều kiện not exists bảo vệ
-- những row vẫn đang được dùng thật):
--
--   delete from public.students s
--   where s.user_id is null
--     and s.id like 'enr_%'
--     and not exists (select 1 from public.classes c where s.id = any(c.student_ids));


-- ─── LƯU Ý: file trong Storage không bị xóa bởi SQL ─────────────────────────
-- Bài làm đã tải lên nằm ở bucket 'homework-submissions', ảnh đại diện ở
-- 'avatars', biên lai ở 'payment-receipts'. Nếu cần dọn, xóa thủ công trong
-- Supabase → Storage, hoặc bỏ qua (không ảnh hưởng gì tới hoạt động của app).
