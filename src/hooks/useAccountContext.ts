"use client";

import { useEffect, useState } from "react";
import type { Class, UserRole } from "@/types";

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
    }
  | {
      role: "teacher";
      teacherId: string;
      teacherName: string;
      classes: Class[];
    }
  | {
      role: "parent";
      parentId: string;
      parentName: string;
      children: ParentChild[];
    }
  | {
      role: Exclude<UserRole, "student" | "teacher" | "parent">;
      displayName: string;
    };

interface AccountContextState {
  context: AccountContext | null;
  ready: boolean;
}

const CACHE_TTL_MS = 60_000;

let cachedContext: AccountContext | null = null;
let cachedAt = 0;
let inFlight: Promise<AccountContext> | null = null;
let cacheGeneration = 0;

function getFreshCachedContext(): AccountContext | null {
  if (!cachedContext || Date.now() - cachedAt >= CACHE_TTL_MS) return null;
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
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("account-context-reset"));
  }
}

export function useAccountContext(): AccountContextState {
  const cached = getFreshCachedContext();
  const [state, setState] = useState<AccountContextState>({
    context: cached,
    ready: cached !== null,
  });

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      setState((current) => ({ context: current.context, ready: false }));
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
