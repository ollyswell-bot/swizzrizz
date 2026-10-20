import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "@/lib/config";

/** Per-request client acting as the signed-in user. RLS applies to every query. */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const config = getConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error("Supabase is not configured");
  const cookieStore = await cookies();
  return createServerClient(config.supabaseUrl, config.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS, so it is only used by the scheduled retention
 * purge, never in a request made on behalf of a user.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const config = getConfig();
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for this operation");
  }
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
