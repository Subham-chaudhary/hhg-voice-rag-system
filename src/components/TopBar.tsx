"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ResponseSource } from "@/lib/contract";

export interface ConnectionState {
  configured: boolean | null;
  lastSource: ResponseSource | null;
  reason: string | null;
}

export function TopBar({ connection }: { connection?: ConnectionState }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-[color-mix(in_oklab,var(--plane)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3 sm:gap-x-4 sm:px-8 sm:py-3.5">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <span className="display shrink-0 text-[22px] leading-none tracking-[-0.03em] text-ink">
            ZENITH
          </span>
          <span
            aria-hidden
            className="hidden h-5 w-px shrink-0 sm:block"
            style={{ background: "var(--line-strong)" }}
          />
          <span className="hidden truncate text-[11px] tracking-[0.02em] text-ink-muted sm:inline">
            voice RAG console
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          <NavLink href="/" active={pathname === "/"}>
            Console
          </NavLink>
          <NavLink href="/benchmark" active={pathname === "/benchmark"}>
            Benchmark
          </NavLink>
        </nav>

        {connection && <ConnectionPill connection={connection} />}
      </div>
    </header>
  );
}

function ConnectionPill({ connection }: { connection: ConnectionState }) {
  const simulated = connection.lastSource === "simulated";
  const live = connection.lastSource === "live";

  const label = live ? "Live" : simulated ? "Simulated" : connection.configured ? "Backend set" : "No backend";
  const color = live
    ? "var(--status-good)"
    : simulated
      ? "var(--coral)"
      : connection.configured
        ? "var(--ink-secondary)"
        : "var(--ink-muted)";
  const background = live
    ? "rgba(12,163,12,0.12)"
    : simulated
      ? "var(--coral-wash)"
      : "var(--surface-2)";

  return (
    <span
      title={connection.reason ?? undefined}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] sm:border-l-0"
      style={{ color, background }}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${live ? "breathe" : ""}`}
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg px-2.5 py-1.5 text-xs transition-colors"
      style={{
        color: active ? "var(--ink)" : "var(--ink-muted)",
        background: active ? "var(--surface-2)" : "transparent",
      }}
    >
      {children}
    </Link>
  );
}
