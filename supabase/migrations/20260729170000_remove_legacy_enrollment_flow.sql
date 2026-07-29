-- Remove the retired public enrollment/application workflow.
-- Existing Auth users and student profiles are preserved; only legacy
-- application records and their server-side approval helpers are removed.

drop function if exists public.approve_enrollment_request_secure(
  text,
  text,
  uuid,
  uuid
);

drop function if exists public.delete_enrollment_request_secure(text, uuid);

drop table if exists public.enrollment_requests;
drop table if exists public.enrollments;

delete from public.api_rate_limits where scope = 'public_enrollment';
