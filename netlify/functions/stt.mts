/**
 * POST /fn/stt — multipart/form-data { file, language_code? }
 * Forwards to Sarvam. One retry on 5xx only, never on 4xx, never twice —
 * two retries risk the function's own timeout ceiling.
 */
import type { Config } from "@netlify/functions";
import { transcribe, checkAudioSize, SarvamError } from "../lib/sarvam.ts";
import { SttFieldsSchema } from "../lib/schemas.ts";
import { Budget } from "../lib/budget.ts";

const TIMEOUT_MS = 6000;

const handler = async (req: Request): Promise<Response> => {
  const t0 = performance.now();
  const requestId = crypto.randomUUID();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json(400, { status: "error", error: "expected multipart/form-data", request_id: requestId, timings_ms: {} });
  }

  const fileField = form.get("file");
  if (typeof fileField === "string" || fileField == null) {
    return json(400, { status: "error", error: "missing file field", request_id: requestId, timings_ms: {} });
  }
  const file = fileField as Blob;

  const fieldsParsed = SttFieldsSchema.safeParse({
    language_code: form.get("language_code")?.toString(),
    request_id: form.get("request_id")?.toString() || undefined,
  });
  if (!fieldsParsed.success) {
    return json(400, { status: "error", error: fieldsParsed.error.message, request_id: requestId, timings_ms: {} });
  }
  const requestIdOut = fieldsParsed.data.request_id ?? requestId;

  const size = file.size;
  const sizeCheck = checkAudioSize(size);
  if (!sizeCheck.ok) {
    return json(200, { status: "error", error: sizeCheck.reason, request_id: requestIdOut, timings_ms: {} });
  }

  const languageCode = fieldsParsed.data.language_code;
  const budget = new Budget(TIMEOUT_MS + 500);

  const attempt = async () => {
    const sttStart = performance.now();
    const result = await transcribe(file, languageCode, budget.signal(budget.take(TIMEOUT_MS, 200)));
    return { result, sttMs: performance.now() - sttStart };
  };

  try {
    let outcome;
    try {
      outcome = await attempt();
    } catch (err) {
      if (err instanceof SarvamError && err.status >= 500) {
        outcome = await attempt(); // one retry, 5xx only
      } else {
        throw err;
      }
    }
    const { result, sttMs } = outcome;
    const timings_ms = { stt: round(sttMs), total: round(performance.now() - t0) };
    log({ request_id: requestIdOut, fn: "stt", status: "ok", timings_ms, degraded: null });
    return json(200, {
      status: "ok",
      transcript: result.transcript,
      language_code: result.language_code,
      request_id: requestIdOut,
      timings_ms,
    });
  } catch (err) {
    const timings_ms = { total: round(performance.now() - t0) };
    log({ request_id: requestIdOut, fn: "stt", status: "error", timings_ms, degraded: null, error: String(err) });
    return json(200, { status: "error", error: String(err), request_id: requestIdOut, timings_ms });
  }
};

export default handler;

function round(ms: number) {
  return Math.round(ms * 10) / 10;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function log(line: Record<string, unknown>) {
  console.log(JSON.stringify(line));
}

export const config: Config = { path: "/fn/stt" };
