/**
 * POST /api/search — the measured path. Imports lib/jina.ts and
 * lib/qdrant.ts DIRECTLY — never fetch()es its own /api/embed or
 * /api/rerank. This is the one path where latency is being measured; a
 * self-fetch would add a full extra round trip through Netlify's edge.
 *
 * search.mts never calls the LLM — that endpoint is a separate phase.
 */
import type { Config } from "@netlify/functions";
import { embedQueryBoth, rerank as jinaRerank } from "../lib/jina.ts";
import { qdrant, COLLECTION, tier1Query, tier2Query, filterFor } from "../lib/qdrant.ts";
import { encodeSparseQuery } from "../lib/sparse.ts";
import { checkQuery, evaluateGate, evaluateRerankGate, type ScoredCandidate } from "../lib/guardrails.ts";
import { SearchRequestSchema, type EvidenceItem } from "../lib/schemas.ts";
import { Budget, DEFAULT_BUDGET_MS } from "../lib/budget.ts";
import "../lib/manifest.ts"; // boot-time assertion

function toEvidence(c: ScoredCandidate): EvidenceItem {
  const p = c.payload as Record<string, unknown>;
  return {
    id: c.id,
    text: String((p.text as string) ?? (p.answer_text as string) ?? ""),
    score: c.score,
    strategy: String(p.strategy ?? (c.source === "tier1" ? "query" : "unknown")),
    lang: String(p.lang ?? ""),
    qid: p.qid ? String(p.qid) : undefined,
    pid: p.pid ? String(p.pid) : undefined,
    parent_id: p.parent_id ? String(p.parent_id) : null,
  };
}

