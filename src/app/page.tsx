"use client";

import { useCallback, useRef, useState } from "react";
import { Composer } from "@/components/Composer";
import { Footer } from "@/components/Footer";
import { HhgRibbon } from "@/components/HhgRibbon";
import { PipelineErrorCard } from "@/components/PipelineErrorCard";
import { QrPanel } from "@/components/QrPanel";
import { RagSampleQuestions } from "@/components/RagSampleQuestions";
import { ResultCard } from "@/components/ResultCard";
import { SessionLatencyPanel } from "@/components/SessionLatencyPanel";
import { StageTimeline } from "@/components/StageTimeline";
import { ConnectionState, TopBar } from "@/components/TopBar";
import { languageName } from "@/lib/rag-types";
import { Phase, useRag } from "@/lib/use-rag";

export default function Console() {
  const { state, runText, runAudio } = useRag();
  const [lastTextQuery, setLastTextQuery] = useState<{ transcript: string; language?: string } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const busy = state.phase === "transcribing" || state.phase === "searching";

  const scrollToResults = useCallback(() => {
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }, []);

  const submitText = useCallback(
    (transcript: string, language?: string) => {
      setLastTextQuery({ transcript, language });
      runText(transcript, language);
      scrollToResults();
    },
    [runText, scrollToResults],
  );

  const submitAudio = useCallback(
    (wav: Blob) => {
      setLastTextQuery(null);
      runAudio(wav);
      scrollToResults();
    },
    [runAudio, scrollToResults],
  );

  const retryText = useCallback(() => {
    if (lastTextQuery) submitText(lastTextQuery.transcript, lastTextQuery.language);
  }, [lastTextQuery, submitText]);

  const connection: ConnectionState = {
    lastSource: state.result
      ? state.result.status === "error"
        ? "down"
        : state.result.degraded
          ? "degraded"
          : "live"
      : state.error
        ? "down"
        : null,
    reason: state.error?.message ?? state.result?.degraded ?? null,
  };

  return (
    <div className="grain flex min-h-full flex-col">
      <HhgRibbon />
      <TopBar connection={connection} />

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
        {state.phase === "idle" && !state.result && !state.error && (
          <section className="mb-8 max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--amber)" }}>
              Zenith · voice RAG console
            </p>
            <h1 className="display mt-3 text-[34px] leading-[1.1] text-ink sm:text-[44px]">
              Ask out loud.
              <br />
              <span style={{ color: "var(--amber)" }}>Retrieved only from evidence.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-secondary">
              A voice-first retrieval console wired directly to the deployed Netlify functions over
              MSMARCO-XI. This phase is retrieval only — no LLM generation yet — so every result traces back
              to a retrieved chunk, or nothing is returned at all.
            </p>
            <p className="mt-5 text-xs text-ink-muted">
              Submitted by <span className="text-ink-secondary">Team The Higher Celestials</span> for Hacker
              House Goa 2026, Shortlisting Task 2.
            </p>
          </section>
        )}

        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
          <div className="contents lg:flex lg:flex-col lg:gap-4">
            <div className="order-1 lg:order-none">
              <Composer busy={busy} onText={(text) => submitText(text)} onAudio={(wav) => submitAudio(wav)} />
            </div>

            <div className="order-2 lg:order-none">
              <StageTimeline
                phase={state.phase}
                viaVoice={state.viaVoice}
                sttMs={state.clientTimings.sttMs}
                timingsMs={state.result?.timings_ms}
              />
            </div>

            {state.transcript && (
              <div
                ref={resultsRef}
                className="rise order-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-xl border border-hairline bg-surface-1 px-5 py-3.5 sm:px-6 lg:order-none"
              >
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">Transcript</span>
                <p className="min-w-[8rem] flex-1 text-sm text-ink">{state.transcript}</p>
                {state.language && (
                  <span className="rounded-[3px] bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-ink-secondary">
                    {languageName(state.language)}
                  </span>
                )}
              </div>
            )}

            {busy && (
              <div className="order-4 lg:order-none">
                <ProcessingCard phase={state.phase} />
              </div>
            )}

            {!busy && state.error && (
              <div className="order-4 lg:order-none">
                <PipelineErrorCard error={state.error} onRetryText={state.error.kind === "network" ? retryText : undefined} />
              </div>
            )}

            {!busy && state.result && !state.error && (
              <div className="order-4 lg:order-none">
                <ResultCard result={state.result} />
              </div>
            )}
          </div>

          <div className="contents lg:flex lg:flex-col lg:gap-4">
            <div className="order-8 lg:order-none">
              <RagSampleQuestions
                busy={busy}
                onPick={(sample) => submitText(sample.transcript, sample.language)}
              />
            </div>

            <div className="order-9 lg:order-none">
              <SessionLatencyPanel />
            </div>

            <div className="order-10 lg:order-none">
              <QrPanel />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function ProcessingCard({ phase }: { phase: Phase }) {
  return (
    <div className="rise rounded-xl border border-hairline bg-surface-1 p-6">
      <div className="flex items-center gap-3">
        <span className="breathe h-2 w-2 rounded-full" style={{ background: "var(--amber)" }} />
        <p className="text-sm text-ink-secondary">{phase === "transcribing" ? "Transcribing…" : "Retrieving…"}</p>
      </div>
      <div className="mt-4 space-y-2.5">
        <div className="h-3 w-4/5 rounded bg-surface-2" />
        <div className="h-3 w-3/5 rounded bg-surface-2" />
      </div>
    </div>
  );
}
