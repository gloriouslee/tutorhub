import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { isNonEmptyString, normalizeContactPhone } from "@/lib/validation";
import { logEvent } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "teacher" || !actor.teacherId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = createAdminClient();
  const [teacherResult, profileResult, userResult] = await Promise.all([
    admin.from("teachers").select("full_name,email,specialization,bio,avatar_url").eq("id", actor.teacherId).maybeSingle(),
    admin.from("profiles").select("phone").eq("id", actor.userId).maybeSingle(),
    admin.auth.admin.getUserById(actor.userId),
  ]);
  if (teacherResult.error || !teacherResult.data || profileResult.error || userResult.error) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }
  return NextResponse.json({
    full_name: teacherResult.data.full_name,
    email: userResult.data.user.email ?? teacherResult.data.email ?? actor.email ?? "",
    phone: profileResult.data?.phone ?? "",
    specialization: teacherResult.data.specialization ?? "",
    bio: teacherResult.data.bio ?? "",
    avatar_url: teacherResult.data.avatar_url ?? "",
  });
}

export async function PATCH(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (actor?.role !== "teacher" || !actor.teacherId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isNonEmptyString(body.full_name, 120)) {
    return NextResponse.json({ error: "invalid_full_name" }, { status: 400 });
  }
  const fullName = body.full_name.trim();
  const specialization = typeof body.specialization === "string" ? body.specialization.trim() : "";
  const bio = typeof body.bio === "string" ? body.bio.trim() : "";
  const avatarUrl = typeof body.avatar_url === "string" ? body.avatar_url.trim() : "";
  if (specialization.length > 160 || bio.length > 2_000 || avatarUrl.length > 2_000) {
    return NextResponse.json({ error: "invalid_profile" }, { status: 400 });
  }
  if (avatarUrl && !avatarUrl.startsWith("/api/files?bucket=avatars&")) {
    return NextResponse.json({ error: "invalid_avatar_url" }, { status: 400 });
  }
  const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
  const phone = rawPhone ? normalizeContactPhone(rawPhone) : null;
  if (rawPhone && !phone) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const admin = createAdminClient();
  const [teacherUpdate, profileUpdate, metadataUpdate] = await Promise.all([
    admin.from("teachers").update({
      full_name: fullName,
      specialization: specialization || null,
      bio: bio || null,
      avatar_url: avatarUrl || null,
    }).eq("id", actor.teacherId),
    admin.from("profiles").update({ full_name: fullName, phone }).eq("id", actor.userId),
    admin.auth.admin.updateUserById(actor.userId, { user_metadata: { full_name: fullName } }),
  ]);
  if (teacherUpdate.error || profileUpdate.error || metadataUpdate.error) {
    return NextResponse.json({ error: "profile_update_failed" }, { status: 500 });
  }
  logEvent("info", "teacher.profile_updated", { actor_id: actor.userId });
  return NextResponse.json({ success: true });
}

