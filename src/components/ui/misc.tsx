import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-surface-3 motion-reduce:animate-none", className)} {...props} />;
}

export function Progress({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2">
      <div className="relative h-1 overflow-hidden rounded-full bg-surface-3">
        <div className="progress-indeterminate absolute inset-y-0 w-2/5 rounded-full bg-accent" />
      </div>
      <p className="text-xs text-fg-muted">{label}</p>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong px-6 py-12 text-center">
      {icon ? <div className="text-fg-subtle [&_svg]:size-6">{icon}</div> : null}
      <p className="font-display text-xl text-fg">{title}</p>
      {children ? <div className="max-w-sm text-[13px] leading-relaxed text-fg-muted">{children}</div> : null}
      {action}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-medium uppercase tracking-[0.12em] text-fg-subtle", className)}>{children}</p>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[34px] leading-none tracking-tight text-fg">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Notice({ tone = "neutral", children, className }: { tone?: "neutral" | "warning" | "danger" | "accent"; children: React.ReactNode; className?: string }) {
  const tones = {
    neutral: "border-border bg-surface-2 text-fg-muted",
    warning: "border-warning/25 bg-warning-soft text-warning",
    danger: "border-danger/25 bg-danger-soft text-danger",
    accent: "border-accent/25 bg-accent-soft text-fg",
  };
  return <div role={tone === "danger" ? "alert" : undefined} className={cn("rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed", tones[tone], className)}>{children}</div>;
}
