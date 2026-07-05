/**
 * Seed Supabase với mock data nhất quán.
 * Yêu cầu: đã chạy supabase/migration_v2_production.sql trong SQL Editor.
 *
 * Chạy:  npx tsx scripts/seed-supabase.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Nạp .env.local thủ công (không phụ thuộc dotenv)
for (const line of readFileSync(resolve(__dirname, "../.env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Ưu tiên service role; nếu chỉ là placeholder thì dùng anon key
// (policy phase-1 đang mở nên anon ghi được)
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const KEY = svc.startsWith("ey") || svc.startsWith("sb_secret") ? svc : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

import {
  MOCK_STUDENTS, MOCK_PARENTS, MOCK_TEACHERS, MOCK_CLASSES,
  MOCK_PAYMENTS, MOCK_ATTENDANCE, MOCK_NOTIFICATIONS,
  MOCK_HOMEWORK, MOCK_EXAM_SCORES,
} from "../src/lib/mock-data";

async function upsert(table: string, rows: unknown[]) {
  const res = await fetch(`${URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`${table}: ${res.status} ${await res.text()}`);
  }
  console.log(`✓ ${table}: ${rows.length} rows`);
}

async function main() {
  // user_id trong mock là TEXT ("u1"), cột DB là UUID tham chiếu auth — bỏ khi seed
  const stripUserId = ({ user_id, ...rest }: any) => rest;

  // Thứ tự theo foreign key: parents/teachers → students → classes → phần còn lại
  await upsert("parents", MOCK_PARENTS.map(stripUserId));
  await upsert("teachers", MOCK_TEACHERS.map(stripUserId));
  await upsert("students", MOCK_STUDENTS.map(stripUserId));
  await upsert("classes", MOCK_CLASSES.map((c: any) => ({
    id: c.id,
    class_name: c.class_name,
    subject: c.subject,
    grade: c.grade ?? null,
    learning_mode: c.learning_mode,
    tutor_id: c.tutor_id ?? null,
    classroom: c.classroom ?? null,
    zoom_link: c.zoom_link ?? null,
    schedule: c.schedule ?? [],
    student_ids: c.student_ids ?? [],
    description: c.description ?? null,
    max_students: c.max_students ?? 15,
    color: c.color ?? "#6366f1",
    created_at: c.created_at ?? new Date().toISOString(),
  })));
  await upsert("payments", MOCK_PAYMENTS);
  await upsert("attendance", MOCK_ATTENDANCE);
  await upsert("notifications", MOCK_NOTIFICATIONS.map((n: any) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    category: n.category ?? null,
    target_role: n.target_role,
    target_class_id: n.target_class_id ?? null,
    sent_by: n.sent_by ?? null,
    is_read: n.is_read ?? false,
    created_at: n.created_at,
  })));
  await upsert("homework", MOCK_HOMEWORK.map((h: any) => ({
    id: h.id,
    class_id: h.class_id,
    title: h.title,
    description: h.description ?? null,
    due_date: h.due_date,
    attachments: h.attachments ?? [],
    created_at: h.created_at ?? new Date().toISOString(),
  })));
  // id để DB tự sinh (bảng cũ dùng UUID default)
  await upsert("app_exam_scores", MOCK_EXAM_SCORES.map((e: any) => ({
    student_ref: e.student_id,
    class_id: e.class_id,
    exam_name: e.exam_name,
    score: e.score,
    max_score: e.max_score ?? 10,
    exam_date: e.exam_date,
    created_by: e.created_by ?? null,
  })));
  console.log("\nSeed hoàn tất.");
}

main().catch((e) => { console.error("Seed thất bại:", e.message); process.exit(1); });