const handler = async (req: Request): Promise<Response> => {
  const t0 = performance.now();
  const requestId = crypto.randomUUID();
  const timings: Record<string, number> = {};

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return respond(400, { status: "error", request_id: requestId, timings_ms: {} });
  }

  const parsed = SearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, { status: "error", request_id: requestId, timings_ms: {} });
  }
  const { transcript, language_code } = parsed.data;
  const requestIdOut = parsed.data.request_id ?? requestId;

  // --- pre-retrieval guardrail: zero API calls spent on garbage input ---
  const queryCheck = checkQuery(transcript);
  if (!queryCheck.ok) {
    return finish({ status: "refused", reason: queryCheck.reason, request_id: requestIdOut, timings_ms: finalTimings() });
  }

  // Establish TLS to Qdrant while Jina is still working. Fire and forget.
  void qdrant.getCollections().catch((err) => console.warn("[search] prewarm failed:", String(err)));

  const budget = new Budget(DEFAULT_BUDGET_MS);
  let degraded: string | null = null;
  let vec256: number[] | null = null;
  let vec1024: number[] | null = null;

  const embedStart = performance.now();
  try {
    const { full1024, truncated } = await embedQueryBoth(transcript, budget.signal(budget.take(3500, 3000)));
    vec1024 = full1024;
    vec256 = truncated;
  } catch (err) {
    degraded = "sparse_only";
    console.warn("[search] embed failed, degrading to sparse-only:", String(err));
  }
  timings.embed = round(performance.now() - embedStart);

  const sparse = encodeSparseQuery(transcript);

  const retrieveStart = performance.now();
  let tier1Hit: { id: string; score: number; payload: Record<string, unknown> } | null = null;
  let tier2Hits: Array<{ id: string; score: number; payload: Record<string, unknown> }> = [];

  try {
    if (vec256 && vec1024) {
      const [t1, t2] = await qdrant.queryBatch(COLLECTION, {
        searches: [tier1Query(vec256, language_code), tier2Query(vec256, vec1024, sparse, language_code)],
      });
      if (t1.points[0]) {
        tier1Hit = { id: String(t1.points[0].id), score: t1.points[0].score, payload: (t1.points[0].payload ?? {}) as Record<string, unknown> };
      }
      tier2Hits = t2.points.map((p) => ({ id: String(p.id), score: p.score, payload: (p.payload ?? {}) as Record<string, unknown> }));
    } else {
      // sparse-only degraded rung — no dense vector available, so no tier-1
      // fast path either (it requires dense_256). Sparse BM25 needs no embedding.
      const res = await qdrant.query(COLLECTION, {
        query: { indices: sparse.indices, values: sparse.values },
        using: "sparse_bm25",
        limit: 10,
        filter: filterFor({ lang: language_code }),
        with_payload: { include: ["text", "qid", "pid", "parent_id", "lang", "strategy"] },
        with_vector: false,
      });
      tier2Hits = res.points.map((p) => ({ id: String(p.id), score: p.score, payload: (p.payload ?? {}) as Record<string, unknown> }));
    }
  } catch (err) {
    // Degradation ladder: a failed full cascade falls back to a solo,
    // cheap tier-1 query rather than nothing, before abstaining outright.
    console.warn("[search] cascade failed, attempting tier-1-only fallback:", String(err));
    try {
      if (vec256) {
        const t1 = await qdrant.query(COLLECTION, tier1Query(vec256, language_code));
        if (t1.points[0]) {
          tier1Hit = { id: String(t1.points[0].id), score: t1.points[0].score, payload: (t1.points[0].payload ?? {}) as Record<string, unknown> };
        }
        degraded = degraded ?? "tier1_only";
      } else {
        throw err;
      }
    } catch (fallbackErr) {
      console.warn("[search] tier-1-only fallback also failed:", String(fallbackErr));
      timings.retrieve = round(performance.now() - retrieveStart);
      return finish({
        status: "error",
        reason: "qdrant_unreachable",
        request_id: requestIdOut,
        timings_ms: finalTimings(),
      });
    }
  }
  timings.retrieve = round(performance.now() - retrieveStart);

  const gateStart = performance.now();
  const gate = evaluateGate(tier1Hit, tier2Hits);
  timings.gate = round(performance.now() - gateStart);

  if (gate.action === "early_exit") {
    const top = gate.evidence[0];
    return finish({
      status: "answered",
      answer: String(top.payload.answer_text ?? top.payload.text ?? ""),
      evidence: gate.evidence.slice(0, 3).map(toEvidence),
      early_exit: true,
      reranked: false,
      degraded,
      confidence: gate.confidence,
      request_id: requestIdOut,
      timings_ms: finalTimings(),
    });
  }

  if (gate.action === "proceed") {
    return finish({
      status: "ok",
      evidence: gate.evidence.map(toEvidence),
      early_exit: false,
      reranked: false,
      degraded,
      confidence: gate.confidence,
      request_id: requestIdOut,
      timings_ms: finalTimings(),
    });
  }

  if (gate.action === "abstain") {
    return finish({
      status: "abstained",
      reason: gate.reason,
      evidence: gate.evidence.slice(0, 3).map(toEvidence),
      early_exit: false,
      reranked: false,
      degraded,
      confidence: gate.confidence,
      request_id: requestIdOut,
      timings_ms: finalTimings(),
    });
  }

  // action === "rerank" — the genuinely ambiguous middle band
  const rerankCandidates = gate.evidence.slice(0, 10);
  const rerankBudgetOk = budget.left() > 800; // enough for a rerank call + response serialization
  if (!rerankBudgetOk) {
    return finish({
      status: "ok",
      evidence: rerankCandidates.map(toEvidence),
      early_exit: false,
      reranked: false,
      degraded: degraded ?? "budget_exhausted",
      confidence: gate.confidence,
      request_id: requestIdOut,
      timings_ms: finalTimings(),
    });
  }

  const rerankStart = performance.now();
  try {
    const docs = rerankCandidates.map((c) => String(c.payload.text ?? ""));
    const rerankMs = budget.take(2500, 300);
    const results = await jinaRerank(transcript, docs, docs.length, budget.signal(rerankMs));
    timings.rerank = round(performance.now() - rerankStart);

    const ordered = results
      .slice()
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .map((r) => rerankCandidates[r.index]);
    const topRerankScore = results.length ? Math.max(...results.map((r) => r.relevance_score)) : 0;
    const rerankGate = evaluateRerankGate(topRerankScore);

    return finish({
      status: rerankGate.ok ? "ok" : "abstained",
      evidence: ordered.map(toEvidence),
      early_exit: false,
      reranked: true,
      degraded,
      confidence: topRerankScore,
      request_id: requestIdOut,
      timings_ms: finalTimings(),
    });
  } catch (err) {
    // Rerank failed/timed out — use the pre-rerank order rather than nothing.
    timings.rerank = round(performance.now() - rerankStart);
    console.warn("[search] rerank failed, using pre-rerank order:", String(err));
    return finish({
      status: "ok",
      evidence: rerankCandidates.map(toEvidence),
      early_exit: false,
      reranked: false,
      degraded: "rerank_failed",
      confidence: gate.confidence,
      request_id: requestIdOut,
      timings_ms: finalTimings(),
    });
  }

  // --- helpers closing over t0/timings/requestIdOut ---
  function finalTimings() {
    timings.rag_core = round(performance.now() - t0);
    return { ...timings };
  }

  function finish(payload: Record<string, unknown>): Response {
    log({ request_id: requestIdOut, fn: "search", status: payload.status, timings_ms: payload.timings_ms, degraded: payload.degraded ?? null });
    return respond(200, payload);
  }
};

export default handler;

function round(ms: number) {
  return Math.round(ms * 10) / 10;
}

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function log(line: Record<string, unknown>) {
  console.log(JSON.stringify(line));
}

export const config: Config = { path: "/api/search" };
