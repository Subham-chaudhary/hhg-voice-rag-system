"use client";

import { ms } from "@/lib/format";
import type { Phase } from "@/lib/use-rag";

const SEARCH_STAGES = [
  { key: "embed", label: "Embed query" },
  { key: "retrieve", label: "Retrieve (Qdrant)" },
  { key: "rerank", label: "Rerank" },
  { key: "gate", label: "Confidence gate" },
] as const;

const STAGE_COLOR: Record<(typeof SEARCH_STAGES)[number]["key"], string> = {
  embed: "var(--stage-3)",
  retrieve: "var(--stage-4)",
  rerank: "var(--stage-5)",
  gate: "var(--stage-6)",
};

export function StageTimeline({
  phase,
  viaVoice,
  sttMs,
  timingsMs,
}: {
  phase: Phase;
  viaVoice: boolean;
  sttMs?: number;
  timingsMs?: Record<string, number>;
}) {
  const searching = phase === "searching" || phase === "done";
  const ragCore = timingsMs?.rag_core;

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 px-5 py-4 sm:px-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">Pipeline</p>
        <p className="text-[11px] text-ink-muted">
          {phase === "idle" ? "idle" : phase === "recording" ? "listening" : phase === "transcribing" ? "transcribing" : phase === "searching" ? "searching" : "done"}
        </p>
      </div>

      {viaVoice && (
        <div className="mt-3">
          <StageRow
            label="Speech-to-text (Sarvam)"
            color="var(--stage-1)"
            state={phase === "transcribing" ? "running" : sttMs !== undefined ? "done" : "idle"}
            value={sttMs}
            note="excluded from rag_core"
          />
        </div>
      )}

      <ol className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
        {SEARCH_STAGES.map(({ key, label }) => {
          const value = timingsMs?.[key];
          const state = !searching ? "idle" : phase === "searching" && value === undefined ? "running" : "done";
          const skipped = phase === "done" && value === undefined;
          return (
            <StageRow
              key={key}
              label={label}
              color={skipped ? "var(--ink-muted)" : STAGE_COLOR[key]}
              state={state}
              value={value}
              skipped={skipped}
            />
          );
        })}
      </ol>

      {ragCore !== undefined && (
        <div className="mt-3 flex items-baseline justify-between gap-3 rounded-lg border border-[var(--line-strong)] bg-surface-2 px-3.5 py-2.5">
          <span className="text-[11px] uppercase tracking-[0.14em] text-ink-secondary">
            rag_core — transcript received → evidence returned
          </span>
          <span className="num text-lg text-ink">{ms(ragCore)}</span>
        </div>
      )}
    </section>
  );
}

function StageRow({
  label,
  color,
  state,
  value,
  skipped,
  note,
}: {
  label: string;
  color: string;
  state: "idle" | "running" | "done";
  value: number | undefined;
  skipped?: boolean;
  note?: string;
}) {
  return (
    <li className="relative flex min-w-0 items-center gap-2 overflow-hidden rounded-lg bg-surface-2 px-2.5 py-2">
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full transition-opacity"
        style={{ background: color, opacity: state === "idle" ? 0.3 : 1 }}
      />
      <span className="min-w-0 flex-1 truncate text-[11px] text-ink-secondary" title={note}>
        {label}
      </span>
      <span className="num shrink-0 text-[11px] text-ink-muted">
        {state === "done" ? (skipped ? "skipped" : ms(value, 1)) : state === "running" ? "···" : "—"}
      </span>
      {state === "running" && <span className="sweep absolute inset-0" aria-hidden />}
    </li>
  );
}
