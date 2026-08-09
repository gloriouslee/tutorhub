/**
 * Logical, read-only Supabase backup for TutorHub.
 *
 * Exports application tables and Auth users through the service-role API into
 * a gzip-compressed JSON file under .backups/. It never prints row contents or
 * credentials. A full physical pg_dump still requires the database password.
 */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { gzip } from "node:zlib";
import { promisify } from "node:util";
import path from "node:path";

loadEnvConfig(process.cwd());

const gzipAsync = promisify(gzip);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const TABLES = [
  "profiles",
  "students",
  "parents",
  "student_guardians",
  "teachers",
  "classes",
  "attendance",
  "homework",
  "submissions",
  "payments",
  "notifications",
  "materials",
  "exam_scores",
  "app_exam_scores",
  "purchase_transactions",
  "kv_curriculum",
  "kv_schedules",
  "kv_online_links",
  "kv_tuition",
  "kv_student_packages",
  "kv_session_notes",
  "kv_class_extra_students",
  "kv_student_comments",
  "kv_exam_results",
  "kv_exam_submissions",
  "kv_exam_scores",
  "kv_course_reviews",
  "kv_invoices",
  "kv_managed_users",
  "kv_student_accounts",
  "kv_schedule_notifications",
  "kv_homework_attachments",
  "kv_class_materials",
  "kv_class_overrides",
  "kv_teacher_settings",
  "kv_teacher_homework",
  "kv_teacher_classes",
  "kv_teacher_attendance",
  "kv_teacher_materials",
  "kv_submissions",
  "kv_parent_messages",
] as const;

type TableBackup =
  | { status: "ok"; rows: unknown[] }
  | { status: "unavailable"; error: string };

async function readAllRows(table: string): Promise<TableBackup> {
  const rows: unknown[] = [];
  const pageSize = 1_000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);

    if (error) {
      return { status: "unavailable", error: error.message };
    }

    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return { status: "ok", rows };
}

async function readAllAuthUsers() {
  const users: unknown[] = [];
  const perPage = 1_000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) break;
  }

  return users;
}

async function main() {
  const tableData: Record<string, TableBackup> = {};
  for (const table of TABLES) {
    tableData[table] = await readAllRows(table);
  }

  const authUsers = await readAllAuthUsers();
  const payload = {
    format: "tutorhub-logical-backup-v1",
    createdAt: new Date().toISOString(),
    supabaseProjectUrl: url,
    tables: tableData,
    auth: { users: authUsers },
  };

  const json = JSON.stringify(payload);
  const compressed = await gzipAsync(Buffer.from(json), { level: 9 });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), ".backups");
  const backupPath = path.join(
    backupDir,
    `tutorhub-supabase-${timestamp}.json.gz`,
  );
  const checksumPath = `${backupPath}.sha256`;
  const checksum = createHash("sha256").update(compressed).digest("hex");

  await mkdir(backupDir, { recursive: true });
  await writeFile(backupPath, compressed, { mode: 0o600 });
  await writeFile(
    checksumPath,
    `${checksum}  ${path.basename(backupPath)}\n`,
    { mode: 0o600 },
  );

  const backedUp = Object.values(tableData).filter(
    (entry) => entry.status === "ok",
  ).length;
  const unavailable = Object.entries(tableData)
    .filter(([, entry]) => entry.status === "unavailable")
    .map(([table]) => table);

  console.log(`Backup written: ${backupPath}`);
  console.log(`SHA-256 written: ${checksumPath}`);
  console.log(`Tables exported: ${backedUp}/${TABLES.length}`);
  console.log(`Auth users exported: ${authUsers.length}`);
  if (unavailable.length > 0) {
    console.log(`Unavailable tables: ${unavailable.join(", ")}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Backup failed: ${message}`);
  process.exitCode = 1;
});
