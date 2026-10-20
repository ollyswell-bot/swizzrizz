import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span aria-hidden className="grid size-7 place-items-center rounded-lg border border-border-strong bg-surface-2">
        <span className="size-2 rounded-full bg-accent" />
      </span>
      <span className="font-display text-[22px] leading-none tracking-tight text-fg">
        Swizz<span className="italic text-accent">Rizz</span>
      </span>
    </div>
  );
}
