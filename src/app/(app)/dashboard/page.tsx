import Link from "next/link";
import { ArrowRight, Copy, FileText, MessagesSquare, Sparkles, Tag } from "lucide-react";
import { getRepository, requireAuth } from "@/lib/auth/context";
import { getConfig } from "@/lib/config";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Notice, PageHeader, SectionLabel } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils";
import { ACTION_LABELS } from "@/components/copilot/labels";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await requireAuth({ access: "read", consent: false });
  const repo = await getRepository(ctx);
  const [stats, conversations, voices] = await Promise.all([repo.getActivityStats(), repo.listConversations(), repo.listVoices()]);
  const config = getConfig();

  const tiles = [
    { label: "Analyses run", value: stats.analysesRun, icon: Sparkles },
    { label: "Replies copied", value: stats.repliesCopied, icon: Copy },
    { label: "Offers suggested", value: stats.offersRecommended, icon: Tag },
    { label: "Conversations saved", value: stats.conversationsSaved, icon: MessagesSquare },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="Dashboard"
        description="What's happened in this workspace. These are counts of activity in SwizzRizz, not sales."
        actions={
          <Button variant="primary" asChild>
            <Link href="/copilot">
              <Sparkles aria-hidden /> Open Live Copilot
            </Link>
          </Button>
        }
      />

      {config.dataMode === "demo" ? (
        <Notice tone="warning">
          Demo workspace. Sample fans and offers are labelled, the AI is {config.aiMode === "mock" ? "simulated" : "live"}, and data resets when the server restarts.
        </Notice>
      ) : null}

      <section aria-label="Activity" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="flex flex-col gap-4 p-5">
            <Icon className="size-4 text-fg-subtle" aria-hidden />
            <div>
              <p className="font-mono text-3xl tabular-nums text-fg">{value}</p>
              <p className="mt-1 text-xs text-fg-muted">{label}</p>
            </div>
          </Card>
        ))}
      </section>
      <p className="-mt-5 text-xs text-fg-subtle">
        Observed events only. A copied reply means it was copied, not sent or bought. Sales tracking arrives in Phase 3.
      </p>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-fg">Recent conversations</h2>
            <Link href="/conversations" className="text-xs text-fg-muted hover:text-fg">
              View all
            </Link>
          </div>
          {conversations.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-fg-muted">No saved conversations yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {conversations.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <Link href={`/conversations/${c.id}`} className="flex items-center justify-between gap-4 py-3 text-[13px] hover:text-accent">
                    <span className="truncate text-fg">{c.title}</span>
                    <span className="shrink-0 text-xs text-fg-subtle">
                      {c.recommendedAction ? ACTION_LABELS[c.recommendedAction] : "Not analysed"} · {formatDate(c.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <h2 className="text-[13px] font-medium text-fg">How it works</h2>
          <ol className="flex flex-col gap-3">
            {[
              "Screenshot the conversation in Infloww and paste or drop it into Live Copilot.",
              "Check the transcript. Fix senders and any misread text.",
              "Analyse, then edit and copy the reply you want. You send it yourself.",
            ].map((step, i) => (
              <li key={step} className="flex gap-3 text-[13px] leading-relaxed text-fg-muted">
                <span className="font-mono text-xs text-accent">0{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-auto border-t border-border pt-4">
            <SectionLabel>Voices</SectionLabel>
            <div className="mt-2 flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-2 text-fg">
                <FileText className="size-4 text-fg-subtle" aria-hidden />
                {voices.length} voice profile{voices.length === 1 ? "" : "s"}
              </span>
              <Link href="/voices" className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg">
                Edit <ArrowRight className="size-3" aria-hidden />
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
