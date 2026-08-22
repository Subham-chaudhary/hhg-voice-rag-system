"use client";

/**
 * The client orchestrator for the two-call lifecycle (§3 of integrate.md):
 * idle -> recording -> transcribing -> /fn/stt -> searching -> /fn/search
 * -> {answered, ok, abstained, refused, error}. Text input skips straight
 * to searching. One AbortController per cycle; a new query or unmount
 * aborts whatever is in flight. STT failure is terminal for that cycle —
 * no auto-retry, the transcript box stays editable so the user can retry
 * via text.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { stt, search, ContractMismatchError } from "./rag-client";
import type { SearchResponse } from "./rag-types";
import { appendRecord, type SessionRecord } from "./rag-store";

export type Phase = "idle" | "recording" | "transcribing" | "searching" | "done";

export type RagError =
  | { kind: "stt"; message: string; requestId: string }
  | { kind: "contract"; message: string; requestId: string }
  | { kind: "network"; message: string; requestId: string };

export interface RagState {
  phase: Phase;
  requestId: string | null;
  transcript: string;
  language: string | undefined;
  viaVoice: boolean;
  result: SearchResponse | null;
  error: RagError | null;
  clientTimings: { sttMs?: number; searchMs?: number };
}

const initial: RagState = {
  phase: "idle",
  requestId: null,
  transcript: "",
  language: undefined,
  viaVoice: false,
  result: null,
  error: null,
  clientTimings: {},
};

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export function useRag() {
  const [state, setState] = useState<RagState>(initial);
  const controllerRef = useRef<AbortController | null>(null);

  const abortInFlight = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  useEffect(() => abortInFlight, [abortInFlight]);

  const runSearch = useCallback(
    async (
      transcript: string,
      language: string | undefined,
      requestId: string,
      controller: AbortController,
    ) => {
      setState((s) => ({ ...s, phase: "searching" }));
      const started = performance.now();
      try {
        const res = await search({ transcript, languageCode: language, requestId }, controller.signal);
        const searchMs = performance.now() - started;

        const record: SessionRecord = {
          id: requestId,
          requestId,
          at: Date.now(),
          transcript,
          language: language ?? res.evidence?.[0]?.lang ?? "unknown",
          status: res.status,
          reranked: res.reranked ?? false,
          earlyExit: res.early_exit ?? false,
          degraded: res.degraded ?? null,
          ragCore: res.timings_ms.rag_core ?? 0,
          clientRoundTripMs: Math.round(searchMs * 10) / 10,
        };
        appendRecord(record);

        setState((s) => ({
          ...s,
          phase: "done",
          result: res,
          error: null,
          clientTimings: { ...s.clientTimings, searchMs: Math.round(searchMs * 10) / 10 },
        }));
      } catch (err) {
        if (isAbort(err)) return;
        if (err instanceof ContractMismatchError) {
          setState((s) => ({
            ...s,
            phase: "done",
            result: null,
            error: { kind: "contract", message: err.message, requestId: err.requestId },
          }));
          return;
        }
        setState((s) => ({
          ...s,
          phase: "done",
          result: null,
          error: {
            kind: "network",
            message: err instanceof Error ? err.message : "The pipeline did not respond.",
            requestId,
          },
        }));
      }
    },
    [],
  );

  const runText = useCallback(
    (transcript: string, language?: string) => {
      abortInFlight();
      const controller = new AbortController();
      controllerRef.current = controller;
      const requestId = crypto.randomUUID();
      setState({ ...initial, phase: "searching", requestId, transcript, language, viaVoice: false });
      void runSearch(transcript, language, requestId, controller);
    },
    [runSearch, abortInFlight],
  );

  const runAudio = useCallback(
    (audio: Blob, languageHint?: string) => {
      abortInFlight();
      const controller = new AbortController();
      controllerRef.current = controller;
      const requestId = crypto.randomUUID();
      setState({ ...initial, phase: "transcribing", requestId, viaVoice: true });

      void (async () => {
        const started = performance.now();
        try {
          const res = await stt({ audio, languageCode: languageHint, requestId }, controller.signal);
          const sttMs = Math.round((performance.now() - started) * 10) / 10;

          if (res.status === "error" || !res.transcript) {
            setState((s) => ({
              ...s,
              phase: "done",
              error: { kind: "stt", message: res.error ?? "No speech was detected.", requestId },
              clientTimings: { sttMs },
            }));
            return;
          }

          setState((s) => ({
            ...s,
            transcript: res.transcript!,
            language: res.language_code,
            clientTimings: { sttMs },
          }));
          await runSearch(res.transcript, res.language_code, requestId, controller);
        } catch (err) {
          if (isAbort(err)) return;
          if (err instanceof ContractMismatchError) {
            setState((s) => ({
              ...s,
              phase: "done",
              error: { kind: "contract", message: err.message, requestId: err.requestId },
            }));
            return;
          }
          setState((s) => ({
            ...s,
            phase: "done",
            error: { kind: "stt", message: err instanceof Error ? err.message : "Transcription failed.", requestId },
          }));
        }
      })();
    },
    [runSearch, abortInFlight],
  );

  const reset = useCallback(() => {
    abortInFlight();
    setState(initial);
  }, [abortInFlight]);

  return { state, runText, runAudio, cancel: abortInFlight, reset };
}
