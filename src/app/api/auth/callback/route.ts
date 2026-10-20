import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Supabase email confirmation / magic-link landing. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code && getConfig().dataMode === "supabase") {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL("/dashboard", url.origin));
}
