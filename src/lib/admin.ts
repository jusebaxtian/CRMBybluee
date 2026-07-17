import type { createClient } from "@/lib/supabase/server";

export async function isPlatformAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.rpc("is_platform_admin");
  return data === true;
}
