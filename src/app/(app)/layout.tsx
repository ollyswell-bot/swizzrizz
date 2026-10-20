import { redirect } from "next/navigation";
import { getConfig } from "@/lib/config";
import { getSessionState } from "@/lib/auth/context";
import { AppShell } from "@/components/app/app-shell";
import { ConsentGate } from "@/components/app/consent-gate";
import { Notice } from "@/components/ui/misc";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const state = await getSessionState();
  if (state.status === "anonymous") redirect("/login");
  if (state.status === "no_organization") redirect("/onboarding");
  if (state.status === "misconfigured") {
    return (
      <main className="mx-auto max-w-lg p-8">
        <Notice tone="danger">{state.reason}</Notice>
      </main>
    );
  }
  const config = getConfig();
  const { ctx } = state;
  return (
    <AppShell dataMode={config.dataMode} aiMode={config.aiMode} role={ctx.role} email={ctx.email}>
      {ctx.authorizationConfirmed ? children : <ConsentGate dataMode={config.dataMode} aiMode={config.aiMode} />}
    </AppShell>
  );
}
