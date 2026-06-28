import { createClient } from "./supabase/server";
import { cookies } from "next/headers";

export async function getCurrentUserName(): Promise<string> {
  const cookieStore = await cookies();
  const demoRole = cookieStore.get("demo_role")?.value;
  if (demoRole) return "Demo User";

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "User";
    return (
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "User"
    );
  } catch {
    return "User";
  }
}
