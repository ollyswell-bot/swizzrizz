"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { MessagesSquare, Trash2 } from "lucide-react";
import type { ConversationSummary } from "@/lib/domain/types";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { ACTION_LABELS } from "@/components/copilot/labels";

export function ConversationList({ initial, canDelete }: { initial: ConversationSummary[]; canDelete: boolean }) {
  const [items, setItems] = useState(initial);
  const [pending, setPending] = useState<string | null>(null);

  async function remove(id: string) {
    if (!confirm("Delete this conversation permanently? This can't be undone.")) return;
    setPending(id);
    try {
      await api(`/api/conversations/${id}`, { method: "DELETE" });
      setItems((list) => list.filter((c) => c.id !== id));
      toast.success("Conversation deleted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete.");
    } finally {
      setPending(null);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<MessagesSquare />}
        title="No saved conversations"
        action={
          <Button variant="secondary" asChild>
            <Link href="/copilot">Open Live Copilot</Link>
          </Button>
        }
      >
        Analyse a conversation in Live Copilot and press Save to keep it here.
      </EmptyState>
    );
  }

  return (
    <Card className="divide-y divide-border">
      {items.map((c) => (
        <div key={c.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href={`/conversations/${c.id}`} className="min-w-0 flex-1 hover:text-accent">
            <p className="truncate text-sm text-fg">{c.title}</p>
            <p className="mt-0.5 text-xs text-fg-subtle">
              {c.messageCount} messages · {formatDate(c.createdAt)}
              {c.fanAlias ? ` · ${c.fanAlias}` : ""}
            </p>
          </Link>
          <div className="flex items-center gap-2">
            {c.recommendedAction ? <Badge tone="accent">{ACTION_LABELS[c.recommendedAction]}</Badge> : <Badge>Not analysed</Badge>}
            {canDelete ? (
              <Button variant="ghost" size="icon" onClick={() => remove(c.id)} disabled={pending === c.id} aria-label={`Delete ${c.title}`}>
                <Trash2 />
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </Card>
  );
}
