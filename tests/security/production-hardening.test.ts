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
import { isDiscoverableClass } from "../../src/lib/class-catalog";
import { resolvePortalBranding } from "../../src/lib/portal-branding";
import { curriculumReferencesStudentFile } from "../../src/lib/curriculum-file-access";

const read = (path: string) => readFile(path, "utf8");

test("teacher portal branding accepts only uploaded portal logos", () => {
  assert.deepEqual(
    resolvePortalBranding({
      portal_name: "  Lớp Toán Minh Anh  ",
      portal_logo_url: "/api/files?bucket=avatars&path=user-1%2Fportal-logo%2Flogo.webp",
    }, "teacher-1"),
    {
      name: "Lớp Toán Minh Anh",
      logoUrl: "/api/files?bucket=avatars&path=user-1%2Fportal-logo%2Flogo.webp",
      teacherId: "teacher-1",
    },
  );
  assert.deepEqual(
    resolvePortalBranding({
      portal_name: " ",
      portal_logo_url: "https://example.com/tracking-logo.png",
      bank_name: "Private bank data must not be returned",
    }),
    { name: "TutorHub", logoUrl: "" },
  );
});

test("profile avatars flow through the shared layout for every portal", async () => {
  const identity = await read("src/lib/api-auth.ts");
  const contextRoute = await read("src/app/api/account/context/route.ts");
  const accountContext = await read("src/hooks/useAccountContext.ts");
  const layout = await read("src/components/layout/PortalLayout.tsx");
  const sidebar = await read("src/components/layout/Sidebar.tsx");
  const topNav = await read("src/components/layout/TopNav.tsx");
  const studentProfile = await read("src/app/student/profile/page.tsx");

  assert.match(identity, /select\("id, full_name, dob, school, grade, avatar_url"\)/);
  assert.match(identity, /select\("id, full_name, avatar_url"\)/);
  assert.match(identity, /avatarUrl: roleEntity\?\.avatarUrl \|\| metadataAvatarUrl/);
  assert.match(contextRoute, /avatarUrl: identity\.avatarUrl/g);
  assert.match(accountContext, /avatarUrl: string/g);
  assert.match(layout, /avatarUrl=\{resolvedAvatarUrl\}/g);
  assert.match(sidebar, /<UserAvatar size="sm" name=\{userName\} src=\{avatarUrl\}/);
  assert.match(topNav, /<UserAvatar size="sm" name=\{userName\} src=\{avatarUrl\}/);
  assert.match(studentProfile, /setAccount[\s\S]{0,160}resetAccountContextCache\(\)/);
});

