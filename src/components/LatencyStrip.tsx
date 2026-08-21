"use client";

import { useMemo, useState } from "react";
import {
  LatencyBreakdown,
  RAG_CORE_BUDGET_MS,
  RAG_CORE_STAGES,
  STAGE_COLOR,
  STAGE_DETAIL,
  STAGE_LABEL,
  StageKey,
} from "@/lib/contract";
import { ms } from "@/lib/format";

interface Segment {
  key: string;
  label: string;
  detail: string;
  color: string;
  value: number;
}

const OVERHEAD_COLOR = "var(--surface-3)";

function buildSegments(latency: LatencyBreakdown): Segment[] {
  const segments: Segment[] = [];
  let accounted = 0;

  for (const stage of RAG_CORE_STAGES) {
    const value = latency[stage as keyof LatencyBreakdown] as number | undefined;
    if (!value || value <= 0) continue;
    accounted += value;
    segments.push({
      key: stage,
      label: STAGE_LABEL[stage as StageKey],
      detail: STAGE_DETAIL[stage as StageKey],
      color: STAGE_COLOR[stage as StageKey],
      value,
    });
  }

  const remainder = latency.rag_core - accounted;
  if (remainder > 0.5) {
    segments.push({
      key: "overhead",
      label: "Transport",
      detail: "Serialisation, keep-alive and in-process overhead",
      color: OVERHEAD_COLOR,
      value: remainder,
    });
  }

  return segments;
}

export function LatencyStrip({
  latency,
  clientRoundTripMs,
}: {
  latency: LatencyBreakdown;
  clientRoundTripMs?: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const segments = useMemo(() => buildSegments(latency), [latency]);

  const core = latency.rag_core;
  const withinBudget = core <= RAG_CORE_BUDGET_MS;
  const domain = Math.max(RAG_CORE_BUDGET_MS * 1.12, core * 1.06);
  const budgetPosition = (RAG_CORE_BUDGET_MS / domain) * 100;

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">RAG-core latency</p>
          <p className="mt-1 text-xs text-ink-secondary">Transcript received → verified answer</p>
        </div>
        <StatusBadge withinBudget={withinBudget} />
      </header>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="display text-[52px] leading-none text-ink">{core.toFixed(1)}</span>
        <span className="text-lg text-ink-muted">ms</span>
        <span className="ml-2 text-xs text-ink-muted">of {RAG_CORE_BUDGET_MS} ms budget</span>
      </div>

      <div className="relative mt-6">
        <div className="relative h-6 w-full overflow-visible rounded-[4px]" role="img" aria-label={`RAG-core latency ${core.toFixed(1)} milliseconds`}>
          <div className="absolute inset-0 rounded-[4px] bg-surface-2" />
          <div className="absolute inset-y-0 left-0 flex" style={{ width: `${(core / domain) * 100}%` }}>
            {segments.map((segment, index) => (
              <div
                key={segment.key}
                onMouseEnter={() => setHovered(segment.key)}
                onMouseLeave={() => setHovered(null)}
                className="relative h-full transition-[filter] duration-150"
                style={{
                  flexGrow: segment.value,
                  flexBasis: 0,
                  background: segment.color,
                  marginRight: index === segments.length - 1 ? 0 : 2,
                  borderTopRightRadius: index === segments.length - 1 ? 4 : 0,
                  borderBottomRightRadius: index === segments.length - 1 ? 4 : 0,
                  filter: hovered && hovered !== segment.key ? "saturate(0.5) brightness(0.75)" : "none",
                }}
              />
            ))}
          </div>

          <div
            className="pointer-events-none absolute -top-1 bottom-[-4px] w-px bg-[var(--line-strong)]"
            style={{ left: `${budgetPosition}%` }}
          />
        </div>

        <div
          className="pointer-events-none absolute -bottom-5 whitespace-nowrap text-[10px] uppercase tracking-[0.12em] text-ink-muted"
          style={{
            left: `${budgetPosition}%`,
            transform: budgetPosition > 82 ? "translateX(-100%)" : "translateX(-50%)",
            paddingRight: budgetPosition > 82 ? 4 : 0,
          }}
        >
          {RAG_CORE_BUDGET_MS} ms budget
        </div>
      </div>

      <ul className="mt-9 grid gap-x-6 gap-y-1.5">
        {segments.map((segment) => (
          <li
            key={segment.key}
            onMouseEnter={() => setHovered(segment.key)}
            onMouseLeave={() => setHovered(null)}
            className="flex items-center gap-2.5 rounded-md px-1.5 py-1 transition-colors"
            style={{ background: hovered === segment.key ? "var(--surface-2)" : "transparent" }}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ background: segment.color }}
            />
            <span className="min-w-0 flex-1 truncate text-xs text-ink-secondary" title={segment.detail}>
              {segment.label}
            </span>
            <span className="num text-xs text-ink">{ms(segment.value)}</span>
          </li>
        ))}
      </ul>

      {(latency.stt !== undefined || latency.voice_e2e !== undefined) && (
        <VoicePath latency={latency} />
      )}

      {clientRoundTripMs !== undefined && (
        <p className="mt-4 border-t border-hairline pt-3 text-[11px] text-ink-muted">
          Browser round trip {ms(clientRoundTripMs)} — includes network to this app and is not part of the
          RAG-core claim.
        </p>
      )}
    </section>
  );
}

function VoicePath({ latency }: { latency: LatencyBreakdown }) {
  const total = latency.voice_e2e ?? (latency.stt ?? 0) + latency.rag_core;
  const sttShare = latency.stt ? (latency.stt / total) * 100 : 0;
  const coreShare = (latency.rag_core / total) * 100;

  return (
    <div className="mt-6 border-t border-hairline pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">Voice end-to-end</p>
          <p className="mt-1 text-xs text-ink-secondary">
            Reported separately — speech-to-text is a networked service outside the 200 ms budget
          </p>
        </div>
        <span className="num text-xl text-ink">{ms(total)}</span>
      </div>

      <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-[3px] bg-surface-2">
        {latency.stt ? (
          <div
            style={{ width: `${sttShare}%`, background: "var(--stage-1)", marginRight: 2 }}
            title={`Speech-to-text ${ms(latency.stt)}`}
          />
        ) : null}
        <div
          style={{ width: `${coreShare}%`, background: "var(--stage-4)", marginRight: 2 }}
          title={`RAG-core ${ms(latency.rag_core)}`}
        />
        <div className="flex-1" style={{ background: "var(--surface-3)" }} title="Transport" />
      </div>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-ink-muted">
        {latency.stt !== undefined && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: "var(--stage-1)" }} />
            Speech-to-text <span className="num text-ink-secondary">{ms(latency.stt)}</span>
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: "var(--stage-4)" }} />
          RAG-core <span className="num text-ink-secondary">{ms(latency.rag_core)}</span>
        </span>
      </div>
    </div>
  );
}

function StatusBadge({ withinBudget }: { withinBudget: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em]"
      style={{
        color: withinBudget ? "var(--status-good)" : "var(--status-critical)",
        background: withinBudget ? "rgba(12,163,12,0.12)" : "rgba(208,59,59,0.12)",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none">
        {withinBudget ? (
          <path d="M2.5 6.4l2.4 2.4L9.6 3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <path d="M6 3v3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="6" cy="9" r="0.9" fill="currentColor" />
          </>
        )}
      </svg>
      {withinBudget ? "Within budget" : "Over budget"}
    </span>
  );
}
