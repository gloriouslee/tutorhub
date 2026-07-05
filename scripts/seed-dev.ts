/**
 * Dev seed script — populates a fresh Supabase project with realistic test data.
 * Usage:  npx tsx scripts/seed-dev.ts
 *
 * Requires env vars (in .env.local or shell):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Admin client bypasses RLS
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function createAuthUser(
  email: string,
  password: string,
  role: string,
  fullName: string,
): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, full_name: fullName },
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  return data.user.id;
}

async function insert<T extends object>(table: string, rows: T | T[]): Promise<void> {
  const arr = Array.isArray(rows) ? rows : [rows];
  const { error } = await supabase.from(table).insert(arr);
  if (error) throw new Error(`insert(${table}): ${error.message}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱  Starting TutorHub dev seed...\n");

  // ── 1. Auth users ──────────────────────────────────────────────────────────
  console.log("  Creating auth users...");

  const adminId    = await createAuthUser("admin@tutorhub.dev",    "Admin@123",   "admin",   "Quản Trị Viên");
  const t1Id       = await createAuthUser("hung@tutorhub.dev",     "Teacher@123", "teacher", "Thầy Hùng Toán");
  const t2Id       = await createAuthUser("lananh@tutorhub.dev",   "Teacher@123", "teacher", "Cô Lan Anh");
  const t3Id       = await createAuthUser("minhtri@tutorhub.dev",  "Teacher@123", "teacher", "Thầy Minh Trí");
  const s1UserId   = await createAuthUser("tuan@tutorhub.dev",     "Student@123", "student", "Nguyễn Anh Tuấn");
  const s2UserId   = await createAuthUser("phuong@tutorhub.dev",   "Student@123", "student", "Trần Mai Phương");
  const s3UserId   = await createAuthUser("duc@tutorhub.dev",      "Student@123", "student", "Lê Hoàng Đức");
  const s4UserId   = await createAuthUser("my@tutorhub.dev",       "Student@123", "student", "Phạm Thảo My");
  const s5UserId   = await createAuthUser("nam@tutorhub.dev",      "Student@123", "student", "Vũ Nhật Nam");
  const p1UserId   = await createAuthUser("parent1@tutorhub.dev",  "Parent@123",  "parent",  "Nguyễn Văn Bình");
  const p2UserId   = await createAuthUser("parent2@tutorhub.dev",  "Parent@123",  "parent",  "Trần Thị Hoa");

  console.log("  ✅  Auth users created");

  // ── 2. Profiles (auto-created by trigger, but update role via upsert) ──────
  // The trigger handle_new_user() already created profiles from user_metadata.
  // Update them to ensure role is correct.
  console.log("  Updating profiles...");
  await supabase.from("profiles").upsert([
    { id: adminId,  email: "admin@tutorhub.dev",   role: "admin" },
    { id: t1Id,     email: "hung@tutorhub.dev",     role: "teacher" },
    { id: t2Id,     email: "lananh@tutorhub.dev",   role: "teacher" },
    { id: t3Id,     email: "minhtri@tutorhub.dev",  role: "teacher" },
    { id: s1UserId, email: "tuan@tutorhub.dev",     role: "student" },
    { id: s2UserId, email: "phuong@tutorhub.dev",   role: "student" },
    { id: s3UserId, email: "duc@tutorhub.dev",      role: "student" },
    { id: s4UserId, email: "my@tutorhub.dev",       role: "student" },
    { id: s5UserId, email: "nam@tutorhub.dev",      role: "student" },
    { id: p1UserId, email: "parent1@tutorhub.dev",  role: "parent" },
    { id: p2UserId, email: "parent2@tutorhub.dev",  role: "parent" },
  ]);
  console.log("  ✅  Profiles updated");

  // ── 3. Parents ────────────────────────────────────────────────────────────
  console.log("  Creating parents...");
  const { data: parents } = await supabase.from("parents").insert([
    { user_id: p1UserId, full_name: "Nguyễn Văn Bình", phone: "0901234567" },
    { user_id: p2UserId, full_name: "Trần Thị Hoa",    phone: "0912345678" },
  ]).select();
  const [par1, par2] = parents!;
  console.log("  ✅  Parents created");

  // ── 4. Teachers ───────────────────────────────────────────────────────────
  console.log("  Creating teachers...");
  const { data: teachers } = await supabase.from("teachers").insert([
    {
      user_id: t1Id,
      full_name: "Thầy Hùng Toán",
      specialization: "Toán Đại Số & Luyện Thi",
      bio: "10 năm kinh nghiệm chuyên luyện thi Đại học khối A, A1.",
    },
    {
      user_id: t2Id,
      full_name: "Cô Lan Anh",
      specialization: "Toán Hình Học",
      bio: "Đam mê truyền cảm hứng học Hình học không gian cho học sinh THPT.",
    },
    {
      user_id: t3Id,
      full_name: "Thầy Minh Trí",
      specialization: "Toán Olympic & Nâng Cao",
      bio: "Cựu học sinh chuyên Toán, chuyên bồi dưỡng học sinh giỏi Toán cấp Quốc gia.",
    },
  ]).select();
  const [teacher1, teacher2, teacher3] = teachers!;
  console.log("  ✅  Teachers created");

  // ── 5. Students ───────────────────────────────────────────────────────────
  console.log("  Creating students...");
  const { data: students } = await supabase.from("students").insert([
    {
      user_id: s1UserId,
      full_name: "Nguyễn Anh Tuấn",
      dob: "2008-03-15",
      school: "THPT Nguyễn Thị Minh Khai",
      grade: "Lớp 12",
      learning_type: "hybrid",
      parent_id: par1.id,
    },
    {
      user_id: s2UserId,
      full_name: "Trần Mai Phương",
      dob: "2009-07-22",
      school: "Lincoln High School",
      grade: "Lớp 10",
      learning_type: "online",
      parent_id: par2.id,
    },
    {
      user_id: s3UserId,
      full_name: "Lê Hoàng Đức",
      dob: "2011-01-08",
      school: "Greenwood Elementary",
      grade: "Lớp 7",
      learning_type: "offline",
      parent_id: par1.id,
    },
    {
      user_id: s4UserId,
      full_name: "Phạm Thảo My",
      dob: "2010-11-30",
      school: "Riverside Middle School",
      grade: "Lớp 8",
      learning_type: "hybrid",
      parent_id: par1.id,
    },
    {
      user_id: s5UserId,
      full_name: "Vũ Nhật Nam",
      dob: "2009-05-14",
      school: "Lincoln High School",
      grade: "Lớp 10",
      learning_type: "online",
      parent_id: par2.id,
    },
  ]).select();
  const [stu1, stu2, stu3, stu4, stu5] = students!;
  console.log("  ✅  Students created");

  // ── 6. Classes ────────────────────────────────────────────────────────────
  console.log("  Creating classes...");
  const { data: classes } = await supabase.from("classes").insert([
    {
      class_name: "Toán Nâng Cao 12",
      subject: "Toán học",
      grade: 12,
      learning_mode: "hybrid",
      tutor_id: teacher1.id,
      classroom: "Phòng 201",
      zoom_link: "https://zoom.us/j/123456789",
      schedule: [
        { day: "Monday",    start_time: "18:00", end_time: "19:30" },
        { day: "Wednesday", start_time: "18:00", end_time: "19:30" },
      ],
      description: "Đại số, Tích phân và Hình học không gian chuẩn bị cho kỳ thi THPT Quốc Gia.",
      max_students: 15,
      color: "#6366f1",
    },
    {
      class_name: "Chuyên đề Hình Học 11",
      subject: "Toán học",
      grade: 11,
      learning_mode: "offline",
      tutor_id: teacher2.id,
      classroom: "Phòng 105",
      schedule: [
        { day: "Tuesday",  start_time: "19:30", end_time: "21:00" },
        { day: "Thursday", start_time: "19:30", end_time: "21:00" },
      ],
      description: "Lấy gốc và học sâu Hình học không gian, vectơ trong không gian.",
      max_students: 12,
      color: "#f59e0b",
    },
    {
      class_name: "Toán Đại Số 10 Cơ Bản",
      subject: "Toán học",
      grade: 10,
      learning_mode: "online",
      tutor_id: teacher1.id,
      zoom_link: "https://zoom.us/j/987654321",
      schedule: [
        { day: "Wednesday", start_time: "19:30", end_time: "21:00" },
        { day: "Friday",    start_time: "19:30", end_time: "21:00" },
      ],
      description: "Củng cố kiến thức nền tảng Đại số lớp 10, phương trình, hệ phương trình.",
      max_students: 20,
      color: "#10b981",
    },
    {
      class_name: "Đội Tuyển Olympic Toán 9",
      subject: "Toán học",
      grade: 9,
      learning_mode: "offline",
      tutor_id: teacher3.id,
      classroom: "Phòng 301",
      zoom_link: "https://zoom.us/j/456789123",
      schedule: [
        { day: "Saturday", start_time: "14:00", end_time: "17:00" },
      ],
      description: "Bồi dưỡng chuyên sâu Số học, Tổ hợp, Bất đẳng thức dành cho học sinh giỏi thi chuyên.",
      max_students: 8,
      color: "#ec4899",
    },
  ]).select();
  const [cls1, cls2, cls3, cls4] = classes!;
  console.log("  ✅  Classes created");

  // ── 7. Enrollments ────────────────────────────────────────────────────────
  console.log("  Creating enrollments...");
  await insert("enrollments", [
    { student_id: stu1.id, class_id: cls1.id, status: "active" },
    { student_id: stu2.id, class_id: cls1.id, status: "active" },
    { student_id: stu4.id, class_id: cls1.id, status: "active" },
    { student_id: stu1.id, class_id: cls2.id, status: "active" },
    { student_id: stu5.id, class_id: cls2.id, status: "active" },
    { student_id: stu2.id, class_id: cls3.id, status: "active" },
    { student_id: stu3.id, class_id: cls3.id, status: "active" },
    { student_id: stu3.id, class_id: cls4.id, status: "active" },
    { student_id: stu4.id, class_id: cls4.id, status: "active" },
  ]);
  console.log("  ✅  Enrollments created");

  // ── 8. Homework ───────────────────────────────────────────────────────────
  console.log("  Creating homework...");
  const { data: hw } = await supabase.from("homework").insert([
    {
      class_id: cls1.id,
      title: "Bài tập Đạo hàm - Chương 1",
      description: "Tính đạo hàm các hàm số cho trước. Áp dụng quy tắc tích, thương, hàm hợp.",
      due_date: "2025-06-10",
    },
    {
      class_id: cls1.id,
      title: "Bài tập Tích phân - Chương 2",
      description: "Tính tích phân xác định, ứng dụng tính diện tích hình phẳng.",
      due_date: "2025-06-20",
    },
    {
      class_id: cls1.id,
      title: "Bài kiểm tra giữa kỳ",
      description: "Ôn tập chương 1 và 2. Hình thức thi trắc nghiệm + tự luận.",
      due_date: "2025-07-01",
    },
    {
      class_id: cls2.id,
      title: "Hình học không gian - Phần 1",
      description: "Bài tập về mặt phẳng và đường thẳng trong không gian.",
      due_date: "2025-06-15",
    },
    {
      class_id: cls3.id,
      title: "Phương trình bậc 2",
      description: "Giải phương trình bậc 2 một ẩn, biện luận theo tham số m.",
      due_date: "2025-06-12",
    },
    {
      class_id: cls4.id,
      title: "Đề ôn Olympic - Số học",
      description: "Các bài toán số học chọn lọc từ đề thi Olympic cấp tỉnh.",
      due_date: "2025-06-25",
    },
  ]).select();
  const [hw1, hw2, hw3, hw4, hw5, hw6] = hw!;
  console.log("  ✅  Homework created");

  // ── 9. Submissions ────────────────────────────────────────────────────────
  console.log("  Creating submissions...");
  await insert("submissions", [
    // hw1: Tuấn graded, Phương submitted
    {
      homework_id: hw1.id,
      student_id: stu1.id,
      student_name: "Nguyễn Anh Tuấn",
      file_name: "bai-tap-dao-ham-tuan.pdf",
      file_size: 245000,
      status: "graded",
      submitted_at: "2025-06-08T14:30:00Z",
      score: 8.5,
      feedback: "Bài làm tốt, cần chú ý bước trình bày quy tắc hàm hợp rõ hơn.",
      graded_at: "2025-06-09T10:00:00Z",
    },
    {
      homework_id: hw1.id,
      student_id: stu2.id,
      student_name: "Trần Mai Phương",
      file_name: "dao-ham-phuong.pdf",
      file_size: 198000,
      status: "submitted",
      submitted_at: "2025-06-09T20:15:00Z",
    },
    // hw2: My graded
    {
      homework_id: hw2.id,
      student_id: stu4.id,
      student_name: "Phạm Thảo My",
      file_name: "tich-phan-my.pdf",
      file_size: 312000,
      status: "graded",
      submitted_at: "2025-06-18T16:00:00Z",
      score: 9.0,
      feedback: "Xuất sắc! Trình bày rõ ràng, logic.",
      graded_at: "2025-06-19T08:30:00Z",
    },
    // hw4: Tuấn submitted
    {
      homework_id: hw4.id,
      student_id: stu1.id,
      student_name: "Nguyễn Anh Tuấn",
      file_name: "hinh-hoc-kg-tuan.pdf",
      file_size: 425000,
      status: "submitted",
      submitted_at: "2025-06-14T19:45:00Z",
    },
    // hw5: Phương graded, Đức submitted
    {
      homework_id: hw5.id,
      student_id: stu2.id,
      student_name: "Trần Mai Phương",
      file_name: "pt-bac2-phuong.pdf",
      file_size: 178000,
      status: "graded",
      submitted_at: "2025-06-10T21:00:00Z",
      score: 7.5,
      feedback: "Cần xem lại phần biện luận khi m = 0.",
      graded_at: "2025-06-11T09:00:00Z",
    },
    {
      homework_id: hw5.id,
      student_id: stu3.id,
      student_name: "Lê Hoàng Đức",
      file_name: "pt-bac2-duc.docx",
      file_size: 95000,
      status: "submitted",
      submitted_at: "2025-06-11T22:30:00Z",
    },
    // hw6: Đức graded
    {
      homework_id: hw6.id,
      student_id: stu3.id,
      student_name: "Lê Hoàng Đức",
      file_name: "olympic-so-hoc-duc.pdf",
      file_size: 567000,
      status: "graded",
      submitted_at: "2025-06-22T15:00:00Z",
      score: 10.0,
      feedback: "Hoàn hảo! Tất cả các bài đều đúng và có cách giải sáng tạo.",
      graded_at: "2025-06-23T07:00:00Z",
    },
  ]);
  console.log("  ✅  Submissions created");

  // ── 10. Payments ──────────────────────────────────────────────────────────
  console.log("  Creating payments...");
  await insert("payments", [
    {
      student_id: stu1.id, class_id: cls1.id,
      amount: 1800000, due_date: "2025-05-01", paid_date: "2025-04-28",
      payment_status: "paid", description: "Học phí tháng 5 - Toán Nâng Cao 12",
    },
    {
      student_id: stu1.id, class_id: cls1.id,
      amount: 1800000, due_date: "2025-06-01", paid_date: "2025-05-30",
      payment_status: "paid", description: "Học phí tháng 6 - Toán Nâng Cao 12",
    },
    {
      student_id: stu1.id, class_id: cls1.id,
      amount: 1800000, due_date: "2025-07-01",
      payment_status: "pending", description: "Học phí tháng 7 - Toán Nâng Cao 12",
    },
    {
      student_id: stu1.id, class_id: cls2.id,
      amount: 1500000, due_date: "2025-06-01", paid_date: "2025-06-02",
      payment_status: "paid", description: "Học phí tháng 6 - Hình Học 11",
    },
    {
      student_id: stu2.id, class_id: cls1.id,
      amount: 1800000, due_date: "2025-06-01",
      payment_status: "overdue", description: "Học phí tháng 6 - Toán Nâng Cao 12",
    },
    {
      student_id: stu2.id, class_id: cls3.id,
      amount: 1200000, due_date: "2025-07-01",
      payment_status: "pending", description: "Học phí tháng 7 - Đại Số 10",
    },
    {
      student_id: stu3.id, class_id: cls3.id,
      amount: 1200000, due_date: "2025-06-01", paid_date: "2025-06-03",
      payment_status: "paid", description: "Học phí tháng 6 - Đại Số 10",
    },
    {
      student_id: stu4.id, class_id: cls1.id,
      amount: 1800000, due_date: "2025-07-01",
      payment_status: "pending", description: "Học phí tháng 7 - Toán Nâng Cao 12",
    },
    {
      student_id: stu5.id, class_id: cls2.id,
      amount: 1500000, due_date: "2025-06-01", paid_date: "2025-06-01",
      payment_status: "paid", description: "Học phí tháng 6 - Hình Học 11",
    },
  ]);
  console.log("  ✅  Payments created");

  // ── 11. Attendance ────────────────────────────────────────────────────────
  console.log("  Creating attendance records...");
  const attendanceDates = ["2025-05-26", "2025-05-28", "2025-06-02", "2025-06-04", "2025-06-09", "2025-06-11"];
  const attendanceRows = [];
  for (const date of attendanceDates) {
    attendanceRows.push({ class_id: cls1.id, student_id: stu1.id, attendance_date: date, status: "present" });
    attendanceRows.push({ class_id: cls1.id, student_id: stu2.id, attendance_date: date, status: date === "2025-06-02" ? "absent" : "present" });
    attendanceRows.push({ class_id: cls1.id, student_id: stu4.id, attendance_date: date, status: date === "2025-06-09" ? "late" : "present" });
  }
  await insert("attendance", attendanceRows);
  console.log("  ✅  Attendance created");

  // ── 12. Notifications ─────────────────────────────────────────────────────
  console.log("  Creating notifications...");
  await insert("notifications", [
    {
      title: "Lịch nghỉ lễ 2/9",
      content: "Thông báo nghỉ học ngày 1-2/9 nhân dịp Quốc Khánh. Lịch bù sẽ được thông báo sau.",
      target_role: "all",
      is_read: false,
    },
    {
      title: "Bài kiểm tra giữa kỳ sắp đến",
      content: "Bài kiểm tra giữa kỳ lớp Toán Nâng Cao 12 sẽ diễn ra ngày 1/7. Các em chuẩn bị kỹ nhé!",
      target_role: "student",
      is_read: false,
    },
    {
      title: "Học sinh chưa nộp bài",
      content: "Có 3 học sinh chưa nộp bài tập Đạo hàm. Giáo viên cần nhắc nhở.",
      target_role: "teacher",
      is_read: false,
    },
    {
      title: "Học phí tháng 7 sắp đến hạn",
      content: "Học phí tháng 7 sẽ đến hạn vào ngày 1/7. Vui lòng thanh toán đúng hạn.",
      target_role: "parent",
      is_read: false,
    },
    {
      title: "Tài liệu mới được thêm vào lớp học",
      content: "Thầy Hùng Toán vừa thêm Bộ công thức Đạo hàm & Tích phân vào lớp Toán Nâng Cao 12.",
      target_role: "student",
      is_read: false,
    },
    {
      title: "Điểm bài tập đã được chấm",
      content: "Điểm bài tập Đạo hàm của bạn đã được chấm. Vào mục Bài tập để xem kết quả.",
      target_role: "student",
      target_id: s1UserId,
      is_read: false,
    },
  ]);
  console.log("  ✅  Notifications created");

  // ── 13. Exam scores ───────────────────────────────────────────────────────
  console.log("  Creating exam scores...");
  await insert("exam_scores", [
    { student_id: stu1.id, class_id: cls1.id, exam_name: "Kiểm tra 15 phút - Đạo hàm",  score: 9.0,  max_score: 10, exam_date: "2025-05-15" },
    { student_id: stu1.id, class_id: cls1.id, exam_name: "Kiểm tra 1 tiết - Chương 1",   score: 8.25, max_score: 10, exam_date: "2025-05-30" },
    { student_id: stu1.id, class_id: cls2.id, exam_name: "Kiểm tra Hình học không gian",  score: 7.5,  max_score: 10, exam_date: "2025-06-05" },
    { student_id: stu2.id, class_id: cls1.id, exam_name: "Kiểm tra 15 phút - Đạo hàm",  score: 7.0,  max_score: 10, exam_date: "2025-05-15" },
    { student_id: stu2.id, class_id: cls3.id, exam_name: "Kiểm tra Phương trình",         score: 8.5,  max_score: 10, exam_date: "2025-06-01" },
    { student_id: stu3.id, class_id: cls4.id, exam_name: "Đề ôn Olympic số 1",            score: 9.5,  max_score: 10, exam_date: "2025-06-07" },
    { student_id: stu4.id, class_id: cls1.id, exam_name: "Kiểm tra 15 phút - Đạo hàm",  score: 8.0,  max_score: 10, exam_date: "2025-05-15" },
    { student_id: stu5.id, class_id: cls2.id, exam_name: "Kiểm tra Hình học không gian",  score: 6.5,  max_score: 10, exam_date: "2025-06-05" },
  ]);
  console.log("  ✅  Exam scores created");

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log(`
✅  Seed hoàn tất!

📋  Tài khoản test:
┌─────────────────────────────────────────┬──────────────┬──────────────┐
│  Email                                  │  Password    │  Role        │
├─────────────────────────────────────────┼──────────────┼──────────────┤
│  admin@tutorhub.dev                     │  Admin@123   │  admin       │
│  hung@tutorhub.dev                      │  Teacher@123 │  teacher     │
│  lananh@tutorhub.dev                    │  Teacher@123 │  teacher     │
│  minhtri@tutorhub.dev                   │  Teacher@123 │  teacher     │
│  tuan@tutorhub.dev                      │  Student@123 │  student     │
│  phuong@tutorhub.dev                    │  Student@123 │  student     │
│  duc@tutorhub.dev                       │  Student@123 │  student     │
│  my@tutorhub.dev                        │  Student@123 │  student     │
│  nam@tutorhub.dev                       │  Student@123 │  student     │
│  parent1@tutorhub.dev                   │  Parent@123  │  parent      │
│  parent2@tutorhub.dev                   │  Parent@123  │  parent      │
└─────────────────────────────────────────┴──────────────┴──────────────┘
`);
}

main().catch(err => {
  console.error("❌  Seed failed:", err.message);
  process.exit(1);
});
