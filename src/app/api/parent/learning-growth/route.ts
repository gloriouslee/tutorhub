import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { loadParentLearningGrowth } from "@/lib/learning-growth-server";

const PRIVATE_NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(req: NextRequest) {
  const identity = await getRequestIdentity(req);
  if (!identity?.parentId || identity.role !== "parent") {
    return NextResponse.json({ error: "parent_authorization_required" }, { status: 403, ...PRIVATE_NO_STORE });
  }
  try {
    return NextResponse.json(await loadParentLearningGrowth(identity.parentId), PRIVATE_NO_STORE);
  } catch {
    return NextResponse.json({ error: "parent_learning_growth_unavailable" }, { status: 500, ...PRIVATE_NO_STORE });
  }
}
