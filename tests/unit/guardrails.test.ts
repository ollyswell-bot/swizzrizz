import { describe, it, expect } from "vitest";
import { enforceGuardrails } from "@/lib/ai/guardrails";
import { offer, output, voice } from "./helpers";

describe("server-side guardrails on AI output", () => {
  it("removes an offer id that isn't in the eligible list", () => {
    const fabricated = crypto.randomUUID();
    const r = enforceGuardrails(output({ recommended_offer_id: fabricated, recommended_action: "present_offer" }), [offer()], voice());
    expect(r.output.recommended_offer_id).toBeNull();
    expect(r.output.recommended_action).toBe("continue_conversation");
    expect(r.offer).toBeNull();
    expect(r.warnings.join(" ")).toMatch(/isn't active or eligible/);
  });

  it("downgrades present_offer when there is nothing to offer", () => {
    const r = enforceGuardrails(output({ recommended_action: "present_offer" }), [], voice());
    expect(r.output.recommended_action).toBe("continue_conversation");
  });

  it("keeps a valid offer and accepts its exact price", () => {
    const o = offer({ priceCents: 2500 });
    const r = enforceGuardrails(output({ recommended_offer_id: o.id, recommended_action: "present_offer", best_reply: "want it? it's $25" }), [o], voice());
    expect(r.offer?.id).toBe(o.id);
    expect(r.warnings).toEqual([]);
  });

  it("flags prices that don't match the approved offer", () => {
    const o = offer({ priceCents: 2500 });
    const r = enforceGuardrails(output({ recommended_offer_id: o.id, best_reply: "just $15 for you" }), [o], voice());
    expect(r.warnings.join(" ")).toMatch(/doesn't match an approved offer/);
    const r2 = enforceGuardrails(output({ best_reply: "only 20 dollars babe" }), [], voice());
    expect(r2.warnings.join(" ")).toMatch(/price/);
  });

  it("flags scarcity, false intimacy and prohibited phrases", () => {
    const r = enforceGuardrails(
      output({
        best_reply: "last chance, it expires tonight",
        alternatives: [{ tone: "playful", message: "i'm only talking to you rn" }, { tone: "warm", message: "buy now hun" }],
      }),
      [],
      voice(),
    );
    const text = r.warnings.join(" | ");
    expect(text).toMatch(/urgency or scarcity/);
    expect(text).toMatch(/personal claim/);
    expect(text).toMatch(/prohibited phrase "buy now"/);
  });

  it("does not mutate the original output", () => {
    const original = output({ recommended_action: "present_offer" });
    enforceGuardrails(original, [], voice());
    expect(original.recommended_action).toBe("present_offer");
  });
});
