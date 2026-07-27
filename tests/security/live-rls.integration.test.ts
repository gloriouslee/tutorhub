import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.TEST_SUPABASE_URL;
const anonKey = process.env.TEST_SUPABASE_ANON_KEY;

test("live security target is configured when CI requires it", () => {
  if (process.env.REQUIRE_LIVE_SECURITY_TESTS === "true") {
    assert.ok(url, "TEST_SUPABASE_URL is required");
    assert.ok(anonKey, "TEST_SUPABASE_ANON_KEY is required");
    assert.ok(process.env.TEST_APP_URL, "TEST_APP_URL is required");
  }
});

test(
  "anon cannot read or mutate protected production tables",
  { skip: !url || !anonKey ? "TEST_SUPABASE_* not configured" : false },
  async () => {
    const anon = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    for (const table of [
      "profiles",
      "students",
      "enrollment_requests",
      "purchase_transactions",
      "kv_curriculum",
      "kv_exam_results",
    ]) {
      const { error } = await anon.from(table).select("*").limit(1);
      assert.ok(error, `anon SELECT unexpectedly succeeded on ${table}`);
    }
    const { error: insertError } = await anon.from("enrollment_requests").insert({
      id: crypto.randomUUID(),
      full_name: "RLS probe",
      email: "probe.invalid@example.com",
      status: "pending",
    });
    assert.ok(insertError, "anon INSERT unexpectedly succeeded on enrollment_requests");
  },
);

test(
  "public enrollment API rejects invalid data without exposing database errors",
  { skip: !process.env.TEST_APP_URL ? "TEST_APP_URL not configured" : false },
  async () => {
    const response = await fetch(`${process.env.TEST_APP_URL}/api/enrollments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: process.env.TEST_APP_URL!,
      },
      body: JSON.stringify({ full_name: "" }),
    });
    assert.ok([400, 429].includes(response.status));
    const body = await response.text();
    assert.doesNotMatch(body, /postgres|relation |SUPABASE_SERVICE_ROLE_KEY/i);
  },
);
