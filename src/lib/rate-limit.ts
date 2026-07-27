import "server-only";

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { logEvent } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export function getHashedClientAddress(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    forwarded ??
    "unknown";
  const secret = process.env.RATE_LIMIT_HASH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("RATE_LIMIT_HASH_SECRET is required in production");
  }
  return createHash("sha256")
    .update(`${secret ?? "development-only"}:${address}`)
    .digest("hex");
}

export async function consumeRateLimit(options: {
  scope: string;
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_scope: options.scope,
    p_key: options.key,
    p_limit: options.limit,
    p_window_seconds: options.windowSeconds,
  });

  if (error) {
    logEvent("error", "rate_limit.rpc_failed", {
      scope: options.scope,
      error: error.message,
    });
    return false;
  }
  return data === true;
}
