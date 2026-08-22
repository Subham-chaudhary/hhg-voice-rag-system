/**
 * GET /fn/samples — random real indexed queries, spread across languages,
 * for the console's "Try one" preset row. Deliberately NOT built on
 * Qdrant's native `query: {sample: "random"}` (added in server 1.11 —
 * unconfirmed whether the Free-tier cluster in use is on that version or
 * newer, and whether the pinned client's types expose it cleanly). Instead:
 * one `scroll()` per language at cold start (cheap, filtered on
 * strategy="query", zero Jina/Sarvam calls), cached at module scope, with
 * the actual randomness done in-process via Math.random() on each request.
 * Fully version-independent — the one part of this whole system explicitly
 * built to have the fewest possible failure modes.
 */
import type { Config } from "@netlify/functions";
import { qdrant, COLLECTION, filterFor } from "../lib/qdrant.ts";
import { manifest } from "../lib/manifest.ts";

const POOL_SIZE_PER_LANG = 20;
const CACHE_TTL_MS = 60 * 60 * 1000; // corpus is static — this is a staleness safety net, not a freshness need
const SAMPLE_COUNT = 5;

type PoolItem = { transcript: string; qid?: string };
type Pool = Record<string, PoolItem[]>;

let cache: { pool: Pool; at: number } | null = null;

async function poolForLang(lang: string): Promise<PoolItem[]> {
  try {
    const res = await qdrant.scroll(COLLECTION, {
      filter: filterFor({ strategy: "query", lang }),
      limit: POOL_SIZE_PER_LANG,
      with_payload: { include: ["query_text", "qid"] },
      with_vector: false,
    });
    const items: PoolItem[] = [];
    for (const p of res.points) {
      const payload = (p.payload ?? {}) as Record<string, unknown>;
      const transcript = payload.query_text;
      if (typeof transcript === "string" && transcript.trim()) {
        items.push({ transcript, qid: payload.qid ? String(payload.qid) : undefined });
      }
    }
    return items;
  } catch (err) {
    console.warn(`[samples] scroll failed for lang=${lang}:`, String(err));
    return [];
  }
}

async function buildPool(): Promise<Pool> {
  const langs = Object.keys(manifest.languages);
  const pool: Pool = {};
  await Promise.all(
    langs.map(async (lang) => {
      pool[lang] = await poolForLang(lang);
    }),
  );
  return pool;
}

async function getPool(): Promise<Pool> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.pool;
  const pool = await buildPool();
  cache = { pool, at: Date.now() };
  return pool;
}

function pickRandom<T>(arr: T[]): T | undefined {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Prefers one sample per distinct language before filling any remaining slots. */
function pickSamples(pool: Pool, n: number): Array<PoolItem & { language: string }> {
  const langs = shuffle(Object.keys(pool).filter((l) => pool[l].length > 0));
  const picked: Array<PoolItem & { language: string }> = [];

  for (const lang of langs) {
    if (picked.length >= n) break;
    const item = pickRandom(pool[lang]);
    if (item) picked.push({ ...item, language: lang });
  }

  let guard = 0;
  while (picked.length < n && langs.length > 0 && guard < 50) {
    guard++;
    const lang = langs[Math.floor(Math.random() * langs.length)];
    const item = pickRandom(pool[lang]);
    if (item && !picked.some((p) => p.transcript === item.transcript)) {
      picked.push({ ...item, language: lang });
    }
  }

  return picked;
}

const handler = async (): Promise<Response> => {
  const t0 = performance.now();
  const requestId = crypto.randomUUID();

  try {
    const pool = await getPool();
    const picked = pickSamples(pool, SAMPLE_COUNT);
    const samples = picked.map((s, i) => ({
      id: `sample-${requestId}-${i}`,
      transcript: s.transcript,
      language: s.language,
      qid: s.qid,
    }));

    const timings_ms = { total: round(performance.now() - t0) };
    log({ request_id: requestId, fn: "samples", status: "ok", timings_ms, degraded: null, count: samples.length });
    return json(200, { status: "ok", samples, request_id: requestId, timings_ms });
  } catch (err) {
    const timings_ms = { total: round(performance.now() - t0) };
    log({ request_id: requestId, fn: "samples", status: "error", timings_ms, degraded: null, error: String(err) });
    return json(200, { status: "error", error: String(err), request_id: requestId, timings_ms });
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

export const config: Config = { path: "/fn/samples" };
