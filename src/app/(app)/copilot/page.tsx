import { getConfig } from "@/lib/config";
import { getRepository, requireAuth } from "@/lib/auth/context";
import { CopilotLoader } from "@/components/copilot/copilot-loader";

export const metadata = { title: "Live Copilot" };

export default async function CopilotPage() {
  const ctx = await requireAuth({ access: "read", consent: false });
  const repo = await getRepository(ctx);
  const [creators, voices, fans, offers] = await Promise.all([
    repo.listCreators(),
    repo.listVoices(),
    repo.listFans(),
    repo.listOffers(),
  ]);
  const config = getConfig();
  return (
    <CopilotLoader
      creators={creators}
      voices={voices}
      fans={fans}
      offers={offers}
      aiMode={config.aiMode}
      maxImages={config.maxImagesPerRequest}
      maxBytes={config.maxUploadBytes}
      canWrite={ctx.role !== "viewer"}
    />
  );
}
