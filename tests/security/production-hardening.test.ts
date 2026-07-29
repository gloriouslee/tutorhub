import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isCompleteStudentProfile,
  isValidDateOfBirth,
  normalizeContactPhone,
  normalizeStudentGrade,
  validatePassword,
} from "../../src/lib/validation";
import {
  resolveRegistrationTuition,
  tuitionForPackage,
} from "../../src/lib/registration-pricing";

const read = (path: string) => readFile(path, "utf8");

test("password policy rejects weak and accepts strong passwords", () => {
  assert.equal(validatePassword("demo1234"), "password_too_short");
  assert.equal(validatePassword("longbutlowercase1!"), "password_needs_uppercase");
  assert.equal(validatePassword("Valid-Password9"), null);
});

test("student onboarding validates every required profile field", () => {
  assert.equal(isValidDateOfBirth("2010-02-28"), true);
  assert.equal(isValidDateOfBirth("2010-02-30"), false);
  assert.equal(normalizeStudentGrade("12"), "Lớp 12");
  assert.equal(normalizeStudentGrade("Lớp 13"), null);
  assert.equal(normalizeContactPhone("0912 345 678"), "0912345678");
  assert.equal(normalizeContactPhone("123"), null);
  assert.equal(
    isCompleteStudentProfile({
      full_name: "Nguyễn Văn A",
      dob: "2010-02-28",
      school: "THPT Nguyễn Trãi",
      grade: "Lớp 10",
      phone: "0912345678",
    }),
    true,
  );
  assert.equal(
    isCompleteStudentProfile({
      full_name: "Nguyễn Văn A",
      dob: "",
      school: "THPT Nguyễn Trãi",
      grade: "Lớp 10",
      phone: "0912345678",
    }),
    false,
  );
});

