"use client";

import { RAG_SAMPLES, type RagSample } from "@/data/rag-samples";

const EXPECT_DOT: Record<RagSample["expect"], string> = {
  normal: "var(--amber)",
  ambiguous: "var(--stage-5)",
  indic: "var(--amber)",
  "no-match": "var(--coral)",
  adversarial: "var(--status-critical)",
};

export function RagSampleQuestions({
  busy,
  onPick,
}: {
  busy: boolean;
  onPick: (sample: RagSample) => void;
}) {
  return (
    <section className="rounded-xl border border-hairline bg-surface-1 px-5 py-4 sm:px-6">
      <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">Try one</p>
      <p className="mt-1 text-xs text-ink-secondary">
        Five presets — normal, ambiguous, Indic-language, no-match, adversarial. Text path, no microphone
        needed.
      </p>

      <ul className="mt-3.5 flex flex-col gap-1.5">
        {RAG_SAMPLES.map((sample) => (
          <li key={sample.id} className="min-w-0">
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick(sample)}
              className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: EXPECT_DOT[sample.expect] }}
              />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-secondary group-hover:text-ink">
                {sample.label}
              </span>
              <span className="shrink-0 text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                {sample.expect}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
