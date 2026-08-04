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
  assert.doesNotMatch(proxy, /pathname === "\/enroll"/);

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
  // Must go through the API that also clears must_reset_password. Calling
  // auth.updateUser() directly leaves the flag set, so the route guard bounces
  // the user straight back to /reset-password after a successful recovery.
  assert.match(updatePage, /\/api\/account\/change-password/);
  assert.doesNotMatch(updatePage, /auth\.updateUser/);
  assert.match(updatePage, /validatePassword/);

  // The recovery screen has to survive both route-guard gates: a caller arriving
  // from a recovery email cannot satisfy them until the password is set.
  const guard = await read("src/proxy.ts");
  assert.match(guard, /forced && pathname !== "\/update-password"/);

  const callback = await read("src/app/auth/callback/route.ts");
  assert.match(callback, /exchangeCodeForSession/);
  assert.match(callback, /verifyOtp/);
  assert.match(callback, /token_hash/);
  assert.match(callback, /otpType === "recovery"/);
  // A failed recovery link must land on /forgot-password (a new link is one
  // click away) and must say *why* it failed, so the user knows whether to wait,
  // switch browser, or request another link.
  assert.match(callback, /failurePath = isRecovery \? "\/forgot-password"/);
  assert.match(callback, /searchParams\.set\("error", classifyFailure\(error\)\)/);
  assert.match(callback, /link_wrong_browser/);
  assert.match(callback, /link_expired/);

  // Both email templates must build their link from a server-verifiable token
  // hash. {{ .ConfirmationURL }} issues a PKCE code that only the requesting
  // browser can exchange, which breaks recovery across devices and breaks
  // signup entirely (signup runs server-side, so no verifier is ever stored).
  for (const [file, otpType] of [
    ["supabase/email-templates/recovery.html", "recovery"],
    ["supabase/email-templates/confirmation.html", "signup"],
  ] as const) {
    const template = await read(file);
    assert.match(template, /\{\{ \.RedirectTo \}\}/);
    assert.match(template, /\{\{ \.TokenHash \}\}/);
    assert.match(template, new RegExp(`type=${otpType}`));
    assert.doesNotMatch(template, /ConfirmationURL/);
  }
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

