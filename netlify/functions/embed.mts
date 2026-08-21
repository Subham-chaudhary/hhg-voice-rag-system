/**
 * Test harness for lib/jina.ts embedding. Its real purpose is measurement:
 * hit it repeatedly from a deployed function and record the P50/P90 — Jina
 * embed latency is the largest single term in search.mts's rag_core window
 * and the one this system controls least.
 */
import type { Config } from "@netlify/functions";
import { embedText } from "../lib/jina.ts";
import { EmbedRequestSchema } from "../lib/schemas.ts";
import { Budget } from "../lib/budget.ts";
import "../lib/manifest.ts"; // boot-time assertion

const handler = async (req: Request): Promise<Response> => {
  const t0 = performance.now();
  const requestId = crypto.randomUUID();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { status: "error", error: "invalid json body", request_id: requestId, timings_ms: {} });
  }

  const parsed = EmbedRequestSchema.safeParse(body);
  if (!parsed.success) {
    const bodyObj = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const rawRequestId = "request_id" in bodyObj ? String(bodyObj.request_id) : undefined;
    return json(400, {
      status: "error",
      error: parsed.error.message,
      request_id: rawRequestId ?? requestId,
      timings_ms: {},
    });
  }
  const { text, task } = parsed.data;
  const requestIdOut = parsed.data.request_id ?? requestId;
  const budget = new Budget(9000);

  try {
    const embedStart = performance.now();
    const vector = await embedText(text, task, budget.signal(budget.take(5000, 500)));
    const embedMs = performance.now() - embedStart;

    const dim = Number(process.env.EMBED_DIM);
    const norm = Math.hypot(...vector);
    if (vector.length !== dim) throw new Error(`vector length ${vector.length} !== EMBED_DIM ${dim}`);
    if (Math.abs(norm - 1.0) > 1e-4) throw new Error(`vector not unit-normalized: norm=${norm}`);

    const timings_ms = { embed: round(embedMs), total: round(performance.now() - t0) };
    log({ request_id: requestIdOut, fn: "embed", status: "ok", timings_ms, degraded: null });
    return json(200, { status: "ok", vector, dim, request_id: requestIdOut, timings_ms });
  } catch (err) {
    const timings_ms = { total: round(performance.now() - t0) };
    log({ request_id: requestIdOut, fn: "embed", status: "error", timings_ms, degraded: null, error: String(err) });
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

export const config: Config = { path: "/api/embed" };
