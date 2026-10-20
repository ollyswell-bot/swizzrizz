import type { Sender, TranscriptMessage } from "@/lib/domain/schemas";

type PageMessage = Omit<TranscriptMessage, "id" | "edited" | "sourceImage">;

function normalise(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function same(a: PageMessage, b: PageMessage) {
  return a.sender === b.sender && normalise(a.text) === normalise(b.text);
}

/**
 * Joins per-screenshot transcripts in upload order. When consecutive screenshots
 * overlap (the bottom of one repeats at the top of the next), the repeated run is
 * kept once. Only an exact run at the boundary is removed, so two genuinely
 * identical messages elsewhere in the thread are both kept.
 */
export function mergePages(pages: PageMessage[][]): TranscriptMessage[] {
  const out: TranscriptMessage[] = [];
  pages.forEach((page, pageIndex) => {
    let skip = 0;
    if (out.length > 0) {
      const maxOverlap = Math.min(out.length, page.length);
      for (let k = maxOverlap; k > 0; k--) {
        const tail = out.slice(out.length - k);
        if (tail.every((m, i) => same(m, page[i]))) {
          skip = k;
          break;
        }
      }
    }
    page.slice(skip).forEach((m) => {
      out.push({ ...m, id: `m${out.length + 1}`, edited: false, sourceImage: pageIndex });
    });
  });
  return out;
}

/* Operator edits. Pure, so the editor and tests share them. */

export function updateText(list: TranscriptMessage[], id: string, text: string): TranscriptMessage[] {
  return list.map((m) => (m.id === id ? { ...m, text, edited: true, uncertain: false } : m));
}

export function assignSender(list: TranscriptMessage[], id: string, sender: Sender): TranscriptMessage[] {
  return list.map((m) => (m.id === id ? { ...m, sender, edited: true } : m));
}

export function moveMessage(list: TranscriptMessage[], id: string, direction: -1 | 1): TranscriptMessage[] {
  const i = list.findIndex((m) => m.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function removeMessage(list: TranscriptMessage[], id: string): TranscriptMessage[] {
  return list.filter((m) => m.id !== id);
}

export function insertMessageAfter(list: TranscriptMessage[], afterId: string | null, sender: Sender): TranscriptMessage[] {
  const id = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const msg: TranscriptMessage = { id, sender, text: "", timestamp: null, uncertain: false, edited: true, sourceImage: 0 };
  if (afterId === null) return [...list, msg];
  const i = list.findIndex((m) => m.id === afterId);
  if (i < 0) return [...list, msg];
  return [...list.slice(0, i + 1), msg, ...list.slice(i + 1)];
}

/** Messages ready to analyse: non-empty, with uncertain ones still counted so the UI can warn. */
export function readiness(list: TranscriptMessage[]) {
  const usable = list.filter((m) => m.text.trim().length > 0);
  return {
    usable: usable.length,
    uncertain: usable.filter((m) => m.uncertain).length,
    unknownSender: usable.filter((m) => m.sender === "unknown").length,
    lastIsFan: usable.at(-1)?.sender === "fan",
  };
}