test("legacy public enrollment workflow is fully retired", async () => {
  for (const retiredRoute of [
    "src/app/enroll/page.tsx",
    "src/app/admin/enrollments/page.tsx",
    "src/app/api/enrollments/route.ts",
    "src/app/api/enrollments/[id]/route.ts",
    "src/app/api/public/classes/route.ts",
  ]) {
    await assert.rejects(read(retiredRoute));
  }

  const sidebar = await read("src/components/layout/Sidebar.tsx");
  const storage = await read("src/lib/storage.ts");
  const profileRoute = await read("src/app/api/account/profile/route.ts");
  assert.doesNotMatch(sidebar, /\/admin\/enrollments|getEnrollments/);
  assert.doesNotMatch(storage, /\/api\/enrollments|EnrollmentRequest/);
  assert.doesNotMatch(profileRoute, /\.from\("enrollment_requests"\)/);

  const migration = await read(
    "supabase/migrations/20260729170000_remove_legacy_enrollment_flow.sql",
  );
  assert.match(migration, /drop table if exists public\.enrollment_requests/);
  assert.match(migration, /drop table if exists public\.enrollments/);
  assert.match(migration, /drop function if exists public\.approve_enrollment_request_secure/);
  assert.match(migration, /drop function if exists public\.delete_enrollment_request_secure/);
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

test("admin entity writes are row-level and lifecycle-aware", async () => {
  const entityRoute = await read("src/app/api/data/entities/[entity]/route.ts");
  const storage = await read("src/lib/storage.ts");
  const migration = await read(
    "supabase/migrations/20260729180000_admin_portal_hardening.sql",
  );

  assert.match(entityRoute, /export async function POST/);
  assert.match(entityRoute, /export async function DELETE/);
  assert.match(entityRoute, /delete_admin_domain_identity_secure/);
  assert.doesNotMatch(entityRoute, /replace_admin_entity_rows_secure|export async function PUT/);
  assert.doesNotMatch(storage, /saveEntity|saveStudents|saveTeachers|saveNotifications/);
  assert.match(migration, /drop function if exists public\.replace_admin_entity_rows_secure/);
  assert.match(migration, /student_has_classes/);
  assert.match(migration, /teacher_has_classes/);
});

test("teacher payment approvals are scoped to the owning class", async () => {
  const route = await read("src/app/api/payments/transactions/route.ts");
  const migration = await read(
    "supabase/migrations/20260729180000_admin_portal_hardening.sql",
  );

  assert.match(route, /\.eq\("teacher_id", actor\.teacherId\)/);
  assert.match(route, /teacher_id: product\.teacherId/);
  assert.match(route, /class_id: product\.classId/);
  assert.match(migration, /add column if not exists teacher_id/);
  assert.match(migration, /purchase_transactions_teacher_status_idx/);

  await assert.rejects(read("src/app/admin/transactions/page.tsx"));
  await assert.rejects(read("src/app/admin/payments/page.tsx"));
  await assert.rejects(read("src/app/api/admin/create-account/route.ts"));
});

test("deleting or locking an account ends its session immediately", async () => {
  const auth = await read("src/lib/api-auth.ts");
  const users = await read("src/app/api/admin/users/route.ts");
  const migration = await read(
    "supabase/migrations/20260804140000_profiles_disabled_flag.sql",
  );

  // Access tokens are validated locally, so authorization must hang off the
  // per-request profiles read rather than trusting the token's app_metadata.
  assert.match(auth, /select\("role, must_reset_password, phone, disabled"\)/);
  assert.match(auth, /if \(!profile\) return null/);
  assert.match(auth, /profile\.disabled === true\) return null/);
  // A deleted account keeps a signed token carrying its old role; the role must
  // not be recoverable from app_metadata alone.
  assert.doesNotMatch(auth, /profile\?\.role \?\? metadataRole/);

  // Locking must write the flag the request path checks, not only the auth ban.
  assert.match(users, /ban_duration: disabled \? "876000h" : "none"/);
  assert.match(users, /\.update\(\{ disabled \}\)/);
  assert.match(migration, /add column if not exists disabled/);
});

test("admin profile is backed by the authenticated account", async () => {
  const route = await read("src/app/api/admin/profile/route.ts");
  const page = await read("src/app/admin/profile/page.tsx");
  const sidebar = await read("src/components/layout/Sidebar.tsx");

  assert.match(route, /actor\?\.role !== "admin"/);
  assert.match(route, /hasValidMutationOrigin/);
  assert.match(route, /\.from\("profiles"\)/);
  assert.match(route, /updateUserById/);
  assert.match(route, /resetPasswordForEmail/);
  assert.match(page, /\/api\/admin\/profile/);
  assert.match(page, /resetAccountContextCache/);
  assert.match(sidebar, /\/admin\/profile/);
});

test("teacher materials are tenant-scoped and never replaced delete-first", async () => {
  const storage = await read("src/lib/storage.ts");
  const page = await read("src/app/teacher/materials/page.tsx");

  assert.match(storage, /if \(teacherId\) query = query\.eq\("teacher_id", teacherId\)/);
  assert.match(storage, /\.upsert\(rows, \{ onConflict: "id" \}\)/);
  assert.match(storage, /saveTeacherMaterials\(delete stale\)/);
  assert.doesNotMatch(storage, /delete\(\)\.eq\("teacher_id", teacherId\)[\s\S]{0,200}if \(list\.length === 0\)/);
  assert.match(page, /getTeacherMaterials<Course>\(teacherId\)/);
  assert.doesNotMatch(page, /simulate API|saveTeacherMaterials\(courses, teacherId\)\.catch/);
});

test("teacher portal data is class-scoped and notification state is durable", async () => {
  const migration = await read(
    "supabase/migrations/20260729190000_teacher_portal_hardening.sql",
  );
  const entityRoute = await read("src/app/api/data/entities/[entity]/route.ts");
  const notificationPage = await read("src/app/teacher/notifications/page.tsx");

  assert.match(migration, /public\.teaches_student\(id\)/);
  assert.match(migration, /sender_user_id = auth\.uid\(\)/);
  assert.match(migration, /public\.enrolled_in_class\(target_class_id\)/);
  assert.match(migration, /create table if not exists public\.notification_reads/);
  assert.match(migration, /public\.teaches_class\(class_id\)/);
  assert.match(migration, /data, submitted_at/);
  assert.doesNotMatch(migration, /hw_submissions \([\s\S]{0,120}created_at/);
  assert.match(migration, /curriculum\.value/);
  assert.match(migration, /set value = value/);
  assert.doesNotMatch(migration, /curriculum\.data|set data = data/);
  assert.match(entityRoute, /item\.sender_user_id = actor\.userId/);
  assert.match(notificationPage, /getNotificationStates/);
  assert.doesNotMatch(notificationPage, /tutorhub_teacher_notif_read|localStorage/);
});

test("teacher profile, schedule and submissions use canonical stores", async () => {
  const profileRoute = await read("src/app/api/teacher/profile/route.ts");
  const storage = await read("src/lib/storage.ts");
  const submissionStore = await read("src/lib/supabase/submissions.ts");
  const settingsPage = await read("src/app/teacher/settings/page.tsx");

  assert.match(profileRoute, /actor\?\.role !== "teacher"/);
  assert.match(profileRoute, /hasValidMutationOrigin/);
  assert.match(profileRoute, /\.from\("teachers"\)\.update/);
  assert.match(profileRoute, /updateUserById/);
  assert.match(settingsPage, /\/api\/teacher\/profile/);
  assert.match(storage, /\.from\("classes"\)[\s\S]{0,200}\.update\(\{ schedule \}\)/);
  assert.match(storage, /\.update\(\{ zoom_link: link\.trim\(\) \|\| null \}\)/);
  assert.match(storage, /\.from\("kv_student_packages"\)[\s\S]{0,100}\.select\("id,value"\)/);
  assert.match(submissionStore, /\.from\("hw_submissions"\)/);
  assert.doesNotMatch(submissionStore, /\.from\("submissions"\)/);
});

test("student portal keeps paid material, submissions and progress server-scoped", async () => {
  const migration = await read(
    "supabase/migrations/20260730100000_student_portal_hardening.sql",
  );
  const materialsRoute = await read("src/app/api/student/materials/route.ts");
  const curriculumRoute = await read(
    "src/app/api/student/curriculum/[classId]/route.ts",
  );
  const progressRoute = await read("src/app/api/student/progress/route.ts");
  const classPage = await read("src/app/student/classes/[classId]/page.tsx");
  const player = await read("src/components/student/PlayerView.tsx");

  assert.match(migration, /drop policy if exists class_materials_student_download/);
  assert.match(migration, /teacher_id = public\.my_teacher_id\(\)/);
  assert.doesNotMatch(migration, /teacher_materials_read[\s\S]{0,160}published/);
  assert.match(migration, /\(storage\.foldername\(name\)\)\[3\] = public\.my_student_id\(\)/);
  assert.match(migration, /create table if not exists public\.student_lesson_progress/);
  assert.match(materialsRoute, /access_granted: canAccessFull/);
  assert.match(materialsRoute, /videoUrl: _videoUrl/);
  assert.match(curriculumRoute, /\.contains\("student_ids", \[actor\.studentId\]\)/);
  assert.match(curriculumRoute, /questions: _questions/);
  assert.match(progressRoute, /actor\?\.role !== "student"/);
  assert.match(classPage, /getStudentCurriculum/);
  assert.match(classPage, /getStudentLessonProgress/);
  assert.doesNotMatch(classPage, /tutorhub_watched|getCurriculum\(/);
  assert.match(player, /saveStudentLessonProgress/);
  assert.match(player, /youtube-nocookie\.com/);
  assert.doesNotMatch(player, /Chức năng thảo luận đang được phát triển/);
});

test("student receipts and notification state are durable", async () => {
  const receipts = await read("src/app/api/payments/receipts/route.ts");
  const transactions = await read("src/app/api/payments/transactions/route.ts");
  const invoices = await read("src/app/api/payments/invoices/route.ts");
  const paymentsPage = await read("src/app/student/payments/page.tsx");
  const notificationsPage = await read("src/app/student/notifications/page.tsx");
  const homeworkPage = await read("src/app/student/homework/page.tsx");

  assert.match(receipts, /\.from\("payment-receipts"\)\s*\.upload/);
  assert.match(transactions, /receipt_path: body\.receipt_path/);
  assert.match(transactions, /target_role: "teacher"/);
  assert.match(invoices, /submit_invoice_receipt_secure/);
  assert.match(paymentsPage, /\/api\/payments\/receipts/);
  assert.match(paymentsPage, /submitInvoiceReceipt/);
  assert.doesNotMatch(paymentsPage, /addNotification|target_role:\s*"admin"/);
  assert.match(notificationsPage, /getNotificationStates/);
  assert.match(notificationsPage, /markNotificationState/);
  assert.doesNotMatch(notificationsPage, /localStorage|tutorhub_notif_read/);
  assert.doesNotMatch(homeworkPage, /saveLocalSub|local-\$\{Date\.now/);
  assert.match(homeworkPage, /if \(!uploaded\?\.url\)/);
});

test("exam HTML is sanitized before student delivery", async () => {
  const server = await read("src/lib/exam-server.ts");
  const examRoute = await read("src/app/api/exam/[classId]/[lessonId]/route.ts");
  const submitRoute = await read(
    "src/app/api/exam/[classId]/[lessonId]/submit/route.ts",
  );

  assert.match(server, /import sanitizeHtml from "sanitize-html"/);
  assert.match(server, /content_html: cleanExamHtml/);
  assert.match(server, /options: safe\.options\?\.map/);
  assert.match(examRoute, /sanitizeQuestions\(questions, showSolution\)/);
  assert.match(submitRoute, /sanitizeQuestions\(questions, showSolution\)/);
});

test("student class and material screens avoid known sequential request waterfalls", async () => {
  const classesPage = await read("src/app/student/classes/page.tsx");
  const scoresPage = await read("src/app/student/scores/page.tsx");
  const browseView = await read("src/components/student/BrowseView.tsx");

  assert.doesNotMatch(classesPage, /getOnlineLink|for \(const cls of myClasses\)/);
  assert.match(classesPage, /const liveLink = cls\.zoom_link/);
  assert.match(scoresPage, /Promise\.all\(myClasses\.map/);
  assert.match(browseView, /getStudentPackagesForClasses/);
  assert.match(browseView, /Promise\.all\(pkgIds\.map/);
});
