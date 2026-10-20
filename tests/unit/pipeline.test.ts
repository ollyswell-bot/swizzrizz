import { describe, it, expect, vi } from "vitest";
import { runAnalysis, runExtraction } from "@/lib/ai/pipeline";
import { MockProvider, type AIProvider } from "@/lib/ai/provider";
import { fan, offer, output, transcript, voice, CREATOR } from "./helpers";

const img = { mime: "image/png" as const, base64: "AAAA" };
const page = (messages: { sender: "fan" | "creator"; text: string }[], safety = {}) => ({
  messages: messages.map((m) => ({ ...m, timestamp: null, uncertain: false })),
  unreadable_sections: 0,
  notes: null,
  safety: { possible_minor: false, not_a_conversation: false, ...safety },
});

function provider(over: Partial<AIProvider>): AIProvider {
  return { mode: "live", model: "test", extract: async () => ({}), analyze: async () => output(), ...over };
}

describe("screenshot extraction", () => {
  it("extracts each image in order and merges overlaps", async () => {
    const pages = [
      page([{ sender: "fan", text: "one" }, { sender: "creator", text: "two" }]),
      page([{ sender: "creator", text: "two" }, { sender: "fan", text: "three" }]),
    ];
    const extract = vi.fn(async (_s: string, _i: unknown, idx: number) => pages[idx]);
    const r = await runExtraction(provider({ extract }), [img, img]);
    expect(extract).toHaveBeenCalledTimes(2);
    expect(r.messages.map((m) => m.text)).toEqual(["one", "two", "three"]);
    expect(r.messages.map((m) => m.sourceImage)).toEqual([0, 0, 1]);
  });

  it("retries once on invalid output, then succeeds", async () => {
    const extract = vi.fn().mockResolvedValueOnce({ garbage: true }).mockResolvedValueOnce(page([{ sender: "fan", text: "hi" }]));
    const r = await runExtraction(provider({ extract }), [img]);
    expect(extract).toHaveBeenCalledTimes(2);
    expect(r.messages).toHaveLength(1);
  });

  it("fails cleanly instead of fabricating when output stays invalid", async () => {
    const extract = vi.fn().mockResolvedValue({ messages: "nope" });
    await expect(runExtraction(provider({ extract }), [img])).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("refuses to process conversations that may involve a minor", async () => {
    const extract = vi.fn().mockResolvedValue(page([{ sender: "fan", text: "hi" }], { possible_minor: true }));
    await expect(runExtraction(provider({ extract }), [img])).rejects.toMatchObject({ code: "provider_refused", retryable: false });
  });

  it("reports images that aren't conversations", async () => {
    const extract = vi.fn().mockResolvedValue(page([], { not_a_conversation: true }));
    await expect(runExtraction(provider({ extract }), [img])).rejects.toThrow(/No conversation/);
  });

  it("produces a labelled sample transcript in demo mode", async () => {
    const r = await runExtraction(new MockProvider(), [img, img]);
    expect(r.mode).toBe("mock");
    expect(r.notes).toMatch(/Demo mode/);
    expect(r.messages.length).toBeGreaterThan(3);
  });
});

describe("reply generation", () => {
  const base = { tone: "balanced" as const, voice: voice(), creatorId: CREATOR };

  it("returns a validated best reply plus playful and warm alternatives", async () => {
    const r = await runAnalysis(new MockProvider(), { ...base, messages: transcript(["fan", "hey!"]), fan: null, offers: [] });
    expect(r.best_reply.length).toBeGreaterThan(0);
    expect(r.alternatives.map((a) => a.tone).sort()).toEqual(["playful", "warm"]);
    expect(r.mode).toBe("mock");
    expect(r.reasoning).toMatch(/Demo mode/);
  });

  it("recommends an eligible offer when the fan shows interest", async () => {
    const o = offer({ title: "Beach Set", priceCents: 2500 });
    const r = await runAnalysis(new MockProvider(), {
      ...base,
      messages: transcript(["fan", "do you have more like the beach set?"]),
      fan: fan(),
      offers: [o],
    });
    expect(r.recommended_action).toBe("present_offer");
    expect(r.recommended_offer_id).toBe(o.id);
    expect(r.offer).toMatchObject({ id: o.id, price_cents: 2500 });
    expect(r.warnings).toEqual([]);
  });

  it("recommends no pitch when no offer is eligible", async () => {
    const r = await runAnalysis(new MockProvider(), {
      ...base,
      messages: transcript(["fan", "do you have more pics?"]),
      fan: fan(),
      offers: [offer({ isActive: false }), offer({ creatorId: "someone-else" })],
    });
    expect(r.recommended_offer_id).toBeNull();
    expect(r.recommended_action).not.toBe("present_offer");
    expect(r.offer).toBeNull();
  });

  it("recommends no sale after the fan declines", async () => {
    const r = await runAnalysis(new MockProvider(), {
      ...base,
      messages: transcript(["creator", "want to see it?"], ["fan", "no thanks, too expensive for me"]),
      fan: fan(),
      offers: [offer()],
    });
    expect(r.recommended_action).toBe("no_sale");
    expect(r.recommended_offer_id).toBeNull();
  });

  it("escalates instead of selling when a minor may be involved", async () => {
    const r = await runAnalysis(new MockProvider(), {
      ...base,
      messages: transcript(["fan", "i'm 16 lol is that ok"]),
      fan: null,
      offers: [offer()],
    });
    expect(r.recommended_action).toBe("escalate_to_human");
    expect(r.recommended_offer_id).toBeNull();
  });

  it("uses the selected creator voice", async () => {
    const r = await runAnalysis(new MockProvider(), {
      ...base,
      voice: voice({ emojiFrequency: "none", vocabulary: "formal" }),
      messages: transcript(["fan", "Hello"]),
      fan: null,
      offers: [],
    });
    expect(r.best_reply).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("shows a retryable error rather than inventing analysis when the provider fails", async () => {
    const analyze = vi.fn().mockResolvedValue({ nonsense: 1 });
    await expect(
      runAnalysis(provider({ analyze }), { ...base, messages: transcript(["fan", "hi"]), fan: null, offers: [] }),
    ).rejects.toMatchObject({ code: "invalid_output" });
    expect(analyze).toHaveBeenCalledTimes(2);
  });

  it("rejects an empty transcript", async () => {
    await expect(
      runAnalysis(new MockProvider(), { ...base, messages: transcript(["fan", "   "]), fan: null, offers: [] }),
    ).rejects.toThrow(/empty/);
  });

  it("passes only eligible offers to the model", async () => {
    const eligible = offer({ title: "Eligible" });
    const hidden = offer({ title: "Archived", isActive: false });
    const analyze = vi.fn(async (_call: { user: string }) => output());
    await runAnalysis(provider({ analyze }), { ...base, messages: transcript(["fan", "hi"]), fan: null, offers: [eligible, hidden] });
    const call = analyze.mock.calls[0][0];
    expect(call.user).toContain("Eligible");
    expect(call.user).not.toContain("Archived");
  });
});
