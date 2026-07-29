# TutorHub production deployment runbook

Production deployment is paused while `.production-deploy-paused` exists.
Never bypass this file in a hosting command.

## Current blockers

- The database backup taken on 2026-07-27 reported **0 Auth users**.
- The security migration intentionally denies all anonymous table access.
- A real admin must therefore be bootstrapped and verified before migration.
- Obtain a physical `pg_dump` with the database password before the production
  change window.

## Preparation

1. Freeze application writes and announce the maintenance window.
2. Run `npm run db:backup`; verify the printed SHA-256.
3. Create an encrypted physical backup with `pg_dump` and test restoring it to
   an isolated database.
4. Set production secrets:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, and a random
   `RATE_LIMIT_HASH_SECRET` of at least 32 bytes.
5. Set one-time `BOOTSTRAP_ADMIN_EMAIL` and
   `BOOTSTRAP_ADMIN_PASSWORD`, run `npm run admin:bootstrap`, then immediately
   remove both bootstrap values from the environment.
6. Sign in as that admin in staging and verify `/api/account/me` reports
   `role=admin`.

## Database rollout

1. Restore the latest production backup into staging.
2. Apply
   `supabase/migrations/20260727140000_production_security.sql`, followed by
   all newer timestamped migrations in order.
3. Confirm every application table has RLS enabled and no policy named
   `phase1_open_all` remains.
4. Confirm all three storage buckets are private.
5. Confirm the retired `enrollment_requests` and `enrollments` tables are absent
   and JSON records in `kv_managed_users` contain no `password` property.
6. Run `npm run test:integration` against staging.
7. Exercise admin invitation, teacher-managed class registration approval,
   exam submit/retry, and payment create/review using one test account per role.

## Application verification

Run, in this order:

```text
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:integration
```

Verify `/api/health` returns HTTP 200. Configure the platform to alert on
5xx rate, p95 latency, failed health checks, authentication failures, and the
structured `*.failed`/`*.unavailable` log events. Logs must be retained without
cookies, authorization headers, tokens, or passwords.

## Go-live approval

Two people review the migration and test evidence. Record:

- backup path, checksum, and restore-test result;
- admin user ID and successful role verification;
- CI commit SHA and green workflow URL;
- staging integration evidence;
- rollback owner and change-window end time.

Only then remove `.production-deploy-paused`, set
`PRODUCTION_DEPLOY_APPROVED=true` in the one deployment job, and run
`npm run deploy:check` before deployment. Do not persist that approval variable
after the release.

## Rollback

1. Stop traffic to the new version; do not run mixed old/new application
   versions against the hardened schema.
2. Redeploy the previous application artifact.
3. If data mutations occurred after migration, export them before restore.
4. Restore the tested physical backup to a new database/project and switch
   secrets atomically. Do not weaken RLS in-place as an emergency shortcut.
5. Rotate the service-role key and any bootstrap/reset credentials involved in
   the incident.
6. Keep production paused until the root cause and data reconciliation are
   complete.
