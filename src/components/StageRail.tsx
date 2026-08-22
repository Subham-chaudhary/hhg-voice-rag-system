"use client";

import {
  ALL_STAGES,
  LatencyBreakdown,
  STAGE_COLOR,
  STAGE_DETAIL,
  STAGE_LABEL,
  StageKey,
} from "@/lib/contract";
import { ms } from "@/lib/format";

type RailState = "idle" | "running" | "done";

export function StageRail({
  state,
  latency,
  voiceUsed,
}: {
  state: RailState;
  latency?: LatencyBreakdown;
  voiceUsed: boolean;
}) {
  const stages = voiceUsed ? ALL_STAGES : ALL_STAGES.filter((stage) => stage !== "stt");

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 px-5 py-4 sm:px-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">Harness</p>
        <p className="text-[11px] text-ink-muted">
          {state === "running" ? "in flight" : state === "done" ? "typed response verified" : "idle"}
        </p>
      </div>

      <ol className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {stages.map((stage) => {
          const value = latency?.[stage as keyof LatencyBreakdown] as number | undefined;
          const skipped = state === "done" && (value === undefined || value === 0);

          return (
            <li
              key={stage}
              title={STAGE_DETAIL[stage as StageKey]}
              className="relative flex min-w-0 items-center gap-2 overflow-hidden rounded-lg bg-surface-2 px-2.5 py-2"
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full transition-opacity"
                style={{
                  background: skipped ? "var(--ink-muted)" : STAGE_COLOR[stage as StageKey],
                  opacity: state === "idle" ? 0.3 : 1,
                }}
              />
              <span className="min-w-0 flex-1 truncate text-[11px] text-ink-secondary">
                {STAGE_LABEL[stage as StageKey]}
              </span>
              <span className="num shrink-0 text-[11px] text-ink-muted">
                {state === "done" ? (skipped ? "skipped" : ms(value, 1)) : state === "running" ? "···" : "—"}
              </span>
              {state === "running" && <span className="sweep absolute inset-0" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
