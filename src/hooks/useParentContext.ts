"use client";

import { useEffect, useState } from "react";
import type { Class } from "@/types";

export interface ParentChild {
  id: string;
  name: string;
  grade?: string;
  school?: string;
  classes: Class[];
}

export interface ParentContext {
  parentId: string;
  parentName: string;
  children: ParentChild[];
  ready: boolean;
}

const EMPTY_CONTEXT: ParentContext = {
  parentId: "",
  parentName: "",
  children: [],
  ready: false,
};

export function useParentContext(): ParentContext {
  const [context, setContext] = useState<ParentContext>(EMPTY_CONTEXT);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/context", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("parent_context_unavailable");
        return response.json() as Promise<{
          role: string;
          parentId: string;
          parentName: string;
          children: ParentChild[];
        }>;
      })
      .then((data) => {
        if (cancelled || data.role !== "parent") return;
        setContext({
          parentId: data.parentId,
          parentName: data.parentName,
          children: data.children ?? [],
          ready: true,
        });
      })
      .catch(() => {
        if (!cancelled) setContext((current) => ({ ...current, ready: true }));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return context;
}
