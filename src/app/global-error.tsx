"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#0b0b0d", color: "#ede8df", fontFamily: "system-ui", display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <p>SwizzRizz hit an unexpected error.</p>
          <button onClick={reset} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8 }}>Reload</button>
        </div>
      </body>
    </html>
  );
}
