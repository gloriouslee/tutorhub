type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const values = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();
let cacheEpoch = 0;

/**
 * Deduplicate and briefly memoize authenticated reads in the current browser
 * session. Server executions intentionally bypass this cache so data from two
 * users can never share a process-level entry.
 */
export function cachedClientQuery<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = 30_000,
): Promise<T> {
  if (typeof window === "undefined" || ttlMs <= 0) return loader();

  const now = Date.now();
  const cached = values.get(key);
  if (cached && cached.expiresAt > now) {
    return Promise.resolve(cached.value as T);
  }
  if (cached) values.delete(key);

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const requestEpoch = cacheEpoch;
  const request = loader()
    .then((value) => {
      if (requestEpoch === cacheEpoch) {
        values.set(key, { value, expiresAt: Date.now() + ttlMs });
      }
      return value;
    })
    .finally(() => {
      if (inFlight.get(key) === request) inFlight.delete(key);
    });
  inFlight.set(key, request);
  return request;
}

export function invalidateClientQueries(...prefixes: string[]) {
  if (typeof window === "undefined") return;
  cacheEpoch += 1;
  if (prefixes.length === 0) {
    values.clear();
    inFlight.clear();
    return;
  }
  for (const key of values.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) values.delete(key);
  }
  // In-flight work cannot be cancelled safely. Removing it means the next read
  // starts fresh and the old request can no longer be reused after a mutation.
  for (const key of inFlight.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) inFlight.delete(key);
  }
}

export function normalizedQueryKey(
  namespace: string,
  filters: Record<string, readonly string[] | string | undefined>,
) {
  const normalized = Object.fromEntries(
    Object.entries(filters).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value].sort() : value ?? "",
    ]),
  );
  return `${namespace}:${JSON.stringify(normalized)}`;
}

export function cachedJsonFetch<T>(
  key: string,
  input: RequestInfo | URL,
  init: RequestInit = {},
  ttlMs = 30_000,
): Promise<T> {
  return cachedClientQuery(key, async () => {
    const response = await fetch(input, init);
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      const error = new Error(payload?.error || `request_failed_${response.status}`);
      Object.assign(error, { status: response.status });
      throw error;
    }
    return response.json() as Promise<T>;
  }, ttlMs);
}
