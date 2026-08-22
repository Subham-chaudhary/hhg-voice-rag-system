"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ConnectionState {
  lastSource: "live" | "degraded" | "down" | null;
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
          <a
            href="https://github.com/Subham-chaudhary/hhg-voice-rag-system"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="flex items-center rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
          </a>
        </nav>

        {connection && <ConnectionPill connection={connection} />}
      </div>
    </header>
  );
}

function ConnectionPill({ connection }: { connection: ConnectionState }) {
  const live = connection.lastSource === "live";
  const degraded = connection.lastSource === "degraded";
  const down = connection.lastSource === "down";

  const label = live ? "Live" : degraded ? "Degraded" : down ? "Down" : "No calls yet";
  const color = live
    ? "var(--status-good)"
    : degraded
      ? "var(--coral)"
      : down
        ? "var(--status-critical)"
        : "var(--ink-muted)";
  const background = live
    ? "rgba(12,163,12,0.12)"
    : degraded
      ? "var(--coral-wash)"
      : down
        ? "rgba(208,59,59,0.14)"
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
