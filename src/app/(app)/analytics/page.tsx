import { getRepository, requireAuth } from "@/lib/auth/context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Notice, PageHeader } from "@/components/ui/misc";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const ctx = await requireAuth({ access: "read", consent: false });
  const s = await (await getRepository(ctx)).getActivityStats();
  const rows = [
    { label: "Conversations analysed", value: s.analysesRun, kind: "Observed" },
    { label: "Reply drafts generated", value: s.repliesGenerated * 3, kind: "Observed" },
    { label: "Replies copied", value: s.repliesCopied, kind: "Observed" },
    { label: "Offers suggested by AI", value: s.offersRecommended, kind: "AI prediction" },
    { label: "Conversations saved", value: s.conversationsSaved, kind: "Observed" },
  ];
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader title="Analytics" description="Activity inside SwizzRizz, labelled by where each number comes from." />
      <Notice>
        Revenue, confirmed purchases, average order value and conversion rates arrive in Phase 3 with sales outcome tracking. They
        will be kept separate from these activity counts. Copying a reply is never counted as a sale.
      </Notice>
      <Card className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
            <tr className="border-b border-border">
              <th className="px-5 py-3 font-medium">Metric</th>
              <th className="px-5 py-3 font-medium">Source</th>
              <th className="px-5 py-3 text-right font-medium">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="px-5 py-3 text-fg">{r.label}</td>
                <td className="px-5 py-3">
                  <Badge tone={r.kind === "AI prediction" ? "warning" : "neutral"}>{r.kind}</Badge>
                </td>
                <td className="px-5 py-3 text-right font-mono tabular-nums text-fg">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
