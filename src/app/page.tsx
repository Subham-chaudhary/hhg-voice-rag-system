"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnswerCard } from "@/components/AnswerCard";
import { Composer } from "@/components/Composer";
import { EvidencePanel } from "@/components/EvidencePanel";
import { LatencyStrip } from "@/components/LatencyStrip";
import { SampleQuestions } from "@/components/SampleQuestions";
import { HistoryEntry, SessionHistory } from "@/components/SessionHistory";
import { StageRail } from "@/components/StageRail";
import { TopBar } from "@/components/TopBar";
import { SampleQuery } from "@/data/samples";
import { PipelineMode, RunQueryOutput, runQuery } from "@/lib/client";

type Phase = "idle" | "processing" | "done";

export default function Console() {
  const [mode, setMode] = useState<PipelineMode>("mock");
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<RunQueryOutput | null>(null);
  const [transcript, setTranscript] = useState("");
  const [viaVoice, setViaVoice] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/query")
      .then((response) => response.json())
      .then((info: { mode: string; backend: string | null }) => {
        setBackendReachable(Boolean(info.backend));
        if (info.backend) setMode("live");
      })
      .catch(() => setBackendReachable(false));
  }, []);

  const execute = useCallback(
    async (input: { transcript?: string; audio?: Blob; language?: string; spoken: boolean }) => {
      setPhase("processing");
      setViaVoice(input.spoken);
      setTranscript(input.transcript ?? "");
      setResult(null);

      const output = await runQuery({
        transcript: input.transcript,
        audio: input.audio,
        language: input.language,
        mode,
      });

      setResult(output);
      setTranscript(output.transcript || input.transcript || "");
      setPhase("done");
      setHistory((current) =>
        [
          {
            id: `${output.receivedAt}-${Math.random().toString(36).slice(2, 7)}`,
            transcript: output.transcript || input.transcript || "(spoken query)",
            status: output.status,
            ragCore: output.latency.rag_core,
            voiceE2E: output.latency.voice_e2e,
            language: output.language,
            viaVoice: input.spoken,
            at: output.receivedAt,
          },
          ...current,
        ].slice(0, 12),
      );

      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      );
    },
    [mode],
  );

  const busy = phase === "processing";

  return (
    <div className="grain min-h-full">
      <TopBar mode={mode} onModeChange={setMode} backendReachable={backendReachable} />

      <main className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
        {phase === "idle" && !result && (
          <section className="mb-8 max-w-2xl">
            <h1 className="display text-[34px] leading-[1.1] text-ink sm:text-[44px]">
              Ask out loud.
              <br />
              <span style={{ color: "var(--amber)" }}>Answered only from evidence.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-secondary">
              A voice-first retrieval console over MSMARCO-XI. Speech is transcribed, the corpus is searched
              across dense and sparse representations, and every sentence returned is traced back to a
              retrieved chunk — or nothing is returned at all.
            </p>
          </section>
        )}

        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
          <div className="contents lg:flex lg:flex-col lg:gap-4">
            <div className="order-1 lg:order-none">
              <Composer
                busy={busy}
                onText={(text) => void execute({ transcript: text, spoken: false })}
                onAudio={(wav) => void execute({ audio: wav, spoken: true })}
              />
            </div>

            <div className="order-2 lg:order-none">
              <StageRail
                state={phase === "processing" ? "running" : phase === "done" ? "done" : "idle"}
                latency={result?.latency}
                voiceUsed={viaVoice}
              />
            </div>

            {transcript && (
              <div
                ref={resultsRef}
                className="rise order-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-xl border border-hairline bg-surface-1 px-5 py-3.5 sm:px-6 lg:order-none"
              >
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">Transcript</span>
                <p className="min-w-[8rem] flex-1 text-sm text-ink">{transcript}</p>
                {result && (
                  <span className="rounded-[3px] bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-ink-secondary">
                    {result.languageName}
                  </span>
                )}
              </div>
            )}

            {busy && (
              <div className="order-4 lg:order-none">
                <ProcessingCard />
              </div>
            )}

            {result && !busy && (
              <div className="order-4 lg:order-none">
                <AnswerCard result={result} />
              </div>
            )}

            {result && !busy && (
              <div className="order-6 lg:order-none">
                <EvidencePanel evidence={result.evidence} />
              </div>
            )}
          </div>

          <div className="contents lg:flex lg:flex-col lg:gap-4">
            {result && !busy && result.latency.rag_core > 0 && (
              <div className="order-5 lg:order-none">
                <LatencyStrip latency={result.latency} clientRoundTripMs={result.clientRoundTripMs} />
              </div>
            )}

            <div className="order-7 lg:order-none">
              <SampleQuestions
                busy={busy}
                onPick={(sample: SampleQuery) =>
                  void execute({ transcript: sample.transcript, language: sample.language, spoken: false })
                }
              />
            </div>

            <div className="order-8 lg:order-none">
              <SessionHistory
                entries={history}
                onReplay={(entry) => void execute({ transcript: entry.transcript, spoken: false })}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ProcessingCard() {
  return (
    <div className="rise rounded-xl border border-hairline bg-surface-1 p-6">
      <div className="flex items-center gap-3">
        <span className="breathe h-2 w-2 rounded-full" style={{ background: "var(--amber)" }} />
        <p className="text-sm text-ink-secondary">Retrieving and grounding…</p>
      </div>
      <div className="mt-4 space-y-2.5">
        <div className="h-3 w-4/5 rounded bg-surface-2" />
        <div className="h-3 w-3/5 rounded bg-surface-2" />
      </div>
    </div>
  );
}
