"use client";

import { useEffect, useState } from "react";

/** Bump when the user returns to this tab so server-backed counters refresh. */
export function useWindowFocusRevision() {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let lastRefresh = 0;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh < 500) return;
      lastRefresh = now;
      setRevision((current) => current + 1);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return revision;
}