test("desktop sidebar visibility is user-controlled and persistent", async () => {
  const layout = await read("src/components/layout/PortalLayout.tsx");
  const sidebar = await read("src/components/layout/Sidebar.tsx");
  const topNav = await read("src/components/layout/TopNav.tsx");

  assert.match(layout, /tutorhub_sidebar_hidden/);
  assert.match(layout, /localStorage\.setItem\(SIDEBAR_HIDDEN_KEY/);
  assert.match(layout, /desktopHidden=\{sidebarHidden\}/);
  assert.match(sidebar, /aria-label="Ẩn thanh bên"/);
  assert.match(sidebar, /lg:w-0 lg:-translate-x-full lg:border-r-0/);
  assert.match(topNav, /aria-label="Hiện thanh bên"/);
  assert.match(topNav, /sidebarHidden &&/);
});

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

test("monthly billing quotes the flat monthly price, not the per-session one", () => {
  const config = {
    billing_mode: "month",
    // Cả hai bảng cùng tồn tại: đổi cách tính không được làm mất giá của cách kia.
    unit_prices: { "2026-07": { online: 90_000, advanced: 110_000, offline: 150_000 } },
    monthly_prices: { "2026-07": { online: 700_000, advanced: 900_000, offline: 1_200_000 } },
  };
  assert.deepEqual(resolveRegistrationTuition(config, "2026-07"), {
    period: "2026-07",
    billing_unit: "month",
    online: 700_000,
    advanced: 900_000,
    offline: 1_200_000,
  });

  // Kế thừa tiến vẫn áp dụng cho bảng giá tháng.
  assert.equal(
    resolveRegistrationTuition(config, "2026-09").online,
    700_000,
  );

  // unit_price cũ là đơn giá MỘT BUỔI — không được dùng làm giá trọn gói tháng.
  assert.equal(
    resolveRegistrationTuition({ billing_mode: "month", unit_price: 90_000 }, "2026-07").online,
    0,
  );

  // Thiếu billing_mode thì giữ nguyên cách tính theo buổi như các lớp đã cấu hình trước đây.
  assert.equal(
    resolveRegistrationTuition({ unit_prices: config.unit_prices }, "2026-07").billing_unit,
    "session",
  );
});

test("issuing tuition notifies the class without leaking one student's amount", async () => {
  const route = await read("src/app/api/payments/invoices/route.ts");

  // Phát hành mà không báo gì thì học viên không có cách nào biết là có hoá đơn mới.
  assert.match(route, /invoice\.issue_notification_failed/);
  assert.match(route, /target_role: "student"/);
  // Thông báo gắn theo lớp -> tuyệt đối không kèm số tiền của một học viên.
  assert.doesNotMatch(route, /content:[^\n]*invoice\.amount/);
  // Phát hành hàng loạt gọi endpoint một lần mỗi học viên; chỉ được báo một lần.
  assert.match(route, /if \(!existing\?\.length\)/);
});

test("class discovery hides enrolled and active registration classes", () => {
  assert.equal(isDiscoverableClass({ enrolled: true, registration_status: null }), false);
  assert.equal(isDiscoverableClass({ enrolled: false, registration_status: "pending" }), false);
  assert.equal(isDiscoverableClass({ enrolled: false, registration_status: "approved" }), false);
  assert.equal(isDiscoverableClass({ enrolled: false, registration_status: "rejected" }), true);
  assert.equal(isDiscoverableClass({ enrolled: false, registration_status: "cancelled" }), true);
  assert.equal(isDiscoverableClass({ enrolled: false, registration_status: null }), true);
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
  const examPlayer = await read("src/components/student/StudentExamPlayer.tsx");
  assert.doesNotMatch(examPlayer, /saveExamResult|kvDelete|calcAutoScore/);
  assert.match(examPlayer, /\/retry/);
  assert.match(examPlayer, /\/submit/);
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

  const reviewPanel = await read("src/components/teacher/StudentsTab.tsx");
  const classDetail = await read(
    "src/app/teacher/classes/[classId]/page.tsx",
  );
  assert.match(reviewPanel, /resetAccountContextCache\(\)/);
  assert.match(reviewPanel, /await onRegistrationApproved/);
  assert.match(classDetail, /setStudents\(await getStudents\(\)\)/);

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

test("class questions are class-scoped community discussions", async () => {
  const collectionRoute = await read("src/app/api/questions/route.ts");
  const messageRoute = await read(
    "src/app/api/questions/[id]/messages/route.ts",
  );
  const statusRoute = await read("src/app/api/questions/[id]/route.ts");
  const server = await read("src/lib/class-question-server.ts");
  const workspace = await read("src/components/questions/QuestionsWorkspace.tsx");
  const sidebar = await read("src/components/layout/Sidebar.tsx");
  const migration = await read(
    "supabase/migrations/20260805120000_class_questions.sql",
  );

  assert.match(collectionRoute, /actor\.role !== "student" && actor\.role !== "teacher"/);
  assert.match(collectionRoute, /\.contains\("student_ids", \[actor\.studentId\]\)/);
  assert.match(collectionRoute, /getTeacherClassIds/);
  assert.match(collectionRoute, /hasValidMutationOrigin/);
  assert.match(collectionRoute, /consumeRateLimit/);
  assert.match(messageRoute, /getQuestionForActor/);
  assert.match(messageRoute, /question\.status === "closed"/);
  assert.match(statusRoute, /getQuestionForActor/);
  assert.match(statusRoute, /only_author_can_update/);
  assert.match(collectionRoute, /query\.in\("class_id", classIds\)/);
  assert.match(server, /ownsQuestion/);
  assert.match(server, /viewerUserId/);
  assert.match(workspace, /Cộng đồng học tập/);
  assert.match(workspace, /message\.is_own/);
  assert.match(workspace, /Đăng lên cộng đồng/);
  assert.match(server, /homework-submissions/);
  assert.match(server, /submissions\/\$\{studentId\}\/questions/);
  assert.match(sidebar, /\/student\/questions/);
  assert.match(sidebar, /\/teacher\/questions/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /revoke all on public\.class_questions from public, anon, authenticated/);
  assert.doesNotMatch(migration, /grant .*class_questions to authenticated/);
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
  assert.match(identity, /createAdminClient/);
  assert.match(identity, /identityStore\s*\.from\("students"\)/);
  assert.match(identity, /identityStore\s*\.from\("profiles"\)/);
  assert.doesNotMatch(identity, /supabase\s*\.from\("students"\)/);
  assert.doesNotMatch(identity, /supabase\s*\.from\("profiles"\)/);

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
  assert.match(curriculumRoute, /publicExamContent/);
  assert.match(progressRoute, /actor\?\.role !== "student"/);
  assert.match(classPage, /useStudentCurriculum/);
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

test("students can load assigned exam images without exposing hidden solutions", () => {
  const questionImage = "/api/files?bucket=class-materials&path=class-1%2Fmaterials%2Fquestion.png";
  const optionImage = "/api/files?bucket=class-materials&path=class-1%2Fmaterials%2Foption.png";
  const solutionImage = "/api/files?bucket=class-materials&path=class-1%2Fmaterials%2Fsolution.png";
  const curriculum = [{
    sessions: [{
      lessons: [{
        type: "exam",
        is_published: true,
        exam_status: "open",
        assigned_to: ["student-1"],
        exam_content: {
          questions: [{
            content_html: `<p><img src="${questionImage}" /></p>`,
            options: [`<img src="${optionImage.replaceAll("&", "&amp;")}" />`],
            explanation_html: `<img src="${solutionImage}" />`,
          }],
        },
      }],
    }],
  }];

  assert.equal(curriculumReferencesStudentFile(curriculum, questionImage, "student-1"), true);
  assert.equal(curriculumReferencesStudentFile(curriculum, optionImage, "student-1"), true);
  assert.equal(curriculumReferencesStudentFile(curriculum, solutionImage, "student-1"), false);
  assert.equal(curriculumReferencesStudentFile(curriculum, questionImage, "student-2"), false);
  assert.equal(curriculumReferencesStudentFile(curriculum, questionImage.slice(0, -4), "student-1"), false);

  const closedCurriculum = structuredClone(curriculum);
  closedCurriculum[0].sessions[0].lessons[0].exam_status = "closed";
  assert.equal(curriculumReferencesStudentFile(closedCurriculum, questionImage, "student-1"), false);
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

test("cache policy speeds shared and versioned data without caching private state", async () => {
  const catalog = await read("src/app/api/class-catalog/route.ts");
  const files = await read("src/app/api/files/route.ts");
  const accountRoute = await read("src/app/api/account/context/route.ts");
  const accountHook = await read("src/hooks/useAccountContext.ts");

  // The expensive, student-independent catalog body is shared briefly, while
  // enrollment and registration are still queried and returned as no-store.
  assert.match(catalog, /unstable_cache/);
  assert.match(catalog, /class-catalog-public-v1/);
  assert.match(catalog, /revalidate: 60/);
  assert.match(catalog, /\.contains\("student_ids", \[actor\.studentId\]\)/);
  assert.match(catalog, /"Cache-Control": "private, no-store"/);

  // Avatar and portal-logo paths contain upload timestamps, so their signed
  // redirects can be reused. Entitlement-sensitive files must remain no-store.
  assert.match(files, /bucket === "avatars"/);
  assert.match(files, /PROFILE_ASSET_BROWSER_TTL_SECONDS/);
  assert.match(files, /private, max-age=\$\{PROFILE_ASSET_BROWSER_TTL_SECONDS\}, immutable/);
  assert.match(files, /: "private, no-store"/);

  // Account context stays in memory for smooth navigation, but never enters a
  // browser/shared HTTP cache and refreshes after its short TTL.
  assert.match(accountHook, /CACHE_TTL_MS = 60_000/);
  assert.match(accountHook, /fetch\("\/api\/account\/context", \{ cache: "no-store" \}\)/);
  assert.match(accountHook, /ready: current\.context !== null/);
  assert.match(accountRoute, /"Cache-Control": "private, no-store"/);
});

test("student curriculum cache deduplicates requests without hiding load failures", async () => {
  const hook = await read("src/hooks/useStudentCurriculum.ts");
  const storage = await read("src/lib/storage.ts");
  const route = await read("src/app/api/student/curriculum/[classId]/route.ts");
  const studentClass = await read("src/app/student/classes/[classId]/page.tsx");
  const curriculum = await read("src/components/student/CurriculumView.tsx");
  const player = await read("src/components/student/ClassLearningPlayer.tsx");

  // Cache phải tách theo học sinh/lớp, gộp request đang chạy và chỉ làm mới
  // nền sau TTL hoặc khi người dùng quay lại cửa sổ.
  assert.match(hook, /STUDENT_CURRICULUM_CACHE_TTL_MS = 2 \* 60_000/);
  assert.match(hook, /`\$\{studentId\}:\$\{classId\}`/);
  assert.match(hook, /if \(entry\.promise\) return entry\.promise/);
  assert.match(hook, /window\.addEventListener\("focus", revalidateIfStale\)/);
  assert.match(studentClass, /useStudentCurriculum\(\{/);
  assert.match(player, /useStudentCurriculum\(\{/);
  assert.doesNotMatch(studentClass, /getStudentCurriculum\(classId\)/);

  // Lỗi mạng/quyền không được phép biến thành [] rồi hiện nhầm thông báo
  // "giáo viên chưa thiết lập"; dữ liệu cá nhân hóa vẫn không cache ở HTTP.
  assert.match(storage, /export async function getStudentCurriculum[\s\S]{0,700}if \(!response\.ok\)[\s\S]{0,320}throw error/);
  assert.match(curriculum, /Không thể tải lộ trình học/);
  assert.match(curriculum, /Bạn đang xem dữ liệu đã lưu gần nhất/);
  assert.match(curriculum, /aria-label="Làm mới lộ trình"/);
  assert.match(route, /if \(enrollmentError\)/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
});

test("homework navigation and data loading always provide immediate feedback", async () => {
  const sidebar = await read("src/components/layout/Sidebar.tsx");
  const loadingState = await read("src/components/shared/HomeworkLoadingState.tsx");
  const studentHomework = await read("src/app/student/homework/page.tsx");
  const teacherHomework = await read("src/app/teacher/homework/page.tsx");
  const studentClass = await read("src/app/student/classes/[classId]/page.tsx");
  const studentClassHomework = await read("src/components/student/StudentHomeworkTab.tsx");
  const teacherClass = await read("src/app/teacher/classes/[classId]/page.tsx");
  const teacherClassHomework = await read("src/components/teacher/HomeworkTab.tsx");

  assert.match(sidebar, /useLinkStatus/);
  assert.match(sidebar, /Đang mở/);
  assert.match(sidebar, /item\.href\.endsWith\("\/homework"\) \? null : false/);
  assert.match(loadingState, /Đang tải bài tập/);
  assert.match(loadingState, /role="status"/);

  assert.match(studentHomework, /loadingHomework/);
  assert.match(studentHomework, /<HomeworkLoadingState \/>/);
  assert.match(studentHomework, /Promise\.all\(\[/);
  assert.match(studentHomework, /examItems/);

  assert.match(teacherHomework, /loadingHomework/);
  assert.match(teacherHomework, /<HomeworkLoadingState \/>/);
  // Ba nguồn độc lập phải tải song song; bài nộp tải sau vì cần id bài tập.
  assert.match(teacherHomework, /const \[manual, curriculumPerClass, students\] = await Promise\.all/);
  // Chấm ngay trong hàng đợi, không điều hướng sang trang khác.
  assert.match(teacherHomework, /<SubmissionGrader/);

  assert.match(studentClass, /<StudentHomeworkTab/);
  assert.match(studentClass, /assignmentsLoading=\{!manualHomeworkLoaded && !curriculumHomeworkLoaded\}/);
  assert.match(studentClass, /submissionsLoading=\{!homeworkSubmissionsLoaded\}/);
  assert.match(studentClassHomework, /Cần làm lại/);
  assert.match(studentClassHomework, /Chờ chấm/);
  assert.match(studentClassHomework, /Ưu tiên tiếp theo/);
  assert.match(studentClassHomework, /homeworkId=\$\{encodeURIComponent\(homework\.id\)\}/);
  assert.match(studentHomework, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(studentHomework, /setModalType\(shouldSubmit \? "submit" : "detail"\)/);
  assert.match(teacherClass, /HomeworkPanelFallback/);
  assert.match(teacherClass, /persistedHomeworkLoaded/);
  assert.match(teacherClass, /assignmentsRefreshing=\{!curriculumHomeworkLoaded \|\| !persistedHomeworkLoaded\}/);
  assert.match(teacherClass, /onSubmissionGraded=/);
  assert.match(teacherClassHomework, /Trung tâm chấm bài/);
  assert.match(teacherClassHomework, /Cần chấm/);
  assert.match(teacherClassHomework, /Chờ học sinh/);
  assert.match(teacherClassHomework, /Ưu tiên chấm tiếp theo/);
  assert.match(teacherClassHomework, /<SubmissionGrader/);
  assert.match(teacherClassHomework, /học sinh chưa nộp/);
});

test("teacher class curriculum uses a compact full-width workspace", async () => {
  const classPage = await read("src/app/teacher/classes/[classId]/page.tsx");
  const curriculum = await read("src/components/teacher/CurriculumTab.tsx");

  assert.match(classPage, /max-w-\[1440px\] space-y-4/);
  assert.match(classPage, /px-3 py-3 text-xs font-semibold/);
  assert.match(curriculum, /w-full space-y-3/);
  assert.match(curriculum, /Cấu trúc lộ trình/);
  assert.doesNotMatch(curriculum, /max-w-3xl/);

  // Trạng thái gấp/mở phải được nhớ theo lớp: bung sẵn mọi buổi mỗi lần vào lại
  // là lý do người dùng phải cuộn rất nhiều.
  assert.match(curriculum, /tutorhub_curriculum_open_/);
  assert.match(curriculum, /writeExpanded\(classId, next\)/);
  // Lọc phải tự bung nhánh còn kết quả, nếu không tìm xong vẫn không thấy gì.
  assert.match(curriculum, /const isOpen = \(id: string\) => filtering \|\| expanded\.has\(id\)/);
  assert.match(curriculum, /function setSessionPublished/);

  // Kéo–thả sắp xếp ở cả ba cấp; tay kéo phải thật sự kéo được.
  const sortable = await read("src/components/teacher/useSortable.ts");
  assert.match(curriculum, /startDrag\("chapters", ci\)/);
  assert.match(curriculum, /startDrag\(`sessions:\$\{chapter\.id\}`, si\)/);
  assert.match(curriculum, /startDrag\(`lessons:\$\{chapter\.id\}:\$\{session\.id\}`, li\)/);
  // Lọc làm chỉ số hiển thị lệch mảng thật, nên phải khoá sắp xếp khi đang lọc.
  assert.match(curriculum, /const canSort = !filtering/);
  // Pointer Events chứ không phải HTML5 drag: HTML5 không chạy trên cảm ứng.
  assert.match(sortable, /pointermove/);
  assert.doesNotMatch(sortable, /dragstart/);
  // touch-none: thiếu nó thì trình duyệt di động hiểu thao tác kéo là cuộn trang.
  assert.match(curriculum, /touch-none/);
});

test("class overviews prioritize the next action for teachers and students", async () => {
  const teacherClass = await read("src/app/teacher/classes/[classId]/page.tsx");
  const teacherOverview = await read("src/components/teacher/OverviewTab.tsx");
  const studentClass = await read("src/app/student/classes/[classId]/page.tsx");
  const studentOverview = await read("src/components/student/StudentOverviewTab.tsx");

  assert.match(teacherClass, /nextSessionContent=/);
  assert.match(teacherOverview, /Buổi học tiếp theo/);
  assert.match(teacherOverview, /Việc cần xử lý/);
  assert.match(teacherOverview, /Sức khỏe lớp/);
  assert.match(teacherOverview, /pendingGrading/);

  assert.match(studentClass, /<StudentOverviewTab/);
  assert.match(studentClass, /overviewTasks/);
  assert.match(studentOverview, /Học tiếp theo/);
  assert.match(studentOverview, /Sắp đến hạn/);
  assert.match(studentOverview, /Tiến độ bài giảng/);
  assert.doesNotMatch(studentClass, /Mô tả khóa học/);
});

test("student curriculum launches a focused full-screen learning player", async () => {
  const studentClass = await read("src/app/student/classes/[classId]/page.tsx");
  const curriculum = await read("src/components/student/CurriculumView.tsx");
  const learningRoute = await read(
    "src/app/student/classes/[classId]/learn/[lessonId]/page.tsx",
  );
  const loadingRoute = await read(
    "src/app/student/classes/[classId]/learn/[lessonId]/loading.tsx",
  );
  const player = await read("src/components/student/ClassLearningPlayer.tsx");

  assert.match(curriculum, /\/student\/classes\/\$\{classId\}\/learn\/start/);
  assert.match(curriculum, /Bắt đầu học/);
  assert.match(curriculum, /Tiếp tục học/);
  assert.doesNotMatch(curriculum, /lg:h-\[600px\]/);
  assert.doesNotMatch(studentClass, /onWatch=\{/);
  assert.match(studentClass, /\/student\/classes\/\$\{classId\}\/learn\/\$\{lessonId\}/);

  assert.match(learningRoute, /<ClassLearningPlayer/);
  assert.match(loadingRoute, /h-dvh/);
  assert.match(player, /h-dvh/);
  assert.match(player, /Nội dung khóa học/);
  assert.match(player, /Ghi chú bài học/);
  assert.match(player, /saveStudentLessonProgress/);
  assert.match(player, /<StudentExamPlayer/);
  assert.doesNotMatch(player, /router\.push\(`\/student\/classes\/\$\{classId\}\/exam/);
  assert.match(player, /lessonTypeById\.get\(item\.lesson_id\) !== "homework"/);
  assert.match(player, /submission\.status !== "returned"/);
  assert.doesNotMatch(player, /onTimeUpdate/);
});

test("guardian links are many-to-many, consent-based, and RLS scoped", async () => {
  const migration = await read(
    "supabase/migrations/20260809120000_student_guardians.sql",
  );
  const canonical = await read("supabase/schema_canonical.sql");

  for (const sql of [migration, canonical]) {
    assert.match(sql, /create table if not exists public\.student_guardians/);
    assert.match(sql, /unique \(student_id, parent_id\)/);
    assert.match(sql, /status in \('pending', 'active', 'rejected', 'revoked'\)/);
    assert.match(sql, /insert into public\.student_guardians/);
    assert.match(sql, /create policy student_guardians_scoped_select/);
    assert.match(sql, /public\.parent_id_has_student/);
    assert.match(sql, /sg\.status = 'active'/);
  }
});

test("teacher and admin guardian invitations require parent acceptance", async () => {
  const collectionRoute = await read("src/app/api/guardians/route.ts");
  const itemRoute = await read("src/app/api/guardians/[id]/route.ts");
  const manager = await read(
    "src/components/guardians/StudentGuardianManager.tsx",
  );
  const parentInvitations = await read("src/app/parent/invitations/page.tsx");
  const teacherStudents = await read("src/app/teacher/students/page.tsx");
  const adminStudents = await read("src/app/admin/students/page.tsx");

  assert.match(collectionRoute, /teacherCanManageStudent/);
  assert.match(collectionRoute, /inviteUserByEmail/);
  assert.match(collectionRoute, /shouldCreateUser: false/);
  assert.match(collectionRoute, /status: "pending"/);
  assert.match(collectionRoute, /consumeRateLimit/);
  assert.match(itemRoute, /actor\?\.role !== "parent"/);
  assert.match(itemRoute, /body\.action === "accept"/);
  assert.match(itemRoute, /status: accepted \? "active" : "rejected"/);
  assert.match(itemRoute, /replacement\?\.parent_id \?\? null/);
  assert.match(manager, /\/api\/guardians/);
  assert.match(parentInvitations, /resetAccountContextCache\(\)/);
  assert.match(teacherStudents, /StudentGuardianPanel/);
  assert.match(teacherStudents, /key: "guardians"/);
  assert.match(teacherStudents, /label: "Phụ huynh"/);
  assert.match(adminStudents, /StudentGuardianManager/);
});

test("all parent-sensitive API reads use accepted guardian relationships", async () => {
  const helper = await read("src/lib/guardian-server.ts");
  const account = await read("src/app/api/account/context/route.ts");
  const criticalRoutes = await Promise.all([
    read("src/app/api/files/route.ts"),
    read("src/app/api/exam-scores/route.ts"),
    read("src/app/api/payments/invoices/route.ts"),
    read("src/app/api/payments/transactions/route.ts"),
    read("src/app/api/payments/receipts/route.ts"),
  ]);

  assert.match(helper, /\.eq\("status", "active"\)/);
  assert.match(account, /getActiveChildIdsForParent/);
  for (const route of criticalRoutes) {
    assert.match(route, /getActiveChildIdsForParent|parentCanAccessStudent/);
    assert.doesNotMatch(route, /\.eq\("parent_id", actor\.parentId/);
  }
});
