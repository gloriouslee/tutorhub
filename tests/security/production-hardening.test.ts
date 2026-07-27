import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validatePassword } from "../../src/lib/validation";

const read = (path: string) => readFile(path, "utf8");

test("password policy rejects weak and accepts strong passwords", () => {
  assert.equal(validatePassword("demo1234"), "password_too_short");
  assert.equal(validatePassword("longbutlowercase1!"), "password_needs_uppercase");
  assert.equal(validatePassword("Valid-Password9"), null);
});

test("login contains no demo-cookie or enrollment password fallback", async () => {
  const login = await read("src/app/login/page.tsx");
  assert.doesNotMatch(login, /DEMO_USERS|demo_role|account_password|demo1234/);
  assert.match(login, /signInWithPassword/);
});

test("seed route is absent and proxy explicitly blocks it", async () => {
  await assert.rejects(read("src/app/admin/seed/page.tsx"));
  const proxy = await read("src/proxy.ts");
  assert.match(proxy, /pathname === "\/admin\/seed"/);
});

test("production migration drops legacy policies and plaintext columns", async () => {
  const migration = await read(
    "supabase/migrations/20260727140000_production_security.sql",
  );
  assert.match(migration, /from pg_policies/);
  assert.match(migration, /drop column if exists account_password/);
  assert.match(migration, /revoke all on all tables in schema public from anon/);
  assert.match(migration, /set public = false/);
  assert.match(migration, /consume_rate_limit/);
  // Legacy exam_scores keeps UUID foreign keys while the v2 application
  // tables use TEXT identifiers. Authorization must normalize at the boundary.
  assert.match(
    migration,
    /public\.parent_has_student\(student_id::text\)/,
  );
  assert.match(migration, /public\.teaches_class\(class_id::text\)/);
  for (const legacyMigration of [
    "supabase/migration_v2_production.sql",
    "supabase/migration_v3_transactions.sql",
    "supabase/migration_v4_kv.sql",
    "supabase/migration_v5_domain_tables.sql",
    "supabase/migration_teacher_settings.sql",
  ]) {
    assert.doesNotMatch(
      await read(legacyMigration),
      /create\s+policy\s+"phase1_open_all"/i,
    );
  }
});

test("exam client has no client-side grading or direct retry deletion", async () => {
  const examPage = await read(
    "src/app/student/classes/[classId]/exam/[lessonId]/page.tsx",
  );
  assert.doesNotMatch(examPage, /saveExamResult|kvDelete|calcAutoScore/);
  assert.match(examPage, /\/retry/);
  assert.match(examPage, /\/submit/);
});
