"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  getStudentCurriculum,
  type CurriculumChapter,
} from "@/lib/storage";

export const STUDENT_CURRICULUM_CACHE_TTL_MS = 2 * 60_000;

type CurriculumCacheEntry = {
  data: CurriculumChapter[] | undefined;
  error: Error | null;
  fetchedAt: number;
  promise: Promise<CurriculumChapter[]> | null;
  version: number;
  listeners: Set<() => void>;
};

const curriculumCache = new Map<string, CurriculumCacheEntry>();

function cacheKey(studentId: string, classId: string) {
  return `${studentId}:${classId}`;
}

function getEntry(key: string): CurriculumCacheEntry {
  const existing = curriculumCache.get(key);
  if (existing) return existing;
  const created: CurriculumCacheEntry = {
    data: undefined,
    error: null,
    fetchedAt: 0,
    promise: null,
    version: 0,
    listeners: new Set(),
  };
  curriculumCache.set(key, created);
  return created;
}

function notify(entry: CurriculumCacheEntry) {
  entry.version += 1;
  for (const listener of entry.listeners) listener();
}

function refreshEntry(
  entry: CurriculumCacheEntry,
  classId: string,
  force = false,
): Promise<CurriculumChapter[]> {
  if (entry.promise) return entry.promise;
  const fresh = entry.data !== undefined
    && Date.now() - entry.fetchedAt < STUDENT_CURRICULUM_CACHE_TTL_MS;
  if (!force && fresh) return Promise.resolve(entry.data!);

  entry.error = null;
  const request = getStudentCurriculum(classId)
    .then((chapters) => {
      entry.data = chapters;
      entry.fetchedAt = Date.now();
      entry.error = null;
      return chapters;
    })
    .catch((error: unknown) => {
      entry.error = error instanceof Error
        ? error
        : new Error("Không thể tải lộ trình học.");
      throw entry.error;
    })
    .finally(() => {
      entry.promise = null;
      notify(entry);
    });
  entry.promise = request;
  notify(entry);
  return request;
}

export function useStudentCurriculum({
  classId,
  studentId,
  enabled = true,
}: {
  classId: string;
  studentId: string;
  enabled?: boolean;
}) {
  const key = enabled && classId && studentId ? cacheKey(studentId, classId) : "";
  const entry = useMemo(() => (key ? getEntry(key) : null), [key]);
  const subscribe = useCallback((listener: () => void) => {
    if (!entry) return () => undefined;
    entry.listeners.add(listener);
    return () => { entry.listeners.delete(listener); };
  }, [entry]);
  const getSnapshot = useCallback(() => entry?.version ?? 0, [entry]);
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!entry || !enabled) return;
    const revalidateIfStale = () => {
      const stale = entry.data === undefined
        || Date.now() - entry.fetchedAt >= STUDENT_CURRICULUM_CACHE_TTL_MS;
      if (stale) void refreshEntry(entry, classId).catch(() => undefined);
    };
    revalidateIfStale();
    window.addEventListener("focus", revalidateIfStale);
    return () => window.removeEventListener("focus", revalidateIfStale);
  }, [classId, enabled, entry]);

  const retry = useCallback(async () => {
    if (!entry) return;
    await refreshEntry(entry, classId, true);
  }, [classId, entry]);

  return {
    chapters: entry?.data,
    error: entry?.error ?? null,
    isLoading: Boolean(enabled && entry?.data === undefined && !entry?.error),
    isRefreshing: Boolean(entry?.promise && entry.data !== undefined),
    retry,
  };
}
