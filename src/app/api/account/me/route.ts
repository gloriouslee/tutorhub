import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const identity = await getRequestIdentity(req);
  if (!identity) {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  }

  return NextResponse.json(identity, {
    headers: { "Cache-Control": "no-store" },
  });
}
