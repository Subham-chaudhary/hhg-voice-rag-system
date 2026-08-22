"use client";

import { useSyncExternalStore } from "react";
import { Histogram } from "./Histogram";
import { ms, percent } from "@/lib/format";
import { getServerSnapshot, getSnapshot, segmentLatency, subscribe } from "@/lib/rag-store";

const RAG_CORE_TARGET_MS = 200;

export function SessionLatencyPanel() {
  const records = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!records.length) return null;

  const seg = segmentLatency(records);
  const blendedSamples = records.filter((r) => r.ragCore > 0).map((r) => r.ragCore);

  return (
    <section className="rounded-xl border border-hairline bg-surface-1">
      <header className="border-b border-hairline px-5 py-4 sm:px-6">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">Session latency</p>
        <p className="mt-1 text-xs text-ink-secondary">
          {records.length} quer{records.length === 1 ? "y" : "ies"} this session · rerank rate{" "}
          {percent(seg.rerankRate, 0)}
        </p>
      </header>

      <div className="px-5 py-4 sm:px-6">
        <Histogram samples={blendedSamples} markers={[]} budget={RAG_CORE_TARGET_MS} height={140} />
      </div>

      <div className="grid grid-cols-1 divide-y divide-[var(--line-hairline)] border-t border-hairline sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Row label="Fast path (no rerank)" stats={seg.fast} />
        <Row label="Rerank path" stats={seg.rerank} />
        <Row label="Blended" stats={seg.blended} emphasis />
      </div>
    </section>
  );
}

function Row({
  label,
  stats,
  emphasis = false,
}: {
  label: string;
  stats: { p50: number; p70: number; p100: number; n: number };
  emphasis?: boolean;
}) {
  return (
    <div className="px-5 py-3.5 sm:px-6">
      <p className="text-[11px] uppercase tracking-[0.12em] text-ink-muted">
        {label} <span className="num">n={stats.n}</span>
      </p>
      {stats.n === 0 ? (
        <p className="mt-1.5 text-xs text-ink-muted">—</p>
      ) : (
        <dl className="mt-1.5 grid grid-cols-3 gap-2">
          <Stat label="P50" value={ms(stats.p50, 0)} emphasis={emphasis} />
          <Stat label="P70" value={ms(stats.p70, 0)} emphasis={emphasis} />
          <Stat label="P100 (max)" value={ms(stats.p100, 0)} emphasis={emphasis} />
        </dl>
      )}
    </div>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis: boolean }) {
  return (
    <div>
      <dt className="text-[10px] text-ink-muted">{label}</dt>
      <dd className={`num text-sm ${emphasis ? "text-ink" : "text-ink-secondary"}`}>{value}</dd>
    </div>
  );
}
