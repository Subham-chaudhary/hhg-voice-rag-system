import { adaptQueryResponse } from "./adapter";
import { QueryResult } from "./contract";

export type PipelineMode = "mock" | "live";

export interface RunQueryInput {
  transcript?: string;
  audio?: Blob;
  language?: string;
  mode: PipelineMode;
  signal?: AbortSignal;
}

export interface RunQueryOutput extends QueryResult {
  clientRoundTripMs: number;
  attempts: number;
}

const REQUEST_TIMEOUT_MS = 20000;
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function endpoint(mode: PipelineMode): string {
  const base = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "");
  if (mode === "live" && base) return `${base}/query`;
  return "/api/query";
}

async function postOnce(input: RunQueryInput, attempt: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const onAbort = () => controller.abort();
  input.signal?.addEventListener("abort", onAbort);

  try {
    const url = new URL(endpoint(input.mode), window.location.origin);
    url.searchParams.set("mode", input.mode);

    let response: Response;
    if (input.audio) {
      const form = new FormData();
      form.append("audio", input.audio, "query.wav");
      if (input.language) form.append("language", input.language);
      if (input.transcript) form.append("transcript", input.transcript);
      response = await fetch(url, { method: "POST", body: form, signal: controller.signal });
    } else {
      response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript: input.transcript ?? "", language: input.language }),
        signal: controller.signal,
      });
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new HttpError(response.status, detail.slice(0, 240) || `Backend returned ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", onAbort);
    void attempt;
  }
}

function shouldRetry(error: unknown): boolean {
  if (error instanceof HttpError) return RETRYABLE.has(error.status);
  if (error instanceof DOMException && error.name === "AbortError") return false;
  return true;
}

export async function runQuery(input: RunQueryInput): Promise<RunQueryOutput> {
  const started = performance.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const payload = await postOnce(input, attempt);
      const result = adaptQueryResponse(payload, input.mode === "mock" ? "mock" : "live");
      return {
        ...result,
        transcript: result.transcript || input.transcript || "",
        clientRoundTripMs: Math.round((performance.now() - started) * 10) / 10,
        attempts: attempt,
      };
    } catch (error) {
      lastError = error;
      if (attempt === 2 || !shouldRetry(error)) break;
      await new Promise((resolve) => setTimeout(resolve, 240));
    }
  }

  const message =
    lastError instanceof DOMException && lastError.name === "AbortError"
      ? "Request cancelled or timed out."
      : lastError instanceof Error
        ? lastError.message
        : "The pipeline did not respond.";

  return {
    status: "error",
    answer: "",
    transcript: input.transcript ?? "",
    language: "unknown",
    languageName: "Unknown",
    confidence: 0,
    threshold: null,
    evidence: [],
    evidenceIds: [],
    latency: { rag_core: 0 },
    refusalReason: message,
    refusalCode: null,
    fallback: null,
    traceId: null,
    model: null,
    source: input.mode === "mock" ? "mock" : "live",
    receivedAt: Date.now(),
    clientRoundTripMs: Math.round((performance.now() - started) * 10) / 10,
    attempts: 2,
  };
}
