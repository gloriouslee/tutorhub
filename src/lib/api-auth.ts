import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export type RequestIdentity = {
  role: "student" | "parent" | "teacher" | "admin";
  studentId?: string;
  isDemo: boolean;
};

const VALID_ROLES = new Set<RequestIdentity["role"]>([
  "student", "parent", "teacher", "admin",
]);

/**
 * Resolves the caller once, so API routes never authorize an ID supplied in
 * the request body. Demo identities intentionally remain available while the
 * product is in demo mode; production users are resolved from Supabase Auth.
 */
export async function getRequestIdentity(req: NextRequest): Promise<RequestIdentity | null> {
  const demoRole = req.cookies.get("demo_role")?.value;
  if (demoRole && VALID_ROLES.has(demoRole as RequestIdentity["role"])) {
    const role = demoRole as RequestIdentity["role"];
    const enrolledId = req.cookies.get("enrolled_student_id")?.value;
    return {
      role,
      isDemo: true,
      // A plain student demo always maps to s1. The enrollment fallback keeps
      // its existing demo flow but never accepts a student ID from the body.
      studentId: role === "student" ? (enrolledId || "s1") : undefined,
    };
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll(); },
          setAll() { /* API authorization is read-only. */ },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    let role = user.user_metadata?.role as string | undefined;
    if (!VALID_ROLES.has(role as RequestIdentity["role"])) {
      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).maybeSingle();
      role = profile?.role;
    }
    if (!VALID_ROLES.has(role as RequestIdentity["role"])) return null;

    return {
      role: role as RequestIdentity["role"],
      isDemo: false,
      studentId: role === "student"
        ? (user.user_metadata?.student_id
          ?? (user.user_metadata?.enrollment_id ? `enr_${user.user_metadata.enrollment_id}` : user.id))
        : undefined,
    };
  } catch {
    return null;
  }
}

// Kiểm tra người gọi API có phải admin không.
// Chấp nhận: (1) phiên Supabase Auth với role admin trong metadata/profiles,
// hoặc (2) cookie demo_role=admin (chế độ demo — sẽ bỏ khi tắt demo mode).
export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  return (await getRequestIdentity(req))?.role === "admin";
}
