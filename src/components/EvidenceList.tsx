"use client";

import { languageName } from "@/lib/rag-types";
import type { Evidence } from "@/lib/rag-types";

const STRATEGY_LABEL: Record<string, string> = {
  atomic: "Atomic passage",
  window: "Sentence window",
  enriched: "Query-enriched",
  query: "Query index",
};

function strategyLabel(strategy: string): string {
  return STRATEGY_LABEL[strategy] ?? strategy;
}

export function EvidenceList({ evidence, muted = false }: { evidence: Evidence[]; muted?: boolean }) {
  if (!evidence.length) {
    return (
      <section className="rounded-xl border border-hairline bg-surface-1 p-6">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">Evidence</p>
        <p className="mt-3 text-sm text-ink-secondary">Nothing was retrieved for this query.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-hairline bg-surface-1">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4 sm:px-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">
            {muted ? "Retrieved, but insufficient" : "Retrieved evidence"}
          </p>
          <p className="mt-1 text-xs text-ink-secondary">
            {evidence.length} chunk{evidence.length === 1 ? "" : "s"} — which strategy retrieved each one is
            shown alongside it
          </p>
        </div>
      </header>

      <ul className="divide-y divide-[var(--line-hairline)]">
        {evidence.map((item, index) => (
          <li key={item.id} className="px-5 py-4 sm:px-6" style={{ opacity: muted ? 0.72 : 1 }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-[11px] text-ink-muted">#{index + 1}</span>
              <span className="rounded-[3px] bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-secondary">
                {strategyLabel(item.strategy)}
              </span>
              <span className="rounded-[3px] bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-secondary">
                {languageName(item.lang)}
              </span>
              <span className="ml-auto num text-xs text-ink">{item.score.toFixed(3)}</span>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-secondary">{item.text}</p>
            {(item.qid || item.parent_id) && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-ink-muted">
                {item.qid && <span className="num">qid {item.qid}</span>}
                {item.parent_id && <span className="num">parent {item.parent_id}</span>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
