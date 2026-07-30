import "server-only";

import type { NextRequest } from "next/server";

export function hasValidMutationOrigin(req: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const origin = req.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";

  let requestOrigin: string;
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    return false;
  }

  // Accept the host the request was actually served on (the canonical
  // same-origin CSRF check) as well as the configured canonical URL. This lets
  // the app work on both the apex (toananhhuy.com) and www hosts: a POST from
  // whichever host the browser is on matches that same host, while a genuine
  // cross-site request still fails. Vercel only routes configured domains, so
  // req.nextUrl.origin can't be spoofed to an attacker-controlled value.
  const allowed = new Set<string>([req.nextUrl.origin]);
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      allowed.add(new URL(configured).origin);
    } catch {
      /* ignore malformed config */
    }
  }
  return allowed.has(requestOrigin);
}
