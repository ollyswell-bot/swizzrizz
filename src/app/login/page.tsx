import { redirect } from "next/navigation";
import { getConfig } from "@/lib/config";
import { getSessionState } from "@/lib/auth/context";
import { LoginForm } from "@/components/app/login-form";
import { BrandMark } from "@/components/app/brand";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const config = getConfig();
  const state = await getSessionState();
  if (state.status === "ok") redirect("/copilot");
  if (state.status === "no_organization") redirect("/onboarding");

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface p-12 lg:flex">
        <BrandMark />
        <div className="max-w-md">
          <p className="font-display text-[44px] leading-[1.05] tracking-tight text-fg">
            Read the room.
            <br />
            <span className="italic text-accent">Then reply.</span>
          </p>
          <p className="mt-6 text-sm leading-relaxed text-fg-muted">
            Drop in a screenshot of the conversation. SwizzRizz reads it, suggests replies in the creator&apos;s approved voice,
            and leaves the final word to you. Nothing is ever sent automatically.
          </p>
        </div>
        <ol className="grid grid-cols-3 gap-4 text-xs text-fg-subtle">
          {["Screenshot", "Review transcript", "Copy a reply"].map((s, i) => (
            <li key={s} className="border-t border-border-strong pt-3">
              <span className="font-mono text-fg-muted">0{i + 1}</span>
              <span className="mt-1 block">{s}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <BrandMark className="mb-10 lg:hidden" />
          <LoginForm
            mode={config.dataMode}
            misconfigured={state.status === "misconfigured" ? state.reason : null}
            supabaseUrl={config.supabaseUrl}
            supabaseAnonKey={config.supabaseAnonKey}
          />
        </div>
      </section>
    </main>
  );
}
