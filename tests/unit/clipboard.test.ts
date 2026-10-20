// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { copyText } from "@/lib/clipboard";

afterEach(() => vi.restoreAllMocks());

describe("clipboard copying", () => {
  it("uses the Clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    expect(await copyText("hi there")).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("hi there");
  });

  it("falls back to execCommand when the Clipboard API is blocked", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }, configurable: true });
    document.execCommand = vi.fn().mockReturnValue(true);
    expect(await copyText("fallback text")).toBe("fallback");
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
  });

  it("reports failure so the UI can ask the operator to copy manually", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    document.execCommand = vi.fn().mockReturnValue(false);
    expect(await copyText("x")).toBe("failed");
  });
});
