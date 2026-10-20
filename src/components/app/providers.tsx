"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: "!bg-surface-2 !border !border-border-strong !text-fg !rounded-lg !shadow-card",
            description: "!text-fg-muted",
          },
        }}
      />
    </ThemeProvider>
  );
}
