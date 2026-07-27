import type { Instrumentation } from "next";
import { logEvent } from "@/lib/logger";

export async function register() {
  logEvent("info", "application.started", {
    environment: process.env.NODE_ENV,
    deployment: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
  });
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const caught = error instanceof Error ? error : new Error(String(error));
  logEvent("error", "request.unhandled_error", {
    error: caught.message,
    digest: "digest" in caught ? caught.digest : undefined,
    path: request.path,
    method: request.method,
    router_kind: context.routerKind,
    route_path: context.routePath,
    route_type: context.routeType,
  });
};
