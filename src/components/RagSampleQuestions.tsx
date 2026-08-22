"use client";

import { useEffect, useState } from "react";
import { RAG_SAMPLES, type RagSample } from "@/data/rag-samples";
import { samples as fetchSamples, ContractMismatchError } from "@/lib/rag-client";
import { languageName } from "@/lib/rag-types";

const EXPECT_DOT: Record<RagSample["expect"], string> = {
  normal: "var(--amber)",
  ambiguous: "var(--stage-5)",
  indic: "var(--amber)",
  "no-match": "var(--coral)",
  adversarial: "var(--status-critical)",
};

interface DisplaySample {
  id: string;
  label: string;
  transcript: string;
  language?: string;
  expect?: RagSample["expect"];
}

function fromCurated(sample: RagSample): DisplaySample {
  return { id: sample.id, label: sample.label, transcript: sample.transcript, language: sample.language, expect: sample.expect };
}

export function RagSampleQuestions({
  busy,
  onPick,
}: {
  busy: boolean;
  onPick: (sample: { transcript: string; language?: string }) => void;
}) {
  const [items, setItems] = useState<DisplaySample[]>(RAG_SAMPLES.map(fromCurated));
  const [live, setLive] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchSamples(controller.signal)
      .then((res) => {
        if (res.status !== "ok" || !res.samples?.length) return;
        setItems(
          res.samples.map((s) => ({
            id: s.id,
            label: s.transcript,
            transcript: s.transcript,
            language: s.language,
          })),
        );
        setLive(true);
      })
      .catch((err) => {
        // AbortError is expected on unmount; anything else (network down,
        // ContractMismatchError, /fn/samples erroring) just keeps the
        // curated fallback list already showing — "Try one" is never empty.
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof ContractMismatchError) console.warn("[samples] contract mismatch:", err.message);
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 px-5 py-4 sm:px-6">
      <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">Try one</p>
      <p className="mt-1 text-xs text-ink-secondary">
        {live
          ? "Random real queries from the indexed corpus, reshuffled on every load. Text path, no microphone needed."
          : "Five presets — normal, ambiguous, Indic-language, no-match, adversarial. Text path, no microphone needed."}
      </p>
      <p className="mt-1 text-[11px] text-ink-muted">
        These are stored queries from the corpus itself — feel free to rephrase or alter any of them, any
        variation still searches the same index.
      </p>

      <ul className="mt-3.5 flex flex-col gap-1.5">
        {items.map((sample) => (
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
                style={{ background: sample.expect ? EXPECT_DOT[sample.expect] : "var(--stage-3)" }}
              />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-secondary group-hover:text-ink">
                {sample.label}
              </span>
              <span className="shrink-0 text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                {sample.expect ?? languageName(sample.language)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
