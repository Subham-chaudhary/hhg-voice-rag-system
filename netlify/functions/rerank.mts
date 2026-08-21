/**
 * Test harness for lib/jina.ts rerank. Thin wrapper — same code search.mts
 * calls directly, exposed here so it can be timed and tested in isolation.
 */
import type { Config } from "@netlify/functions";
import { rerank as jinaRerank } from "../lib/jina.ts";
import { RerankRequestSchema } from "../lib/schemas.ts";
import { Budget } from "../lib/budget.ts";

const handler = async (req: Request): Promise<Response> => {
  const t0 = performance.now();
  const requestId = crypto.randomUUID();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { status: "error", error: "invalid json body", request_id: requestId, timings_ms: {} });
  }

  const parsed = RerankRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { status: "error", error: parsed.error.message, request_id: requestId, timings_ms: {} });
  }
  const { query, documents, top_n } = parsed.data;
  const requestIdOut = parsed.data.request_id ?? requestId;
  const budget = new Budget(9000);

  try {
    const rerankStart = performance.now();
    const results = await jinaRerank(query, documents, top_n ?? documents.length, budget.signal(budget.take(5000, 500)));
    const rerankMs = performance.now() - rerankStart;

    const timings_ms = { rerank: round(rerankMs), total: round(performance.now() - t0) };
    log({ request_id: requestIdOut, fn: "rerank", status: "ok", timings_ms, degraded: null });
    return json(200, { status: "ok", results, request_id: requestIdOut, timings_ms });
  } catch (err) {
    const timings_ms = { total: round(performance.now() - t0) };
    log({ request_id: requestIdOut, fn: "rerank", status: "error", timings_ms, degraded: null, error: String(err) });
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

export const config: Config = { path: "/api/rerank" };
