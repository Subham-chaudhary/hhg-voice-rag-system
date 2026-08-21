"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PipelineMode } from "@/lib/client";

export function TopBar({
  mode,
  onModeChange,
  backendReachable,
}: {
  mode?: PipelineMode;
  onModeChange?: (mode: PipelineMode) => void;
  backendReachable?: boolean | null;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-[color-mix(in_oklab,var(--plane)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3.5 sm:px-8">
        <Link href="/" className="group flex items-baseline gap-2.5">
          <span className="display text-lg tracking-[-0.02em] text-ink">ZENITH</span>
          <span className="hidden text-[10px] uppercase tracking-[0.18em] text-ink-muted sm:inline">
            The Higher Celestials
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

        {mode && onModeChange && (
          <div className="flex items-center gap-2 border-l border-hairline pl-3">
            <div className="flex rounded-lg bg-surface-2 p-0.5">
              {(["mock", "live"] as PipelineMode[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onModeChange(option)}
                  className="rounded-[6px] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] transition-colors"
                  style={{
                    background: mode === option ? "var(--surface-3)" : "transparent",
                    color: mode === option ? "var(--ink)" : "var(--ink-muted)",
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
            <span
              aria-label={backendReachable ? "backend configured" : "backend not configured"}
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  backendReachable === null
                    ? "var(--ink-muted)"
                    : backendReachable
                      ? "var(--status-good)"
                      : "var(--coral)",
              }}
            />
          </div>
        )}
      </div>
    </header>
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
