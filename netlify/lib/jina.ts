/**
 * The parity-critical lib. Colab embedded the corpus with the LOCAL
 * jinaai/jina-embeddings-v3 weights; the runtime embeds queries with the
 * Jina API. These must produce compatible vectors or retrieval returns
 * confident, plausible, wrong results and nothing throws. See
 * test/parity.test.ts, which is the build gate for this file.
 */
import { Agent } from "node:https";

export const agent = new Agent({ keepAlive: true, maxSockets: 20 });

export class JinaError extends Error {
  constructor(public status: number, public body: string) {
    super(`Jina API error ${status}: ${body.slice(0, 300)}`);
    this.name = "JinaError";
  }
}

/** Identical to the Colab helper. Slice FIRST, then normalize. Never the reverse. */
export function matryoshka(v: number[], dim: number): number[] {
  const s = v.slice(0, dim);
  let n = Math.hypot(...s);
  if (n === 0) n = 1;
  return s.map((x) => x / n);
}

const EMBEDDINGS_URL = "https://api.jina.ai/v1/embeddings";
const RERANK_URL = "https://api.jina.ai/v1/rerank";

export type EmbedTask = "retrieval.query" | "retrieval.passage";

/**
 * Requests FULL width (1024-d) and truncates locally with the same helper
 * Colab used, rather than passing `dimensions` and letting the API truncate
 * server-side — a second implementation of truncation is a second chance to
 * diverge from the corpus.
 */
export async function embedText(text: string, task: EmbedTask, signal: AbortSignal): Promise<number[]> {
  const r = await fetch(EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.JINA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.JINA_MODEL,
      input: [text],
      task,
      normalized: true,
    }),
    signal,
    // @ts-expect-error undici/node fetch accepts a custom agent
    agent,
  });
  if (!r.ok) throw new JinaError(r.status, await r.text());
  const json = (await r.json()) as { data: Array<{ embedding: number[] }> };
  const full = json.data[0].embedding;
  return matryoshka(full, Number(process.env.EMBED_DIM));
}

/** §4.4 asymmetry: only the `query` retrieval-unit strategy uses retrieval.query. Everything else is retrieval.passage. */
export async function embedQuery(text: string, signal: AbortSignal): Promise<number[]> {
  return embedText(text, "retrieval.query", signal);
}

/**
 * Same single API call as embedQuery, but also returns the pre-truncation
 * 1024-d vector — search.mts needs both (dense_256 for the wide stage,
 * dense_1024 for the rescore stage) and must not pay for two embed calls.
 */
export async function embedQueryBoth(text: string, signal: AbortSignal): Promise<{ full1024: number[]; truncated: number[] }> {
  const r = await fetch(EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.JINA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.JINA_MODEL,
      input: [text],
      task: "retrieval.query",
      normalized: true,
    }),
    signal,
    // @ts-expect-error undici/node fetch accepts a custom agent
    agent,
  });
  if (!r.ok) throw new JinaError(r.status, await r.text());
  const json = (await r.json()) as { data: Array<{ embedding: number[] }> };
  const raw = json.data[0].embedding;
  return { full1024: matryoshka(raw, 1024), truncated: matryoshka(raw, Number(process.env.EMBED_DIM)) };
}

export type RerankResult = { index: number; relevance_score: number };

/**
 * Jina rerank scores are NOT on the same scale as cosine similarity — never
 * compare a rerank score against TAU_GOOD/TAU_HIGH. See evaluateRerankGate
 * in lib/guardrails.ts, which uses the separate TAU_RERANK_PASS threshold.
 */
export async function rerank(
  query: string,
  documents: string[],
  topN: number,
  signal: AbortSignal,
): Promise<RerankResult[]> {
  const r = await fetch(RERANK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.JINA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.JINA_RERANK_MODEL,
      query,
      documents,
      top_n: topN,
    }),
    signal,
    // @ts-expect-error undici/node fetch accepts a custom agent
    agent,
  });
  if (!r.ok) throw new JinaError(r.status, await r.text());
  const json = (await r.json()) as { results: RerankResult[] };
  return json.results;
}
