"use client";

import { useMemo, useState } from "react";
import { Evidence, REPRESENTATION_LABEL } from "@/lib/contract";
import { LANGUAGE_NAME } from "@/lib/adapter";

function normalise(values: (number | undefined)[]): (value: number | undefined) => number {
  const present = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const max = Math.max(...present, 0);
  const min = Math.min(...present, 0);
  const span = max - min || 1;
  return (value) => (typeof value === "number" ? Math.max(0.04, (value - min) / span) : 0);
}

export function EvidencePanel({ evidence }: { evidence: Evidence[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showParent, setShowParent] = useState<string | null>(null);

  const denseScale = useMemo(() => normalise(evidence.map((e) => e.denseScore)), [evidence]);
  const sparseScale = useMemo(() => normalise(evidence.map((e) => e.sparseScore)), [evidence]);

  if (!evidence.length) {
    return (
      <section className="rounded-xl border border-hairline bg-surface-1 p-6">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">Evidence</p>
        <p className="mt-3 text-sm text-ink-secondary">
          Nothing was retrieved for this query. The pipeline stopped before the index.
        </p>
      </section>
    );
  }

  const citedCount = evidence.filter((item) => item.cited).length;

  return (
    <section className="rounded-xl border border-hairline bg-surface-1">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4 sm:px-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">Retrieved evidence</p>
          <p className="mt-1 text-xs text-ink-secondary">
            {evidence.length} chunk{evidence.length === 1 ? "" : "s"} returned
            {citedCount > 0 && ` · ${citedCount} cited by the answer`}
          </p>
        </div>
      </header>

      <ul className="divide-y divide-[var(--line-hairline)]">
        {evidence.map((item) => {
          const isOpen = expanded === item.id;
          const parentOpen = showParent === item.id;

          return (
            <li key={item.id} className="px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                {item.cited && (
                  <span
                    className="inline-flex items-center gap-1 rounded-[3px] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]"
                    style={{ background: "var(--amber-wash)", color: "var(--amber-bright)" }}
                  >
                    <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden fill="none">
                      <path d="M2.5 6.4l2.4 2.4L9.6 3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Cited
                  </span>
                )}
                <span className="num text-[11px] text-ink-muted">{item.id}</span>
                <span className="rounded-[3px] bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-secondary">
                  {REPRESENTATION_LABEL[item.representation]}
                </span>
                {item.language && (
                  <span className="rounded-[3px] bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-secondary">
                    {LANGUAGE_NAME[item.language] ?? item.language}
                  </span>
                )}
                <span className="ml-auto num text-xs text-ink">{item.score.toFixed(3)}</span>
              </div>

              <p className="mt-2.5 text-sm leading-relaxed text-ink-secondary">{item.text}</p>

              {parentOpen && item.parentText && (
                <p className="rise mt-2.5 rounded-lg border-l-2 border-[var(--stage-4)] bg-surface-2 px-3.5 py-3 text-[13px] leading-relaxed text-ink-muted">
                  {item.parentText}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                  className="text-[11px] uppercase tracking-[0.1em] text-ink-muted transition-colors hover:text-amber"
                >
                  {isOpen ? "Hide retrieval detail" : "Retrieval detail"}
                </button>

                {item.parentText && (
                  <button
                    type="button"
                    onClick={() => setShowParent(parentOpen ? null : item.id)}
                    className="text-[11px] uppercase tracking-[0.1em] text-ink-muted transition-colors hover:text-amber"
                  >
                    {parentOpen ? "Hide parent chunk" : "Parent chunk"}
                  </button>
                )}
              </div>

              {isOpen && (
                <dl className="rise mt-3 grid gap-3 rounded-lg bg-surface-2 p-4 sm:grid-cols-2">
                  <ScoreBar
                    label="Dense (e5 cosine)"
                    value={item.denseScore}
                    width={denseScale(item.denseScore)}
                    color="var(--stage-3)"
                    digits={3}
                  />
                  <ScoreBar
                    label="Sparse (BM25)"
                    value={item.sparseScore}
                    width={sparseScale(item.sparseScore)}
                    color="var(--stage-6)"
                    digits={2}
                  />
                  <Meta label="RRF fused" value={item.rrfScore?.toFixed(4)} />
                  <Meta label="Rank" value={item.rank ? `#${item.rank}` : undefined} />
                  <Meta label="Query id" value={item.queryId ? String(item.queryId) : undefined} />
                  <Meta label="Passage rank" value={item.passageRank ? String(item.passageRank) : undefined} />
                  <Meta label="Parent id" value={item.parentId ?? undefined} />
                  <p className="text-[10px] leading-relaxed text-ink-muted sm:col-span-2">
                    Dense and sparse bars are normalised within this result set — the two scores are on
                    different scales and are never compared directly.
                  </p>
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ScoreBar({
  label,
  value,
  width,
  color,
  digits,
}: {
  label: string;
  value: number | undefined;
  width: number;
  color: string;
  digits: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-ink-muted">{label}</span>
        <span className="num text-[11px] text-ink">{value !== undefined ? value.toFixed(digits) : "—"}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full rounded-[2px] bg-surface-3">
        <div
          className="h-full rounded-[2px]"
          style={{ width: `${Math.min(100, width * 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className="num text-[11px] text-ink-secondary">{value}</dd>
    </div>
  );
}
