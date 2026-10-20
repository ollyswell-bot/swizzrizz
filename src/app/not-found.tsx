import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-display text-4xl text-fg">Not found</p>
      <p className="text-sm text-fg-muted">This page doesn&apos;t exist, or it belongs to another workspace.</p>
      <Link href="/dashboard" className="text-sm text-accent hover:underline">Back to dashboard</Link>
    </main>
  );
}
