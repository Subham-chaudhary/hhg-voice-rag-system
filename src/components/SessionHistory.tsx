"use client";

import { RAG_CORE_BUDGET_MS } from "@/lib/contract";
import { clampText, ms, relativeTime, summarise } from "@/lib/format";
import { LatencyRecord, toBenchmarkJson } from "@/lib/store";

const STATUS_COLOR: Record<LatencyRecord["status"], string> = {
  answered: "var(--amber)",
  refused: "var(--coral)",
  error: "var(--status-critical)",
};

export function SessionHistory({
  records,
  persistent,
  onReplay,
  onClear,
}: {
  records: LatencyRecord[];
  persistent: boolean;
  onReplay: (record: LatencyRecord) => void;
  onClear: () => void;
}) {
  if (!records.length) return null;

  const measured = records.filter((record) => record.ragCore > 0).map((record) => record.ragCore);
  const stats = measured.length ? summarise(measured) : null;
  const withinBudget = measured.filter((value) => value <= RAG_CORE_BUDGET_MS).length;

  const download = () => {
    const blob = new Blob([JSON.stringify(toBenchmarkJson(records, "browser session log"), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "zenith-session-latency.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-xl border border-hairline bg-surface-1">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-hairline px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">Measured requests</p>
          <p className="mt-1 text-xs text-ink-secondary">
            {records.length} live quer{records.length === 1 ? "y" : "ies"}
            {measured.length > 0 && ` · ${withinBudget}/${measured.length} within ${RAG_CORE_BUDGET_MS} ms`}
          </p>
        </div>
        {stats && <Stat label="P100" value={ms(stats.p100, 0)} />}
      </header>

      <ul className="max-h-[19rem] divide-y divide-[var(--line-hairline)] overflow-y-auto">
        {records.map((record) => (
          <li key={record.id} className="min-w-0">
            <button
              type="button"
              onClick={() => onReplay(record)}
              className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-surface-2 sm:px-6"
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: STATUS_COLOR[record.status] }}
              />
              {record.viaVoice && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-label="voice" className="shrink-0">
                  <rect x="9" y="3" width="6" height="11" rx="3" stroke="var(--ink-muted)" strokeWidth="2" />
                  <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" stroke="var(--ink-muted)" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-secondary">
                {clampText(record.transcript, 72)}
              </span>
              <span className="hidden shrink-0 text-[10px] uppercase tracking-[0.08em] text-ink-muted sm:inline">
                {relativeTime(record.at)}
              </span>
              <span
                className="num w-16 shrink-0 text-right text-[11px]"
                style={{
                  color: record.ragCore && record.ragCore <= RAG_CORE_BUDGET_MS ? "var(--ink)" : "var(--coral)",
                }}
              >
                {record.ragCore ? ms(record.ragCore, 0) : "—"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline px-5 py-3 sm:px-6">
        <button
          type="button"
          onClick={download}
          className="text-[11px] uppercase tracking-[0.1em] text-ink-muted transition-colors hover:text-amber"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] uppercase tracking-[0.1em] text-ink-muted transition-colors hover:text-coral"
        >
          Clear
        </button>
        <span className="ml-auto text-[10px] text-ink-muted">
          {persistent ? "kept in this browser" : "not persisted — storage unavailable"}
        </span>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">{label}</p>
      <p className="num text-sm text-ink">{value}</p>
    </div>
  );
}
