import { BookUser } from "lucide-react";
import { getRepository, requireAuth } from "@/lib/auth/context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Notice, PageHeader } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils";
import { SEGMENT_LABELS } from "@/components/copilot/labels";

export const metadata = { title: "Fans" };

export default async function FansPage() {
  const ctx = await requireAuth({ access: "read", consent: false });
  const fans = await (await getRepository(ctx)).listFans();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader title="Fans" description="Aliases you've linked to conversations. Add new aliases from Live Copilot." />
      <Notice>Phase 2 adds full profiles: notes, preferences, boundaries, purchase history, merging and export.</Notice>
      {fans.length === 0 ? (
        <EmptyState icon={<BookUser />} title="No fans yet">Add a fan alias in Live Copilot.</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
              <tr className="border-b border-border">
                <th className="px-5 py-3 font-medium">Alias</th>
                <th className="px-5 py-3 font-medium">Segment</th>
                <th className="px-5 py-3 font-medium">Purchases on record</th>
                <th className="px-5 py-3 font-medium">Last interaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fans.map((f) => (
                <tr key={f.id}>
                  <td className="px-5 py-3 text-fg">
                    {f.alias} {f.isSample ? <Badge tone="warning" className="ml-1.5">Sample</Badge> : null}
                  </td>
                  <td className="px-5 py-3 text-fg-muted">{SEGMENT_LABELS[f.segment]}</td>
                  <td className="px-5 py-3 font-mono text-fg-muted">{f.purchaseCount}</td>
                  <td className="px-5 py-3 text-fg-muted">{formatDate(f.lastInteractionAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
