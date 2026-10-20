"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useTheme } from "next-themes";
import {
  BarChart3,
  BookUser,
  LayoutGrid,
  LogOut,
  Menu,
  MessagesSquare,
  Mic2,
  Moon,
  Settings,
  Sparkles,
  Sun,
  Tags,
  X,
} from "lucide-react";
import { BrandMark } from "./brand";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/copilot", label: "Live Copilot", icon: Sparkles },
  { href: "/conversations", label: "Conversations", icon: MessagesSquare },
  { href: "/fans", label: "Fans", icon: BookUser },
  { href: "/catalog", label: "PPV Catalog", icon: Tags },
  { href: "/voices", label: "Creator Voices", icon: Mic2 },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface Props {
  children: React.ReactNode;
  dataMode: "demo" | "supabase";
  aiMode: "live" | "mock";
  role: string;
  email: string | null;
}

export function AppShell({ children, dataMode, aiMode, role, email }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    try {
      sessionStorage.clear();
    } catch {}
    router.replace("/login");
    router.refresh();
  }

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors",
              active ? "bg-surface-3 text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon className={cn("size-4", active ? "text-accent" : "text-fg-subtle group-hover:text-fg-muted")} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap gap-1.5">
        {dataMode === "demo" ? <Badge tone="warning">Demo data</Badge> : <Badge tone="success">Live data</Badge>}
        {aiMode === "mock" ? <Badge tone="warning">Demo AI</Badge> : <Badge tone="accent">AI connected</Badge>}
      </div>
      <p className="truncate text-xs text-fg-subtle">
        {email ?? "Demo operator"} · <span className="capitalize">{role}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex size-8 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg"
          aria-label="Toggle light and dark theme"
        >
          {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <button
          type="button"
          onClick={signOut}
          className="flex h-8 items-center gap-2 rounded-lg px-2 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          <LogOut className="size-4" aria-hidden /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface-3 focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-8 border-r border-border bg-surface px-3 py-5 lg:flex">
        <BrandMark className="px-3" />
        <div className="flex-1">{nav}</div>
        <div className="px-1">{footer}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/90 px-4 py-3 backdrop-blur lg:hidden">
          <BrandMark />
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-lg border border-border text-fg-muted"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
          >
            <Menu className="size-4" />
          </button>
        </header>
        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 flex-col gap-8 border-r border-border bg-surface px-3 py-5">
              <div className="flex items-center justify-between px-3">
                <BrandMark />
                <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="text-fg-muted">
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex-1">{nav}</div>
              <div className="px-1">{footer}</div>
            </div>
          </div>
        ) : null}
        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
