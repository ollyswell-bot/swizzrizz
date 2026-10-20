"use client";

import { useState } from "react";
import { Plus, UserRound } from "lucide-react";
import type { Creator, Fan, Offer } from "@/lib/domain/types";
import { matchOffers, formatPrice } from "@/lib/offers";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/misc";
import { SEGMENT_LABELS } from "./labels";

interface Props {
  creators: Creator[];
  creatorId: string;
  onCreatorChange: (id: string) => void;
  fans: Fan[];
  fan: Fan | null;
  onFanChange: (id: string | null) => void;
  onCreateFan: (alias: string) => Promise<void>;
  offers: Offer[];
  canWrite: boolean;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <SectionLabel>{label}</SectionLabel>
      <div className="text-[13px] leading-relaxed text-fg">{children}</div>
    </div>
  );
}

export function FanContextPanel({ creators, creatorId, onCreatorChange, fans, fan, onFanChange, onCreateFan, offers, canWrite }: Props) {
  const [alias, setAlias] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eligible = matchOffers(
    offers,
    creatorId,
    fan ? { segment: fan.segment, purchaseCount: fan.purchaseCount, purchasedOfferIds: fan.purchasedOfferIds } : null,
  );

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!alias.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await onCreateFan(alias.trim());
      setAlias("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that alias.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5 p-5" aria-label="Fan context">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-fg">Fan context</h2>
        <UserRound className="size-4 text-fg-subtle" aria-hidden />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="creator">Creator</Label>
        <Select id="creator" value={creatorId} onChange={(e) => onCreatorChange(e.target.value)}>
          {creators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fan">Fan alias</Label>
        <Select id="fan" value={fan?.id ?? ""} onChange={(e) => onFanChange(e.target.value || null)}>
          <option value="">No fan selected</option>
          {fans.map((f) => (
            <option key={f.id} value={f.id}>
              {f.alias}
              {f.isSample ? " (sample)" : ""}
            </option>
          ))}
        </Select>
        {canWrite ? (
          <form onSubmit={add} className="mt-1 flex gap-1.5">
            <Input
              aria-label="New fan alias"
              placeholder="New alias"
              value={alias}
              maxLength={80}
              onChange={(e) => setAlias(e.target.value)}
              className="h-8 text-[13px]"
            />
            <Button type="submit" size="icon" variant="secondary" disabled={adding || !alias.trim()} aria-label="Add fan alias">
              <Plus />
            </Button>
          </form>
        ) : null}
        {error ? <p className="text-xs text-danger" role="alert">{error}</p> : null}
        <p className="text-[11px] leading-relaxed text-fg-subtle">
          Pick the alias yourself. SwizzRizz never guesses which fan a screenshot belongs to.
        </p>
      </div>

      {fan ? (
        <div className="flex flex-col gap-4 border-t border-border pt-4 fade-up">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">{SEGMENT_LABELS[fan.segment]}</Badge>
            {fan.isSample ? <Badge tone="warning">Sample</Badge> : null}
            {fan.followUpStatus !== "none" ? <Badge tone="outline">{fan.followUpStatus}</Badge> : null}
          </div>
          <Row label="Previous purchases">
            {fan.purchaseCount === 0 ? <span className="text-fg-muted">None on record</span> : `${fan.purchaseCount} on record`}
          </Row>
          <Row label="Last summary">{fan.lastSummary ?? <span className="text-fg-muted">No saved conversations yet</span>}</Row>
          <Row label="Preferences">
            {fan.contentPreferences.length ? fan.contentPreferences.join(", ") : <span className="text-fg-muted">None noted</span>}
          </Row>
          <Row label="Boundaries">
            {fan.communicationBoundaries.length ? fan.communicationBoundaries.join(", ") : <span className="text-fg-muted">None noted</span>}
          </Row>
          {fan.approvedNotes ? <Row label="Notes">{fan.approvedNotes}</Row> : null}
          <Row label="Last interaction">{formatDate(fan.lastInteractionAt)}</Row>
        </div>
      ) : (
        <p className="border-t border-border pt-4 text-[13px] leading-relaxed text-fg-muted">
          Select or add a fan alias to use their history. You can also analyse without one.
        </p>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <SectionLabel>Available offers · {eligible.length}</SectionLabel>
        {eligible.length === 0 ? (
          <p className="text-[13px] text-fg-muted">No eligible offers. Replies won&apos;t include a pitch.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {eligible.map((o) => (
              <li key={o.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate text-fg">
                  {o.title}
                  {o.isSample ? <span className="ml-1.5 text-[11px] text-warning">sample</span> : null}
                </span>
                <span className="shrink-0 font-mono text-xs text-fg-muted">{formatPrice(o.priceCents, o.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