test("class registration tuition resolves all three session package prices", () => {
  const tuition = resolveRegistrationTuition(
    {
      unit_prices: {
        "2026-06": { online: 80_000, advanced: 100_000, offline: 140_000 },
        "2026-07": { online: 90_000, advanced: 110_000, offline: 150_000 },
      },
    },
    "2026-07",
  );
  assert.deepEqual(tuition, {
    period: "2026-07",
    billing_unit: "session",
    online: 90_000,
    advanced: 110_000,
    offline: 150_000,
  });
  assert.equal(tuitionForPackage(tuition, "online"), 90_000);
  assert.equal(tuitionForPackage(tuition, "advanced"), 110_000);
  assert.equal(tuitionForPackage(tuition, "offline"), 150_000);
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

test("proxy keeps API and anonymous public traffic on the fast path", async () => {
  const proxy = await read("src/proxy.ts");
  const apiFastPath = proxy.indexOf('pathname.startsWith("/api/")');
  const identityLookup = proxy.indexOf(
    "getRequestIdentity(request, response)",
  );
  assert.ok(apiFastPath >= 0 && apiFastPath < identityLookup);
  assert.match(proxy, /hasSupabaseAuthCookie/);
  assert.match(proxy, /pathname === "\/enroll"/);

  const auth = await read("src/lib/api-auth.ts");
  assert.match(auth, /auth\.getClaims\(\)/);
  assert.doesNotMatch(auth, /auth\.getUser\(\)/);
  assert.match(auth, /Promise\.all/);
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

test("class registration is student-created and teacher-reviewed", async () => {
  const collectionRoute = await read(
    "src/app/api/class-registration-requests/route.ts",
  );
  assert.match(collectionRoute, /actor\?\.role !== "student"/);
  assert.match(collectionRoute, /actor\.studentId/);
  assert.match(collectionRoute, /hasValidMutationOrigin/);
  assert.match(collectionRoute, /\.from\("class_registration_requests"\)/);
  assert.match(collectionRoute, /\.eq\("tutor_id", actor\.teacherId\)/);
  assert.match(collectionRoute, /body\.package_type/);
  assert.match(collectionRoute, /requested_package: requestedPackage/);
  assert.match(collectionRoute, /requested_unit_price: requestedUnitPrice/);

  const reviewRoute = await read(
    "src/app/api/class-registration-requests/[id]/route.ts",
  );
  assert.match(reviewRoute, /actor\?\.role !== "teacher"/);
  assert.match(reviewRoute, /review_class_registration_request_secure/);
  assert.match(reviewRoute, /p_teacher_id: actor\.teacherId/);
  assert.match(reviewRoute, /hasValidMutationOrigin/);
  assert.doesNotMatch(reviewRoute, /role !== "admin"/);

  const migration = await read(
    "supabase/migrations/20260729160000_class_registration_packages.sql",
  );
  assert.match(migration, /requested_package/);
  assert.match(migration, /requested_unit_price/);
  assert.match(migration, /insert into public\.kv_student_packages/);
});

test("class catalog exposes session-only roadmap and sanitized materials", async () => {
  const catalogRoute = await read("src/app/api/class-catalog/route.ts");
  assert.match(catalogRoute, /actor\?\.role !== "student"/);
  assert.match(catalogRoute, /\.eq\("published", true\)/);
  assert.match(catalogRoute, /resolveRegistrationTuition/);
  assert.match(catalogRoute, /\.from\("kv_tuition"\)/);
  assert.doesNotMatch(catalogRoute, /session\.lessons/);
  assert.doesNotMatch(catalogRoute, /lesson\.is_published/);
  assert.doesNotMatch(catalogRoute, /video_url|file_url|exam_content/);
});

test("password recovery follows Supabase reset and update flow", async () => {
  const forgotPage = await read("src/app/forgot-password/page.tsx");
  assert.match(forgotPage, /resetPasswordForEmail/);
  assert.match(
    forgotPage,
    /\/auth\/callback\?next=\/update-password/,
  );

  const updatePage = await read("src/app/update-password/page.tsx");
  assert.match(updatePage, /auth\.updateUser\(\{ password \}\)/);
  assert.match(updatePage, /validatePassword/);

  const callback = await read("src/app/auth/callback/route.ts");
  assert.match(callback, /exchangeCodeForSession/);
});

test("self-service signup creates a blank student without enrollment", async () => {
  const signupPage = await read("src/app/signup/page.tsx");
  assert.match(signupPage, /\/api\/auth\/signup/);
  assert.doesNotMatch(signupPage, /\/api\/enrollments|requested_class_id/);

  const signupRoute = await read("src/app/api/auth/signup/route.ts");
  assert.match(signupRoute, /publicAuth\.auth\.signUp/);
  assert.match(signupRoute, /self_service_signup: true/);
  assert.match(signupRoute, /hasValidMutationOrigin/);
  assert.match(signupRoute, /consumeRateLimit/);
  assert.match(signupRoute, /\.from\("students"\)\.upsert/);
  assert.doesNotMatch(signupRoute, /enrollment_requests|student_ids/);

  const migration = await read(
    "supabase/migrations/20260729130000_self_service_student_signup.sql",
  );
  assert.match(migration, /insert into public\.students/);
  assert.match(migration, /'stu_' \|\| new\.id::text/);
  assert.doesNotMatch(migration, /insert into public\.enrollment_requests/);
  assert.doesNotMatch(migration, /update public\.classes/);

  const proxy = await read("src/proxy.ts");
  assert.match(proxy, /"\/signup"/);
  assert.match(proxy, /"\/forgot-password"/);
});

test("incomplete student profiles are forced through onboarding", async () => {
  const proxy = await read("src/proxy.ts");
  assert.match(proxy, /!identity\.profileComplete/);
  assert.match(proxy, /"\/student\/onboarding"/);

  const login = await read("src/app/login/page.tsx");
  assert.match(login, /identity\.role === "student"/);
  assert.match(login, /!identity\.profileComplete/);

  const identity = await read("src/lib/api-auth.ts");
  assert.match(identity, /isCompleteStudentProfile/);
  assert.match(identity, /profileComplete/);

  const onboarding = await read("src/app/student/onboarding/page.tsx");
  assert.match(onboarding, /\/api\/account\/profile/);
  assert.match(onboarding, /profile_complete/);
  assert.match(onboarding, /resetAccountContextCache/);

  const profileRoute = await read("src/app/api/account/profile/route.ts");
  assert.match(profileRoute, /normalizeContactPhone/);
  assert.match(profileRoute, /normalizeStudentGrade/);
  assert.match(profileRoute, /profile_complete/);
});
