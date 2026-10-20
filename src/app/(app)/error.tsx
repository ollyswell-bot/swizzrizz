"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState title="Something went wrong" action={<Button onClick={reset}>Try again</Button>}>
      This page hit an error. Your unsaved copilot edits are kept in this tab.
    </EmptyState>
  );
}
