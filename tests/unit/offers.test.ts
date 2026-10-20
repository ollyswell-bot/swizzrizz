import { describe, it, expect } from "vitest";
import { matchOffers } from "@/lib/offers";
import type { Offer } from "@/lib/domain/types";

const C1 = "c1";
const offer = (over: Partial<Offer>): Offer => ({
  id: crypto.randomUUID(), creatorId: C1, title: "Set", description: "", priceCents: 1000, currency: "USD",
  category: "photo", includedContent: "", isActive: true, availableFrom: null, availableUntil: null,
  eligibility: {}, bundleOfferIds: [], isSample: false, ...over,
});

describe("offer matching", () => {
  const now = new Date("2026-10-20T12:00:00Z");

  it("only returns active offers for the selected creator, cheapest first", () => {
    const a = offer({ priceCents: 2000 });
    const b = offer({ priceCents: 900 });
    const inactive = offer({ isActive: false });
    const other = offer({ creatorId: "c2" });
    expect(matchOffers([a, b, inactive, other], C1, null, now).map((o) => o.id)).toEqual([b.id, a.id]);
  });

  it("respects the availability window", () => {
    const future = offer({ availableFrom: "2026-11-01T00:00:00Z" });
    const expired = offer({ availableUntil: "2026-10-01T00:00:00Z" });
    const current = offer({ availableFrom: "2026-10-01T00:00:00Z", availableUntil: "2026-12-01T00:00:00Z" });
    expect(matchOffers([future, expired, current], C1, null, now).map((o) => o.id)).toEqual([current.id]);
  });

  it("applies segment and prior-purchase eligibility", () => {
    const vipOnly = offer({ eligibility: { segments: ["vip"] } });
    const loyal = offer({ eligibility: { minPriorPurchases: 2 } });
    const fan = { segment: "returning" as const, purchaseCount: 1, purchasedOfferIds: [] };
    expect(matchOffers([vipOnly, loyal], C1, fan, now)).toEqual([]);
    expect(matchOffers([vipOnly, loyal], C1, { ...fan, segment: "vip", purchaseCount: 2 }, now)).toHaveLength(2);
  });

  it("excludes offers the fan already bought", () => {
    const bought = offer({});
    expect(matchOffers([bought], C1, { segment: "vip", purchaseCount: 1, purchasedOfferIds: [bought.id] }, now)).toEqual([]);
  });

  it("returns nothing when the catalog is empty", () => {
    expect(matchOffers([], C1, null, now)).toEqual([]);
  });
});
