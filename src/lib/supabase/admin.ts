import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_SERVER_URL } from "./config";

// Service-role client: bypasses RLS. Server-only — never import from client components.
export function createAdminClient() {
  return createSupabaseClient(
    SUPABASE_SERVER_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
