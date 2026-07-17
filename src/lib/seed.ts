// ── Seed dữ liệu THẬT cho báo cáo ─────────────────────────────────────────────
// Ghi vào đúng các bảng thật qua storage layer (kvSet → Supabase upsert):
//   kv_exam_scores, kv_teacher_attendance, kv_tuition, kv_invoices.
// Roster (lớp/học viên) lấy từ dữ liệu hiện có (getClasses/getStudents).
// Idempotent: mỗi lần chạy sẽ GHI ĐÈ các key trên (không cộng dồn trùng lặp).

import {
  getClasses, getStudents, kvSet, saveClassTuition,
  type ClassTuitionConfig, type StoredExamScore, type TuitionInvoice,
  type TeacherAttendanceRecord,
} from "@/lib/storage";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
// pseudo-random ổn định theo chuỗi (để chạy lại cho kết quả giống nhau)
function seeded(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000; // 0..1
}

const FEE_BY_PACKAGE = { online: 800_000, advanced: 1_200_000, offline: 1_500_000 };

export interface SeedResult {
  examScores: number;
  attendance: number;
  tuitionClasses: number;
  invoices: number;
  revenue: number;
}

export async function seedRealData(monthsBack = 5): Promise<SeedResult> {
  const [classes, students] = await Promise.all([getClasses(), getStudents()]);
  const now = new Date();
  const nowMonth0 = new Date(now.getFullYear(), now.getMonth(), 1);

  const examScores: StoredExamScore[] = [];
  const attendance: TeacherAttendanceRecord[] = [];
  const invoices: TuitionInvoice[] = [];
  let revenue = 0;
  let tuitionClasses = 0;

  const EXAM_NAMES = ["Kiểm tra 15 phút", "Kiểm tra 1 tiết", "Thi giữa kỳ", "Kiểm tra chương"];

  for (const c of classes) {
    const sids = c.student_ids ?? [];
    if (sids.length === 0) continue;

    // ── Học phí: mỗi HV đóng mỗi tháng (monthsBack tháng gần nhất) ──
    const fee = FEE_BY_PACKAGE.advanced;
    const cfg: ClassTuitionConfig = { package_fees: { ...FEE_BY_PACKAGE }, students: {} };
    for (const sid of sids) {
      const payments = [];
      for (let m = monthsBack - 1; m >= 0; m--) {
        const period = new Date(nowMonth0.getFullYear(), nowMonth0.getMonth() - m, 1);
        // ~85% tháng đã đóng (ổn định theo sid+tháng)
        if (seeded(`${sid}-pay-${m}`) > 0.15) {
          const paidAt = new Date(period.getFullYear(), period.getMonth(), 5 + Math.floor(seeded(`${sid}-d-${m}`) * 10));
          payments.push({ id: `seed_${c.id}_${sid}_${ym(period)}`, amount: fee, period: ym(period), paid_at: paidAt.toISOString(), method: "transfer" as const });
          revenue += fee;
        }
      }
      cfg.students[sid] = { payments };
    }
    await saveClassTuition(c.id, cfg);
    tuitionClasses++;

    // ── Điểm thi: 3 bài / HV trải đều các tháng ──
    for (const sid of sids) {
      for (let k = 0; k < 3; k++) {
        const d = new Date(nowMonth0.getFullYear(), nowMonth0.getMonth() - (monthsBack - 1) + k * 2, 12);
        if (d > now) continue;
        const score = +(6.5 + seeded(`${sid}-sc-${k}`) * 3.5).toFixed(1); // 6.5..10
        examScores.push({
          id: `seed_${c.id}_${sid}_ex${k}`,
          student_id: sid, class_id: c.id,
          exam_name: EXAM_NAMES[k % EXAM_NAMES.length],
          score, max_score: 10, exam_date: ymd(d),
        });
      }
    }

    // ── Điểm danh: 8 buổi hàng tuần gần nhất / HV ──
    for (let w = 7; w >= 0; w--) {
      const d = new Date(now); d.setDate(d.getDate() - w * 7);
      for (const sid of sids) {
        const r = seeded(`${sid}-att-${w}`);
        const status: TeacherAttendanceRecord["status"] = r > 0.15 ? "present" : r > 0.08 ? "late" : "absent";
        attendance.push({ class_id: c.id, student_id: sid, date: ymd(d), status, saved_at: now.toISOString() });
      }
    }

    // ── Hoá đơn tháng hiện tại (1 HV/lớp) để minh hoạ luồng hoá đơn ──
    const firstSid = sids[0];
    invoices.push({
      id: `seed_inv_${c.id}`,
      child_id: firstSid, class_id: c.id,
      title: `Học phí ${c.class_name} - ${ym(nowMonth0)}`,
      amount: fee, due_date: ymd(new Date(now.getFullYear(), now.getMonth(), 15)),
      status: "paid", paid_at: now.toISOString(), period: ym(nowMonth0),
    });
    revenue += fee;
  }

  // Ghi đè các key thật
  await kvSet("tutorhub_exam_scores", examScores);
  await kvSet("tutorhub_teacher_attendance", attendance);
  await kvSet("tutorhub_invoices", invoices);

  return { examScores: examScores.length, attendance: attendance.length, tuitionClasses, invoices: invoices.length, revenue };
}
