"use client";

import { useEffect, useState } from "react";
import { Histogram } from "@/components/Histogram";
import { TopBar } from "@/components/TopBar";
import { LANGUAGE_NAME } from "@/lib/adapter";
import {
  BenchmarkRun,
  RAG_CORE_BUDGET_MS,
  STAGE_COLOR,
  STAGE_LABEL,
  StageKey,
} from "@/lib/contract";
import { ms } from "@/lib/format";

export default function Benchmark() {
  const [run, setRun] = useState<BenchmarkRun | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/benchmark")
      .then((response) => response.json())
      .then(setRun)
      .catch(() => setFailed(true));
  }, []);

  return (
    <div className="grain min-h-full">
      <TopBar />
      <main className="relative z-10 mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
        <header className="max-w-2xl">
          <h1 className="display text-[30px] leading-[1.12] text-ink sm:text-[38px]">Latency analytics</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">
            P50, P70 and P100 for the RAG-core path — transcript received through verified answer — measured
            across the benchmark query set. P100 is the maximum observed latency in the sample, not P99.99.
          </p>
        </header>

        {failed && <Notice tone="critical">Could not load benchmark results.</Notice>}
        {!run && !failed && <Notice tone="muted">Loading results…</Notice>}

        {run && run.queryCount === 0 && (
          <Notice tone="critical">
            No benchmark run found. Drop the output of <code className="num">run_benchmark.py</code> into{" "}
            <code className="num">benchmarks/results/final.json</code> and this page fills in automatically.
          </Notice>
        )}

        {run && run.isPlaceholder && run.queryCount > 0 && (
          <Notice tone="critical">
            <strong>Synthetic sample data — not a measured run.</strong> These numbers exist only so the page
            can be reviewed. Replace with{" "}
            <code className="num">benchmarks/results/final.json</code> from the real harness before
            submitting anything.
          </Notice>
        )}

        {run && run.queryCount > 0 && (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-3">
              <HeroTile
                label="P50 RAG-core"
                value={run.ragCore.p50}
                emphasis
                withinBudget={run.ragCore.p50 <= RAG_CORE_BUDGET_MS}
              />
              <HeroTile label="P70 RAG-core" value={run.ragCore.p70} withinBudget={run.ragCore.p70 <= RAG_CORE_BUDGET_MS} />
              <HeroTile
                label="P100 RAG-core"
                value={run.ragCore.p100}
                withinBudget={run.ragCore.p100 <= RAG_CORE_BUDGET_MS}
              />
            </section>

            <section className="mt-4 rounded-xl border border-hairline bg-surface-1 p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">
                  RAG-core distribution
                </p>
                <p className="text-[11px] text-ink-muted">
                  {run.queryCount} queries · {run.warmups} warm-ups excluded · {run.repeats}× repeat
                </p>
              </div>
              <div className="mt-7">
                <Histogram
                  samples={run.samples}
                  markers={[
                    { label: "p50", value: run.ragCore.p50 },
                    { label: "p70", value: run.ragCore.p70 },
                    { label: "p100", value: run.ragCore.p100, emphasis: true },
                  ]}
                />
              </div>
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-hairline bg-surface-1 p-5 sm:p-6">
                <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">Percentile table</p>
                <div className="-mx-1 mt-4 overflow-x-auto px-1">
                <table className="w-full min-w-[26rem] text-sm">
                  <thead>
                    <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                      <th className="pb-2 font-normal">Path</th>
                      <th className="pb-2 text-right font-normal">P50</th>
                      <th className="pb-2 text-right font-normal">P70</th>
                      <th className="pb-2 text-right font-normal">P100</th>
                      <th className="pb-2 text-right font-normal">Mean</th>
                      <th className="pb-2 text-right font-normal">σ</th>
                    </tr>
                  </thead>
                  <tbody className="num">
                    <Row label="RAG-core" stats={run.ragCore} />
                    {run.voiceE2E && <Row label="Voice E2E" stats={run.voiceE2E} muted />}
                  </tbody>
                </table>
                </div>
                <p className="mt-4 text-[11px] leading-relaxed text-ink-muted">
                  Voice end-to-end includes networked speech-to-text and is reported separately by design.
                  The {RAG_CORE_BUDGET_MS} ms requirement is claimed against RAG-core only.
                </p>
              </div>

              <div className="rounded-xl border border-hairline bg-surface-1 p-5 sm:p-6">
                <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">
                  Median by RAG-core stage
                </p>
                {run.stageMedians.stt !== undefined && (
                  <p className="mt-3 flex items-baseline justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
                    <span className="text-xs text-ink-secondary">Speech-to-text (outside budget)</span>
                    <span className="num text-xs text-ink">{ms(run.stageMedians.stt)}</span>
                  </p>
                )}
                <ul className="mt-4 space-y-2.5">
                  {(Object.keys(run.stageMedians) as StageKey[])
                    .filter((stage) => stage !== "stt")
                    .map((stage) => {
                    const value = run.stageMedians[stage] ?? 0;
                    const peak = Math.max(
                      ...(Object.entries(run.stageMedians)
                        .filter(([key]) => key !== "stt")
                        .map(([, v]) => v ?? 0)),
                      1,
                    );
                    return (
                      <li key={stage}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-xs text-ink-secondary">{STAGE_LABEL[stage]}</span>
                          <span className="num text-xs text-ink">{ms(value)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full rounded-[2px] bg-surface-2">
                          <div
                            className="h-full rounded-[2px]"
                            style={{ width: `${(value / peak) * 100}%`, background: STAGE_COLOR[stage] }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>

            {run.byLanguage.length > 0 && (
              <section className="mt-4 rounded-xl border border-hairline bg-surface-1 p-5 sm:p-6">
                <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">By language</p>
                <div className="-mx-1 mt-4 overflow-x-auto px-1">
                <table className="w-full min-w-[24rem] text-sm">
                  <thead>
                    <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                      <th className="pb-2 font-normal">Language</th>
                      <th className="pb-2 text-right font-normal">Queries</th>
                      <th className="pb-2 text-right font-normal">P50</th>
                      <th className="pb-2 text-right font-normal">P100</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.byLanguage.map((entry) => (
                      <tr key={entry.language} className="border-b border-hairline last:border-0">
                        <td className="py-2 text-ink-secondary">
                          {LANGUAGE_NAME[entry.language] ?? entry.language}
                        </td>
                        <td className="num py-2 text-right text-ink-secondary">{entry.count}</td>
                        <td className="num py-2 text-right text-ink">{ms(entry.p50, 0)}</td>
                        <td className="num py-2 text-right text-ink">{ms(entry.p100, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </section>
            )}

            <section className="mt-4 rounded-xl border border-hairline bg-surface-1 px-5 py-4 sm:px-6">
              <dl className="grid gap-x-8 gap-y-2 text-[11px] sm:grid-cols-2 lg:grid-cols-4">
                <Meta label="Run" value={run.label} />
                <Meta label="Commit" value={run.commit ?? "not recorded"} />
                <Meta label="Measured" value={run.measuredAt ?? "not recorded"} />
                <Meta label="Timeouts / errors" value={`${run.timeouts} / ${run.errors}`} />
              </dl>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Row({
  label,
  stats,
  muted,
}: {
  label: string;
  stats: { p50: number; p70: number; p100: number; mean: number; stddev: number };
  muted?: boolean;
}) {
  return (
    <tr className="border-b border-hairline last:border-0">
      <td className={`py-2.5 ${muted ? "text-ink-muted" : "text-ink-secondary"}`}>{label}</td>
      <td className="py-2.5 text-right text-ink">{ms(stats.p50, 0)}</td>
      <td className="py-2.5 text-right text-ink">{ms(stats.p70, 0)}</td>
      <td className="py-2.5 text-right text-ink">{ms(stats.p100, 0)}</td>
      <td className="py-2.5 text-right text-ink-secondary">{ms(stats.mean, 0)}</td>
      <td className="py-2.5 text-right text-ink-muted">{stats.stddev.toFixed(1)}</td>
    </tr>
  );
}

function HeroTile({
  label,
  value,
  emphasis,
  withinBudget,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  withinBudget: boolean;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-1 p-5">
      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className={`display text-ink ${emphasis ? "text-[48px]" : "text-[34px]"} leading-none`}>
          {value.toFixed(1)}
        </span>
        <span className="text-sm text-ink-muted">ms</span>
      </p>
      <p
        className="mt-2 text-[11px] uppercase tracking-[0.08em]"
        style={{ color: withinBudget ? "var(--status-good)" : "var(--status-critical)" }}
      >
        {withinBudget ? "within budget" : "over budget"}
      </p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="num mt-0.5 truncate text-ink-secondary">{value}</dd>
    </div>
  );
}

function Notice({ tone, children }: { tone: "critical" | "muted"; children: React.ReactNode }) {
  return (
    <p
      className="mt-6 rounded-xl border px-5 py-4 text-sm leading-relaxed"
      style={
        tone === "critical"
          ? { borderColor: "rgba(208,59,59,0.35)", background: "rgba(208,59,59,0.08)", color: "var(--ink-secondary)" }
          : { borderColor: "var(--line-hairline)", background: "var(--surface-1)", color: "var(--ink-muted)" }
      }
    >
      {children}
    </p>
  );
}
