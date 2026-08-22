"use client";

const COPY: Record<string, { title: string; body: string }> = {
  sparse_only: {
    title: "Running without the embedding provider",
    body: "Jina was unreachable, so this answer comes from sparse (BM25) retrieval alone — no dense vectors. Results are still real, just narrower.",
  },
  tier1_only: {
    title: "Wide retrieval degraded",
    body: "The full cascade failed; this fell back to the cheap query-index fast path only.",
  },
  budget_exhausted: {
    title: "Skipped rerank — out of time budget",
    body: "The request was close to its deadline, so reranking was skipped and results are in pre-rerank order.",
  },
};

/** Persistent banner for a dependency-level degrade — sparse_only / tier1_only / budget_exhausted. */
export function DegradedBanner({ reason }: { reason: string }) {
  const copy = COPY[reason] ?? { title: "Running in a degraded mode", body: `Reason: ${reason}` };
  return (
    <div
      className="rise mb-4 flex flex-wrap items-start gap-x-2.5 gap-y-1 rounded-lg px-3.5 py-2.5"
      style={{ background: "var(--coral-wash)", border: "1px solid rgba(251,113,133,0.32)" }}
    >
      <span
        className="rounded-[3px] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
        style={{ background: "var(--coral)", color: "#20060c" }}
      >
        Degraded
      </span>
      <span className="text-[11px] leading-relaxed text-ink-secondary">
        <strong className="text-ink">{copy.title}.</strong> {copy.body}
      </span>
    </div>
  );
}

/** Inline note for rerank_failed — ordering fell back to pre-rerank, not a dependency-wide outage. */
export function RerankFailedNote() {
  return (
    <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
      Rerank failed or timed out — evidence below is in pre-rerank order.
    </p>
  );
}
