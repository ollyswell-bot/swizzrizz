import { describe, it, expect } from "vitest";
import { mergePages, updateText, assignSender, moveMessage, removeMessage, insertMessageAfter, readiness } from "@/lib/transcript";

const msg = (sender: "fan" | "creator", text: string) => ({ sender, text, timestamp: null, uncertain: false });

describe("multi-image ordering", () => {
  it("keeps upload order across screenshots and tags the source image", () => {
    const out = mergePages([[msg("fan", "a"), msg("creator", "b")], [msg("fan", "c")], [msg("creator", "d")]]);
    expect(out.map((m) => m.text)).toEqual(["a", "b", "c", "d"]);
    expect(out.map((m) => m.sourceImage)).toEqual([0, 0, 1, 2]);
    expect(out.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it("removes messages repeated where consecutive screenshots overlap", () => {
    const out = mergePages([
      [msg("fan", "hi"), msg("creator", "hey you"), msg("fan", "what's up")],
      [msg("creator", "Hey  you"), msg("fan", "what's up"), msg("creator", "not much")],
    ]);
    expect(out.map((m) => m.text)).toEqual(["hi", "hey you", "what's up", "not much"]);
  });

  it("keeps genuinely repeated messages that aren't a boundary overlap", () => {
    const out = mergePages([[msg("fan", "lol"), msg("creator", "haha")], [msg("fan", "ok"), msg("fan", "lol")]]);
    expect(out.map((m) => m.text)).toEqual(["lol", "haha", "ok", "lol"]);
  });
});

describe("transcript correction", () => {
  const base = mergePages([[msg("fan", "helo"), msg("creator", "hi"), msg("fan", "more pls")]]);

  it("edits text, marks it edited and clears uncertainty", () => {
    const uncertain = base.map((m) => (m.id === "m1" ? { ...m, uncertain: true } : m));
    const out = updateText(uncertain, "m1", "hello");
    expect(out[0]).toMatchObject({ text: "hello", edited: true, uncertain: false });
    expect(base[0].text).toBe("helo");
  });

  it("reassigns the sender", () => {
    expect(assignSender(base, "m2", "fan")[1].sender).toBe("fan");
  });

  it("reorders, removes and inserts messages", () => {
    expect(moveMessage(base, "m3", -1).map((m) => m.id)).toEqual(["m1", "m3", "m2"]);
    expect(moveMessage(base, "m1", -1)).toBe(base);
    expect(removeMessage(base, "m2").map((m) => m.id)).toEqual(["m1", "m3"]);
    const inserted = insertMessageAfter(base, "m1", "creator");
    expect(inserted).toHaveLength(4);
    expect(inserted[1]).toMatchObject({ sender: "creator", text: "" });
  });

  it("reports readiness for analysis", () => {
    const r = readiness(assignSender(base, "m2", "unknown"));
    expect(r).toEqual({ usable: 3, uncertain: 0, unknownSender: 1, lastIsFan: true });
  });
});
