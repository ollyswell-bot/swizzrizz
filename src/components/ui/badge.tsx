import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none tracking-wide", {
  variants: {
    tone: {
      neutral: "bg-surface-3 text-fg-muted",
      accent: "bg-accent-soft text-accent",
      warning: "bg-warning-soft text-warning",
      danger: "bg-danger-soft text-danger",
      success: "bg-success/10 text-success",
      outline: "border border-border-strong text-fg-muted",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
