-- Make "khóa tài khoản" take effect immediately.
--
-- getRequestIdentity() verifies the access token locally (getClaims) instead of
-- asking the auth server on every request, so banning a user in auth.users was
-- invisible to the app until their token expired — up to an hour of continued
-- access after an admin locked the account.
--
-- The identity lookup already reads public.profiles on every request, so a flag
-- there costs nothing extra and is checked synchronously with authorization.

alter table public.profiles
  add column if not exists disabled boolean not null default false;

-- Reflect any account already banned in auth.users.
update public.profiles p
set disabled = true
from auth.users u
where u.id = p.id
  and u.banned_until is not null
  and u.banned_until > now()
  and not p.disabled;

-- The column is authorization state: readable by its owner (and admins, via the
-- existing profiles_self_select policy) but never writable by them. Only the
-- service-role admin API toggles it, so no new grant is needed — profiles only
-- grants UPDATE on (full_name, phone) to authenticated.
comment on column public.profiles.disabled is
  'Account locked by an admin. Checked on every request; service-role writes only.';
