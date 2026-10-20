import type { Fan, Offer } from "@/lib/domain/types";

export interface FanOfferContext {
  segment: Fan["segment"];
  purchaseCount: number;
  purchasedOfferIds: string[];
}

/**
 * Returns the approved offers this fan can actually be shown right now.
 * Only active offers for the selected creator, inside their availability window,
 * whose eligibility rules the fan meets, and that the fan hasn't already bought.
 * The AI may only recommend an id from this list.
 */
export function matchOffers(
  offers: Offer[],
  creatorId: string,
  fan: FanOfferContext | null,
  now: Date = new Date(),
): Offer[] {
  const t = now.getTime();
  return offers
    .filter((o) => o.isActive && o.creatorId === creatorId)
    .filter((o) => !o.availableFrom || new Date(o.availableFrom).getTime() <= t)
    .filter((o) => !o.availableUntil || new Date(o.availableUntil).getTime() > t)
    .filter((o) => {
      const rules = o.eligibility ?? {};
      const segment = fan?.segment ?? "unknown";
      if (rules.segments && rules.segments.length > 0 && !rules.segments.includes(segment)) return false;
      if (rules.minPriorPurchases && (fan?.purchaseCount ?? 0) < rules.minPriorPurchases) return false;
      return true;
    })
    .filter((o) => !(fan?.purchasedOfferIds ?? []).includes(o.id))
    .sort((a, b) => a.priceCents - b.priceCents);
}

export function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}
