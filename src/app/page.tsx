"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnswerCard } from "@/components/AnswerCard";
import { Composer } from "@/components/Composer";
import { CoresPanel } from "@/components/CoresPanel";
import { EvidencePanel } from "@/components/EvidencePanel";
import { Footer } from "@/components/Footer";
import { HhgRibbon } from "@/components/HhgRibbon";
import { LatencyStrip } from "@/components/LatencyStrip";
import { QrPanel } from "@/components/QrPanel";
import { SampleQuestions } from "@/components/SampleQuestions";
import { SessionHistory } from "@/components/SessionHistory";
import { StageRail } from "@/components/StageRail";
import { ConnectionState, TopBar } from "@/components/TopBar";
import { SampleQuery } from "@/data/samples";
import { RunQueryOutput, runQuery } from "@/lib/client";
import { RAG_CORE_STAGES } from "@/lib/contract";
import {
  appendRecord,
  clearRecords,
  getServerSnapshot,
  getSnapshot,
  isPersistent,
  subscribe,
} from "@/lib/store";

const noopSubscribe = () => () => {};

type Phase = "idle" | "processing" | "done";

export default function Console() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<RunQueryOutput | null>(null);
  const [transcript, setTranscript] = useState("");
  const [viaVoice, setViaVoice] = useState(false);
  const records = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const persistent = useSyncExternalStore(noopSubscribe, isPersistent, () => true);
  const [connection, setConnection] = useState<ConnectionState>({
    configured: null,
    lastSource: null,
    reason: null,
  });
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/query")
      .then((response) => response.json())
      .then((info: { configured: boolean }) =>
        setConnection((current) => ({ ...current, configured: info.configured })),
      )
      .catch(() => setConnection((current) => ({ ...current, configured: false })));
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
      });

      setResult(output);
      setTranscript(output.transcript || input.transcript || "");
      setPhase("done");
      setConnection((current) => ({
        ...current,
        lastSource: output.source,
        reason: output.fallbackReason,
      }));

      if (output.source === "live") {
        const stages = Object.fromEntries(
          (["stt", ...RAG_CORE_STAGES] as const)
            .map((stage) => [stage, output.latency[stage]])
            .filter(([, value]) => typeof value === "number"),
        );

        appendRecord({
            id: `${output.receivedAt}-${Math.random().toString(36).slice(2, 7)}`,
            at: output.receivedAt,
            transcript: output.transcript || input.transcript || "(spoken query)",
            language: output.language,
            status: output.status,
            viaVoice: input.spoken,
            ragCore: output.latency.rag_core,
            voiceE2E: output.latency.voice_e2e,
            stages,
            clientRoundTripMs: output.clientRoundTripMs,
          traceId: output.traceId,
        });
      }

      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      );
    },
    [],
  );

  const busy = phase === "processing";

  return (
    <div className="grain flex min-h-full flex-col">
      <HhgRibbon />
      <TopBar connection={connection} />

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
        {phase === "idle" && !result && (
          <section className="mb-8 max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--amber)" }}>
              Zenith · voice RAG console
            </p>
            <h1 className="display mt-3 text-[34px] leading-[1.1] text-ink sm:text-[44px]">
              Ask out loud.
              <br />
              <span style={{ color: "var(--amber)" }}>Answered only from evidence.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-secondary">
              A voice-first retrieval console over MSMARCO-XI. Speech is transcribed, the corpus is searched
              across dense and sparse representations, and every sentence returned is traced back to a
              retrieved chunk — or nothing is returned at all.
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
                <LatencyStrip
                  latency={result.latency}
                  clientRoundTripMs={result.clientRoundTripMs}
                  simulated={result.source === "simulated"}
                />
              </div>
            )}

            {result && !busy && result.cores.length > 0 && (
              <div className="order-7 lg:order-none">
                <CoresPanel cores={result.cores} />
              </div>
            )}

            <div className="order-8 lg:order-none">
              <SampleQuestions
                busy={busy}
                onPick={(sample: SampleQuery) =>
                  void execute({ transcript: sample.transcript, language: sample.language, spoken: false })
                }
              />
            </div>

            <div className="order-9 lg:order-none">
              <QrPanel />
            </div>

            <div className="order-10 lg:order-none">
              <SessionHistory
                records={records}
                persistent={persistent}
                onReplay={(record) => void execute({ transcript: record.transcript, spoken: false })}
                onClear={clearRecords}
              />
            </div>
          </div>
        </div>
      </main>

      <Footer />
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
