import { getRepository, requireAuth } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/misc";
import { ConversationList } from "@/components/app/conversation-list";

export const metadata = { title: "Conversations" };

export default async function ConversationsPage() {
  const ctx = await requireAuth({ access: "read", consent: false });
  const conversations = await (await getRepository(ctx)).listConversations();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader title="Conversations" description="Saved transcripts and the analysis that went with them. Search and filters arrive in Phase 2." />
      <ConversationList initial={conversations} canDelete={ctx.role !== "viewer"} />
    </div>
  );
}
