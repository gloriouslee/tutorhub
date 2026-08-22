# Supabase audit — 2026-08-22

Project: TutorHub (`umuuovaodseqrsletlmd`, PostgreSQL 17)

## Result

- Reduced the public schema from 55 to 44 base tables.
- Kept RLS enabled on all 44 public tables.
- Cleared all Database Advisor warnings for missing FK indexes, per-row auth
  evaluation, duplicate indexes, missing RLS policies, and overlapping
  permissive read policies.
- Preserved production data with a logical backup before the migration and
  guarded every empty-table drop with a row-count assertion.

Applied migration:

- `20260822153806_normalize_schema_and_rls_performance.sql`

## Retired tables

| Removed table | Canonical replacement |
| --- | --- |
| `payments` | `kv_invoices` and `purchase_transactions` |
| `attendance` | `class_attendance` |
| `homework` | `teacher_homework` |
| `submissions` | `hw_submissions` |
| `materials` | `teacher_materials` and `class_materials` |
| `exam_scores` | `app_exam_scores` |
| `kv_schedules` | `classes.schedule` |
| `kv_online_links` | `classes.zoom_link` |
| `kv_exam_scores` | `app_exam_scores` |
| `kv_managed_users` | `profiles` plus role domain tables |
| `kv_student_accounts` | `profiles` plus `students` |

The only row among these tables was an orphaned `kv_schedules` record whose
class no longer existed. Every other retired table was empty at migration time.
The migration intentionally avoids `CASCADE`.

## Performance and RLS changes

- Added FK indexes for question authors, registration assignment/reviewer,
  learning-goal creator, notification reader, transaction class, and guardian
  inviter.
- Removed the exact duplicate `app_exam_scores(student_ref)` index.
- Changed request-identity RLS checks to statement-cached `select auth.uid()` /
  helper expressions.
- Split write policies into INSERT, UPDATE, and DELETE policies where a
  dedicated SELECT policy already exists.
- Added explicit restrictive deny policies to server-only tables.
- Fixed `kv_teacher_settings` scope: the old policy compared
  `classes.tutor_id = classes.id`, which prevented enrolled students and parents
  from reading the correct teacher payment branding.

## Kept intentionally

Empty tables were not treated as unused by default. Feature and API call sites
still exist for reviews, comments, materials, class questions, parent messages,
leaderboard settings, learning goals, and support/growth features, so these
tables remain.

`api_rate_limits` is used through `consume_rate_limit`, not via a direct table
reference, and must remain. `teacher_extra_classes` is still referenced by
class-scope RPC/API compatibility paths and needs a separate data migration
before it can be retired.

## Recommended next phase

1. Normalize `kv_curriculum` into session, lesson, and question rows. It is the
   largest JSONB hotspot and currently rewrites a large class document for small
   edits.
2. Normalize `kv_invoices` into one invoice per row. The secure RPC prevents
   lost updates today, but a single global JSONB row will become a write
   bottleneck as billing volume grows.
3. Move the ten SECURITY DEFINER RLS helper functions from the exposed `public`
   schema to a non-exposed private schema. They are deliberately executable by
   authenticated users for current RLS policies, so this should be staged with
   live role tests rather than changed blindly.
4. Enable Supabase Auth leaked-password protection in the Dashboard.
5. Re-evaluate INFO-level “unused index” notices only after a representative
   production traffic window. Newly created FK indexes and low-volume feature
   indexes correctly show zero scans immediately after creation.

References:

- https://supabase.com/docs/guides/database/database-advisors
- https://supabase.com/docs/guides/database/postgres/indexes
- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
