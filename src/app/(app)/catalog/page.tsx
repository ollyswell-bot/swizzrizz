import { Tags } from "lucide-react";
import { getRepository, requireAuth } from "@/lib/auth/context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Notice, PageHeader } from "@/components/ui/misc";
import { formatPrice } from "@/lib/offers";

export const metadata = { title: "PPV Catalog" };

export default async function CatalogPage() {
  const ctx = await requireAuth({ access: "read", consent: false });
  const offers = await (await getRepository(ctx)).listOffers();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader title="PPV Catalog" description="The only offers the copilot may suggest. Inactive or ineligible offers are never recommended." />
      <Notice>
        Phase 2 adds catalog management (create, edit, availability windows, eligibility, bundles). Until then, offers can be added
        directly in the database table <code className="font-mono text-xs">ppv_offers</code>.
      </Notice>
      {offers.length === 0 ? (
        <EmptyState icon={<Tags />} title="No offers yet">
          Without offers, replies focus on conversation and never pitch.
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {offers.map((o) => (
            <Card key={o.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm text-fg">{o.title}</h2>
                <span className="font-mono text-sm text-fg">{formatPrice(o.priceCents, o.currency)}</span>
              </div>
              <p className="text-[13px] leading-relaxed text-fg-muted">{o.description}</p>
              <div className="mt-auto flex flex-wrap gap-1.5">
                {o.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
                <Badge tone="outline">{o.category}</Badge>
                {o.eligibility.segments?.length ? <Badge tone="outline">For: {o.eligibility.segments.join(", ")}</Badge> : null}
                {o.isSample ? <Badge tone="warning">Sample</Badge> : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
