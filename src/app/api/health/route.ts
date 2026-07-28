import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";
const DATABASE_HEALTH_TIMEOUT_MS = 1_500;

export async function GET() {
  const startedAt = Date.now();
  try {
    const { error } = await createAdminClient()
      .from("profiles")
      .select("id")
      .limit(1)
      .abortSignal(AbortSignal.timeout(DATABASE_HEALTH_TIMEOUT_MS));
    if (error) throw error;
    return NextResponse.json(
      { status: "ok", database: "reachable" },
      {
        headers: {
          "Cache-Control": "no-store",
          "Server-Timing": `db;dur=${Date.now() - startedAt}`,
        },
      },
    );
  } catch (error) {
    logEvent("error", "health.database_unavailable", {
      error:
        error instanceof Error
          ? error.message
          : error && typeof error === "object" && "message" in error
            ? String(error.message)
            : "unknown",
    });
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
