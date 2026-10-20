/**
 * Copies text with the async Clipboard API, falling back to a hidden textarea and
 * execCommand for browsers or contexts where the API is blocked.
 * Returns "copied", "fallback" or "failed" so the UI can tell the operator.
 */
export async function copyText(text: string): Promise<"copied" | "fallback" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return "copied";
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    if (typeof document === "undefined") return "failed";
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);
    el.select();
    const ok = typeof document.execCommand === "function" && document.execCommand("copy");
    document.body.removeChild(el);
    return ok ? "fallback" : "failed";
  } catch {
    return "failed";
  }
}

/** SHA-256 of a file in the browser, used to warn about duplicate screenshots before upload. */
export async function hashFile(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
