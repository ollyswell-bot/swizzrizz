import { getConfig } from "@/lib/config";
import { getRepository, requireAuth } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/misc";
import { SettingsPanel } from "@/components/app/settings-panel";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireAuth({ access: "read", consent: false });
  const settings = await (await getRepository(ctx)).getSettings();
  const config = getConfig();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader title="Settings" description="Workspace configuration, privacy and data controls." />
      <SettingsPanel
        retentionHours={settings.retentionHours}
        isAdmin={ctx.role === "owner" || ctx.role === "admin"}
        dataMode={config.dataMode}
        aiMode={config.aiMode}
        aiModel={config.aiMode === "live" ? config.aiModel : "demo-mock-v1"}
        demoSecretMissing={config.dataMode === "demo" && config.demoSecretIsFallback}
      />
    </div>
  );
}
