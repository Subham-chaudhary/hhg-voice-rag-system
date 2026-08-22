/**
 * The ONE module allowed to fetch() a /fn/* endpoint. Nothing else in the
 * app may call fetch against a function — grep `fetch("/fn` to verify.
 *
 * Every response is validated with zod at this boundary. The functions
 * return typed responses; parsing them anyway means a shape change surfaces
 * here as one loud, labelled error instead of as a crash three components
 * deep during a demo.
 */
import { SttResponseSchema, SearchResponseSchema } from "./rag-schemas";
import type { SttResponse, SearchResponse } from "./rag-types";

export class ContractMismatchError extends Error {
  constructor(
    public requestId: string,
    public zodMessage: string,
  ) {
    super(`Response did not match the expected contract: ${zodMessage}`);
    this.name = "ContractMismatchError";
  }
}

/** Last request_id seen by either caller — read by the error boundary for context. */
export let lastRequestId: string | null = null;

export async function stt(
  input: { audio: Blob; languageCode?: string; requestId: string },
  signal: AbortSignal,
): Promise<SttResponse> {
  const form = new FormData();
  form.append("file", input.audio, "audio");
  if (input.languageCode) form.append("language_code", input.languageCode);
  form.append("request_id", input.requestId);

  const res = await fetch("/fn/stt", { method: "POST", body: form, signal });
  const json = await res.json().catch(() => null);
  const parsed = SttResponseSchema.safeParse(json);
  if (parsed.success) {
    lastRequestId = parsed.data.request_id;
    return parsed.data;
  }
  // A 2xx that doesn't match the schema is a real contract drift. A non-2xx
  // that also doesn't parse is more likely the function itself failing
  // (5xx) — surface that as a retryable network error, not "shape changed".
  if (!res.ok) throw new Error(`/fn/stt returned ${res.status}`);
  throw new ContractMismatchError(input.requestId, parsed.error.message);
}

export async function search(
  input: { transcript: string; languageCode?: string; requestId: string },
  signal: AbortSignal,
): Promise<SearchResponse> {
  const res = await fetch("/fn/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      transcript: input.transcript,
      language_code: input.languageCode,
      request_id: input.requestId,
    }),
    signal,
  });
  const json = await res.json().catch(() => null);
  const parsed = SearchResponseSchema.safeParse(json);
  if (parsed.success) {
    lastRequestId = parsed.data.request_id;
    return parsed.data;
  }
  if (!res.ok) throw new Error(`/fn/search returned ${res.status}`);
  throw new ContractMismatchError(input.requestId, parsed.error.message);
}
