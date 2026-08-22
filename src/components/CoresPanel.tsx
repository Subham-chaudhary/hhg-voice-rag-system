"use client";

import { CORE_LABEL, CoreInfo, STAGE_DETAIL } from "@/lib/contract";
import { ms } from "@/lib/format";

const STATUS_STYLE: Record<CoreInfo["status"], { label: string; color: string; background: string }> = {
  active: { label: "active", color: "var(--status-good)", background: "rgba(12,163,12,0.12)" },
  fallback: { label: "fallback", color: "var(--coral)", background: "var(--coral-wash)" },
  disabled: { label: "not run", color: "var(--ink-muted)", background: "var(--surface-2)" },
};

export function CoresPanel({ cores }: { cores: CoreInfo[] }) {
  if (!cores.length) return null;

  return (
    <section className="rounded-xl border border-hairline bg-surface-1">
      <header className="border-b border-hairline px-5 py-4 sm:px-6">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">Cores</p>
        <p className="mt-1 text-xs text-ink-secondary">
          The plugin that served each stage of this request
        </p>
      </header>

      <ul className="divide-y divide-[var(--line-hairline)]">
        {cores.map((core) => {
          const status = STATUS_STYLE[core.status];
          return (
            <li key={core.key} className="min-w-0 px-5 py-3 sm:px-6" title={STAGE_DETAIL[core.key]}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[11px] uppercase tracking-[0.1em] text-ink-muted">
                  {CORE_LABEL[core.key]}
                </span>
                <span
                  className="shrink-0 rounded-[3px] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em]"
                  style={{ color: status.color, background: status.background }}
                >
                  {status.label}
                </span>
              </div>

              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className="num min-w-0 flex-1 break-all text-[13px] leading-snug"
                  style={{ color: core.status === "disabled" ? "var(--ink-muted)" : "var(--ink)" }}
                >
                  {core.id}
                  {core.version && <span className="text-ink-muted"> v{core.version}</span>}
                </span>
                <span className="num shrink-0 text-[11px] text-ink-secondary">
                  {core.status === "disabled" ? "—" : ms(core.latencyMs, 1)}
                </span>
              </div>

              {core.model && core.model !== core.id && (
                <p className="num mt-0.5 truncate text-[10px] text-ink-muted">{core.model}</p>
              )}
            </li>
          );
        })}
      </ul>

      <p className="border-t border-hairline px-5 py-3 text-[11px] leading-relaxed text-ink-muted sm:px-6">
        Each stage is a swappable core declared by the backend in the response. Changing a provider —
        Sarvam to ElevenLabs, Groq to a local model — changes the id here and nothing else.
      </p>
    </section>
  );
}
