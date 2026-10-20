import "server-only";
import { cookies } from "next/headers";
import { getConfig } from "@/lib/config";
import type { AuthContext, Role } from "@/lib/domain/types";
import { DEMO_COOKIE, decodeDemoSession } from "./demo-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/http";
import type { Repository } from "@/lib/data/repository";
import { DemoRepository } from "@/lib/data/demo-repository";
import { SupabaseRepository } from "@/lib/data/supabase-repository";

export type SessionState =
  | { status: "anonymous" }
  | { status: "misconfigured"; reason: string }
  | { status: "no_organization"; userId: string; email: string | null }
  | { status: "ok"; ctx: AuthContext };

export async function getSessionState(): Promise<SessionState> {
  // Reading cookies first also marks every page that checks the session as dynamic.
  const cookieStore = await cookies();
  const config = getConfig();

  if (config.dataMode === "demo") {
    const token = cookieStore.get(DEMO_COOKIE)?.value;
    const session = decodeDemoSession(token, config.demoSessionSecret);
    if (!session) return { status: "anonymous" };
    return {
      status: "ok",
      ctx: {
        userId: session.uid,
        orgId: session.org,
        role: session.role,
        email: null,
        authorizationConfirmed: session.consent,
        mode: "demo",
      },
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { status: "anonymous" };

  const preferredOrg = cookieStore.get("swizzrizz_org")?.value;
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, role, authorization_confirmed_at, created_at")
    .eq("user_id", data.user.id)
    .order("created_at");
  const list = (memberships ?? []) as {
    organization_id: string;
    role: Role;
    authorization_confirmed_at: string | null;
  }[];
  if (list.length === 0) return { status: "no_organization", userId: data.user.id, email: data.user.email ?? null };
  const m = list.find((x) => x.organization_id === preferredOrg) ?? list[0];

  return {
    status: "ok",
    ctx: {
      userId: data.user.id,
      orgId: m.organization_id,
      role: m.role,
      email: data.user.email ?? null,
      authorizationConfirmed: Boolean(m.authorization_confirmed_at),
      mode: "supabase",
    },
  };
}

const WRITE_ROLES: Role[] = ["owner", "admin", "operator"];
const ADMIN_ROLES: Role[] = ["owner", "admin"];

export interface RequireOptions {
  /** "read" (any member), "write" (operator+), "admin" (owner/admin). Default: write. */
  access?: "read" | "write" | "admin";
  /** Require the authorization + adults-only confirmation. Default: true. */
  consent?: boolean;
}

/** For route handlers: returns the caller's context or throws a 401/403. */
export async function requireAuth(options: RequireOptions = {}): Promise<AuthContext> {
  const { access = "write", consent = true } = options;
  const state = await getSessionState();
  if (state.status === "misconfigured") throw new HttpError(503, "misconfigured", state.reason);
  if (state.status === "anonymous") throw new HttpError(401, "unauthenticated", "Please sign in.");
  if (state.status === "no_organization") throw new HttpError(403, "no_organization", "Create a workspace first.");
  const ctx = state.ctx;
  if (access === "write" && !WRITE_ROLES.includes(ctx.role)) throw new HttpError(403, "forbidden", "Your role can't do that.");
  if (access === "admin" && !ADMIN_ROLES.includes(ctx.role)) throw new HttpError(403, "forbidden", "Only owners and admins can do that.");
  if (consent && !ctx.authorizationConfirmed) {
    throw new HttpError(403, "authorization_required", "Confirm you're authorized to process these conversations first.");
  }
  return ctx;
}

export async function getRepository(ctx: AuthContext): Promise<Repository> {
  if (ctx.mode === "demo") return new DemoRepository(ctx, getConfig().defaultRetentionHours);
  return new SupabaseRepository(await createSupabaseServerClient(), ctx);
}
