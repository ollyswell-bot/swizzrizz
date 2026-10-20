"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/misc";
import type { WorkspaceProps } from "./copilot-workspace";

// Client-only: the workspace restores unsaved edits from sessionStorage on first render.
const Workspace = dynamic(() => import("./copilot-workspace").then((m) => m.CopilotWorkspace), {
  ssr: false,
  loading: () => (
    <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)_360px]" aria-busy="true" aria-label="Loading copilot">
      <Skeleton className="h-[520px] rounded-xl" />
      <Skeleton className="h-[520px] rounded-xl" />
      <Skeleton className="h-[520px] rounded-xl" />
    </div>
  ),
});

export function CopilotLoader(props: WorkspaceProps) {
  return <Workspace {...props} />;
}
