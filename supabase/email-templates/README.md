# Auth email templates

These files are **not applied automatically**. Paste each one into
Supabase Dashboard → Authentication → Emails → Templates and press Save.
Leaving a template on the Supabase default silently breaks the link inside the
email, which looks to the user like "liên kết đã hết hạn".

| File | Dashboard template |
| --- | --- |
| `confirmation.html` | Confirm signup |
| `recovery.html` | Reset password |

## Why `{{ .TokenHash }}` and not `{{ .ConfirmationURL }}`

The default `{{ .ConfirmationURL }}` routes through GoTrue's `/auth/v1/verify`
endpoint, which hands back a **PKCE** code (`?code=pkce_…`). That code can only
be exchanged by the browser holding the matching code-verifier cookie, so:

- **Reset password** breaks whenever the mail is opened somewhere other than the
  browser that requested it — request it on a phone, open it on a laptop, fail.
- **Confirm signup** breaks *everywhere*: signup runs server-side in
  `/api/auth/signup`, so no code verifier is ever stored in the student's
  browser and there is nothing to exchange the code with.

A token hash is verified server-side by `src/app/auth/callback/route.ts`
(`verifyOtp`), so the link works on any device.

## Why `{{ .RedirectTo }}` and not `{{ .SiteURL }}`

`{{ .RedirectTo }}` expands to the `redirectTo` / `emailRedirectTo` the app
passed, which already carries the right origin (localhost in development,
`https://www.toananhhuy.com` in production) plus the `?next=` destination.
Hard-coding `{{ .SiteURL }}` would send every development link to production.

Both flows always pass a redirect, so appending `&token_hash=…` to it is safe.
The origins must be allow-listed under Authentication → URL Configuration.
