import { cookies } from "next/headers";
import { getConfig } from "@/lib/config";
import { DEMO_COOKIE, DEMO_COOKIE_MAX_AGE, encodeDemoSession, newDemoSession } from "@/lib/auth/demo-session";
import { HttpError, json, route } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

/** Starts a demo workspace. Each call creates a fresh, isolated organization. */
export const POST = route(async (req: Request) => {
  const config = getConfig();
  if (config.dataMode !== "demo") throw new HttpError(404, "not_found", "Demo mode is off.");
  enforceRateLimit(`demo-login:${req.headers.get("x-forwarded-for") ?? "local"}`, 10);
  const token = encodeDemoSession(newDemoSession(), config.demoSessionSecret);
  (await cookies()).set(DEMO_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.SWIZZRIZZ_INSECURE_COOKIES !== "1",
    path: "/",
    maxAge: DEMO_COOKIE_MAX_AGE,
  });
  return json({ ok: true });
});
