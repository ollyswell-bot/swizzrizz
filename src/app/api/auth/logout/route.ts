import { cookies } from "next/headers";
import { getConfig } from "@/lib/config";
import { DEMO_COOKIE } from "@/lib/auth/demo-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { json, route } from "@/lib/http";

export const POST = route(async () => {
  const store = await cookies();
  store.delete(DEMO_COOKIE);
  store.delete("swizzrizz_org");
  if (getConfig().dataMode === "supabase") {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  return json({ ok: true });
});
