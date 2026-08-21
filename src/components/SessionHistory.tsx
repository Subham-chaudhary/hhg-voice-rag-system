"use client";

import { RAG_CORE_BUDGET_MS } from "@/lib/contract";
import { clampText, ms, relativeTime, summarise } from "@/lib/format";

export interface HistoryEntry {
  id: string;
  transcript: string;
  status: "answered" | "refused" | "error";
  ragCore: number;
  voiceE2E?: number;
  language: string;
  viaVoice: boolean;
  at: number;
}

const STATUS_COLOR: Record<HistoryEntry["status"], string> = {
  answered: "var(--amber)",
  refused: "var(--coral)",
  error: "var(--status-critical)",
};

export function SessionHistory({
  entries,
  onReplay,
}: {
  entries: HistoryEntry[];
  onReplay: (entry: HistoryEntry) => void;
}) {
  if (!entries.length) return null;

  const measured = entries.filter((entry) => entry.ragCore > 0).map((entry) => entry.ragCore);
  const stats = measured.length ? summarise(measured) : null;
  const withinBudget = measured.filter((value) => value <= RAG_CORE_BUDGET_MS).length;

  return (
    <section className="rounded-xl border border-hairline bg-surface-1">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline px-5 py-4 sm:px-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">This session</p>
          <p className="mt-1 text-xs text-ink-secondary">
            {entries.length} quer{entries.length === 1 ? "y" : "ies"}
            {measured.length > 0 && ` · ${withinBudget}/${measured.length} within ${RAG_CORE_BUDGET_MS} ms`}
          </p>
        </div>
        {stats && (
          <div className="flex gap-4 text-right">
            <Stat label="p50" value={ms(stats.p50, 0)} />
            <Stat label="p70" value={ms(stats.p70, 0)} />
            <Stat label="max" value={ms(stats.p100, 0)} />
          </div>
        )}
      </header>

      <ul className="divide-y divide-[var(--line-hairline)]">
        {entries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onReplay(entry)}
              className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-surface-2 sm:px-6"
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: STATUS_COLOR[entry.status] }}
              />
              {entry.viaVoice && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-label="voice" className="shrink-0">
                  <rect x="9" y="3" width="6" height="11" rx="3" stroke="var(--ink-muted)" strokeWidth="2" />
                  <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" stroke="var(--ink-muted)" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-secondary">
                {clampText(entry.transcript, 72)}
              </span>
              <span className="shrink-0 text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                {relativeTime(entry.at)}
              </span>
              <span
                className="num w-16 shrink-0 text-right text-[11px]"
                style={{
                  color: entry.ragCore && entry.ragCore <= RAG_CORE_BUDGET_MS ? "var(--ink)" : "var(--coral)",
                }}
              >
                {entry.ragCore ? ms(entry.ragCore, 0) : "—"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">{label}</p>
      <p className="num text-sm text-ink">{value}</p>
    </div>
  );
}
