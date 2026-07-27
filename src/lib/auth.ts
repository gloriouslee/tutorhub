import { createClient } from "./supabase/server";

export async function getCurrentUserName(): Promise<string> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "User";
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role === "student") {
      const { data } = await supabase
        .from("students")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.full_name) return data.full_name;
    }
    if (profile?.role === "teacher") {
      const { data } = await supabase
        .from("teachers")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.full_name) return data.full_name;
    }
    if (profile?.role === "parent") {
      const { data } = await supabase
        .from("parents")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.full_name) return data.full_name;
    }
    return (
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "User"
    );
  } catch {
    return "User";
  }
}
