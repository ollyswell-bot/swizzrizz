import { getRepository, requireAuth } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/misc";
import { VoiceEditor } from "@/components/app/voice-editor";

export const metadata = { title: "Creator Voices" };

export default async function VoicesPage() {
  const ctx = await requireAuth({ access: "read", consent: false });
  const repo = await getRepository(ctx);
  const [voices, creators] = await Promise.all([repo.listVoices(), repo.listCreators()]);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader
        title="Creator Voices"
        description="Approved writing styles. Replies follow the selected voice, avoid its prohibited phrases and respect its boundaries."
      />
      <VoiceEditor initial={voices} creators={creators} canEdit={ctx.role === "owner" || ctx.role === "admin"} />
    </div>
  );
}
