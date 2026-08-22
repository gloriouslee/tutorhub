"use client";

import { useEffect, useState } from "react";
import type { Class, UserRole } from "@/types";
import type { PortalBranding } from "@/lib/portal-branding";
import { invalidateClientQueries } from "@/lib/client-query-cache";

export interface ParentChild {
  id: string;
  name: string;
  grade?: string;
  school?: string;
  classes: Class[];
}

export type AccountContext =
  | {
      role: "student";
      studentId: string;
      studentName: string;
      classes: Class[];
      assignedClassId: string;
      portalBranding: PortalBranding;
      teacherBrandings: Record<string, PortalBranding>;
      avatarUrl: string;
    }
  | {
      role: "teacher";
      userId: string;
      teacherId: string;
      teacherName: string;
      classes: Class[];
      portalBranding: PortalBranding;
      avatarUrl: string;
    }
  | {
      role: "parent";
      parentId: string;
      parentName: string;
      children: ParentChild[];
      avatarUrl: string;
    }
  | {
      role: Exclude<UserRole, "student" | "teacher" | "parent">;
      displayName: string;
      avatarUrl: string;
    };

interface AccountContextState {
  context: AccountContext | null;
  ready: boolean;
}

const CACHE_TTL_MS = 120_000;
const SESSION_CACHE_KEY = "tutorhub_account_context_v1";

let cachedContext: AccountContext | null = null;
let cachedAt = 0;
let inFlight: Promise<AccountContext> | null = null;
let cacheGeneration = 0;

function hydrateSessionCache() {
  if (cachedContext || typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      context?: AccountContext;
      cachedAt?: number;
    };
    if (
      parsed.context
      && typeof parsed.cachedAt === "number"
      && Date.now() - parsed.cachedAt < CACHE_TTL_MS
    ) {
      cachedContext = parsed.context;
      cachedAt = parsed.cachedAt;
    } else {
      window.sessionStorage.removeItem(SESSION_CACHE_KEY);
    }
  } catch {
    // Ignore browsers that block session storage.
  }
}

function persistSessionCache(context: AccountContext) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      SESSION_CACHE_KEY,
      JSON.stringify({ context, cachedAt }),
    );
  } catch {
    // Memory cache remains available when storage is blocked or full.
  }
}

function getFreshCachedContext(): AccountContext | null {
  hydrateSessionCache();
  if (!cachedContext || Date.now() - cachedAt >= CACHE_TTL_MS) return null;
  return cachedContext;
}

function getCachedContext(): AccountContext | null {
  return cachedContext;
}

export function loadAccountContext(): Promise<AccountContext> {
  const cached = getFreshCachedContext();
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;

  const generation = cacheGeneration;
  inFlight = fetch("/api/account/context", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("account_context_unavailable");
      return response.json() as Promise<AccountContext>;
    })
    .then((context) => {
      if (generation === cacheGeneration) {
        cachedContext = context;
        cachedAt = Date.now();
        persistSessionCache(context);
      }
      return context;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export function resetAccountContextCache() {
  cacheGeneration += 1;
  cachedContext = null;
  cachedAt = 0;
  inFlight = null;
  invalidateClientQueries();
  if (typeof window !== "undefined") {
    try { window.sessionStorage.removeItem(SESSION_CACHE_KEY); } catch {}
    window.dispatchEvent(new Event("account-context-reset"));
  }
}

export function useAccountContext(): AccountContextState {
  // Render the last in-memory value immediately, even when its TTL elapsed,
  // while loadAccountContext refreshes it in the background. Explicit resets
  // still clear the module cache and a failed refresh clears the stale value.
  const cached = getCachedContext();
  const [state, setState] = useState<AccountContextState>({
    context: cached,
    ready: cached !== null,
  });

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      setState((current) => ({
        context: current.context,
        ready: current.context !== null,
      }));
      loadAccountContext()
        .then((context) => {
          if (!cancelled) setState({ context, ready: true });
        })
        .catch(() => {
          if (!cancelled) setState({ context: null, ready: true });
        });
    };
    refresh();
    window.addEventListener("account-context-reset", refresh);

    return () => {
      cancelled = true;
      window.removeEventListener("account-context-reset", refresh);
    };
  }, []);

  return state;
}
