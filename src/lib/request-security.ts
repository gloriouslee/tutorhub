import "server-only";

import type { NextRequest } from "next/server";

export function hasValidMutationOrigin(req: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const origin = req.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";

  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const expected = configured ? new URL(configured).origin : req.nextUrl.origin;
  try {
    return new URL(origin).origin === expected;
  } catch {
    return false;
  }
}
