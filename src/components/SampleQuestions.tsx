"use client";

import { SAMPLE_QUERIES, SampleQuery } from "@/data/samples";

const INTENT_STYLE: Record<SampleQuery["intent"], { dot: string; note: string }> = {
  answered: { dot: "var(--amber)", note: "answers" },
  "refused-low-confidence": { dot: "var(--coral)", note: "refuses — low confidence" },
  "refused-off-topic": { dot: "var(--coral)", note: "refuses — off topic" },
  "refused-unsafe": { dot: "var(--status-critical)", note: "blocks — unsafe" },
};

export function SampleQuestions({
  busy,
  onPick,
}: {
  busy: boolean;
  onPick: (sample: SampleQuery) => void;
}) {
  return (
    <section className="rounded-xl border border-hairline bg-surface-1 px-5 py-4 sm:px-6">
      <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">Try one</p>
      <p className="mt-1 text-xs text-ink-secondary">
        No microphone needed — these run the same pipeline through the text path.
      </p>

      <ul className="mt-3.5 grid gap-1.5">
        {SAMPLE_QUERIES.map((sample) => {
          const style = INTENT_STYLE[sample.intent];
          return (
            <li key={sample.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(sample)}
                className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: style.dot }} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-secondary group-hover:text-ink">
                  {sample.label}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                  {style.note}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
