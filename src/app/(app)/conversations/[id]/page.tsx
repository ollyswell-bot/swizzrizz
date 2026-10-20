import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getRepository, requireAuth } from "@/lib/auth/context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, SectionLabel } from "@/components/ui/misc";
import { cn, formatDate, humanize } from "@/lib/utils";
import { ACTION_LABELS, INTENT_LABELS } from "@/components/copilot/labels";

export default async function ConversationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuth({ access: "read", consent: false });
  const conversation = await (await getRepository(ctx)).getConversation(id);
  if (!conversation) notFound();
  const a = conversation.analysis;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <Link href="/conversations" className="flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg">
        <ArrowLeft className="size-3.5" aria-hidden /> All conversations
      </Link>
      <PageHeader title={conversation.title} description={`Saved ${formatDate(conversation.createdAt)}${conversation.fanAlias ? ` · ${conversation.fanAlias}` : ""}`} />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-5">
          <h2 className="mb-4 text-[13px] font-medium text-fg">Transcript</h2>
          <ol className="flex flex-col gap-2">
            {conversation.messages.map((m) => (
              <li
                key={m.id}
                className={cn(
                  "max-w-[85%] rounded-xl px-3.5 py-2 text-[14px] leading-relaxed",
                  m.sender === "creator" ? "self-end bg-accent-soft text-fg" : "self-start bg-surface-2 text-fg",
                )}
              >
                <span className="mb-0.5 block text-[10px] uppercase tracking-wider text-fg-subtle">
                  {m.sender}
                  {m.timestamp ? ` · ${m.timestamp}` : ""}
                </span>
                {m.text}
              </li>
            ))}
          </ol>
        </Card>
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="text-[13px] font-medium text-fg">Analysis</h2>
          {a ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="accent">{ACTION_LABELS[a.recommended_action]}</Badge>
                <Badge>{INTENT_LABELS[a.buying_intent]}</Badge>
                <Badge className="capitalize">{humanize(a.conversation_stage)}</Badge>
                {a.mode === "mock" ? <Badge tone="warning">Demo AI</Badge> : null}
              </div>
              <div>
                <SectionLabel>Best reply</SectionLabel>
                <p className="mt-1 text-[14px] text-fg">{a.best_reply}</p>
              </div>
              <div>
                <SectionLabel>Why</SectionLabel>
                <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{a.reasoning}</p>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-fg-muted">This conversation was saved without an analysis.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
