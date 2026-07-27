/**
 * Create or promote the first production administrator.
 *
 * Required environment variables:
 *   BOOTSTRAP_ADMIN_EMAIL
 *   BOOTSTRAP_ADMIN_PASSWORD
 *
 * The role is stored in app_metadata and profiles, never user_metadata.
 */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (!url || !serviceRoleKey || !email || !password) {
  throw new Error(
    "Missing Supabase credentials or BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD",
  );
}
if (
  password.length < 12 ||
  !/[a-z]/.test(password) ||
  !/[A-Z]/.test(password) ||
  !/[0-9]/.test(password) ||
  !/[^A-Za-z0-9]/.test(password)
) {
  throw new Error(
    "Bootstrap admin password must have 12+ characters, upper/lowercase, a number, and a symbol",
  );
}
const bootstrapEmail: string = email;
const bootstrapPassword: string = password;

const admin = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

async function findUserByEmail(targetEmail: string) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1_000,
    });
    if (error) throw error;
    const found = data.users.find(
      (user) => user.email?.toLowerCase() === targetEmail,
    );
    if (found) return found;
    if (data.users.length < 1_000) return null;
  }
}

async function main() {
  let user = await findUserByEmail(bootstrapEmail);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: bootstrapEmail,
      password: bootstrapPassword,
      email_confirm: true,
      app_metadata: { role: "admin" },
      user_metadata: {},
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password: bootstrapPassword,
      app_metadata: { ...user.app_metadata, role: "admin" },
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
  }

  let { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    email: bootstrapEmail,
    role: "admin",
    must_reset_password: false,
  });
  if (profileError?.message.includes("must_reset_password")) {
    const legacyResult = await admin.from("profiles").upsert({
      id: user.id,
      email: bootstrapEmail,
      role: "admin",
    });
    profileError = legacyResult.error;
  }
  if (profileError) throw profileError;

  console.log(`Admin bootstrap complete for ${bootstrapEmail}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Admin bootstrap failed: ${message}`);
  process.exitCode = 1;
});
