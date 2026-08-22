/**
 * Module-scope Qdrant client (read-only, safe to reuse across warm
 * invocations) plus the two cascade query builders, sent together in one
 * queryBatch call from search.mts.
 *
 * Pinned @qdrant/js-client-rest@1.19.0 (current as of 2026-08-22). Nested
 * prefetch — a prefetch stage whose own query is an RRF fusion of two inner
 * prefetch stages, rescored by an outer full-precision query — is Qdrant's
 * documented multi-stage query pattern and is supported by this client and
 * server version; no need to split into two round trips.
 */
import { QdrantClient, type Schemas } from "@qdrant/js-client-rest";
import type { SparseVec } from "./sparse.ts";

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY!,
  timeout: 5000,
});

export const COLLECTION = process.env.QDRANT_COLLECTION ?? "msmarco_xi";

type FilterOpts = { strategy?: string; lang?: string };

/** Never send an empty Filter object — Qdrant treats that differently from "no filter". */
export function filterFor(opts: FilterOpts): Schemas["Filter"] | undefined {
  const must: Schemas["Condition"][] = [];
  if (opts.strategy) must.push({ key: "strategy", match: { value: opts.strategy } });
  if (opts.lang) must.push({ key: "lang", match: { value: opts.lang } });
  return must.length ? { must } : undefined;
}

const PAYLOAD_INCLUDE_TIER1 = ["text", "query_text", "answer_text", "qid", "lang"];
const PAYLOAD_INCLUDE_TIER2 = ["text", "qid", "pid", "parent_id", "lang", "strategy"];

/** TIER 1 — the query-index fast path. Cheap: limit 1, low ef. */
export function tier1Query(vec256: number[], lang?: string): Schemas["QueryRequest"] {
  return {
    query: vec256,
    using: "dense_256",
    limit: 1,
    filter: filterFor({ strategy: "query", lang }),
    params: { hnsw_ef: 16 },
    with_payload: { include: PAYLOAD_INCLUDE_TIER1 },
    with_vector: false,
  };
}

/**
 * TIER 2 — wide cheap retrieval (dense_256 + sparse_bm25), RRF fusion, then
 * a full-precision dense_1024 rescore of the fused survivors. All
 * server-side, one round trip. `with_vector` is always false — vectors never
 * ship back over the wire. `is_gold` is never filtered on here — it exists
 * in the payload for evaluation only.
 */
export function tier2Query(vec256: number[], vec1024: number[], sparse: SparseVec, lang?: string): Schemas["QueryRequest"] {
  return {
    prefetch: [
      {
        prefetch: [
          {
            query: vec256,
            using: "dense_256",
            limit: 200,
            params: { hnsw_ef: 32, quantization: { rescore: false } },
            filter: filterFor({ lang }),
          },
          {
            query: { indices: sparse.indices, values: sparse.values },
            using: "sparse_bm25",
            limit: 200,
            filter: filterFor({ lang }),
          },
        ],
        query: { fusion: "rrf" },
        limit: 60,
      },
    ],
    query: vec1024,
    using: "dense_1024",
    limit: 10,
    with_payload: { include: PAYLOAD_INCLUDE_TIER2 },
    with_vector: false,
  };
}

export async function runCascade(vec256: number[], vec1024: number[], sparse: SparseVec, lang?: string) {
  const [tier1Res, tier2Res] = await qdrant.queryBatch(COLLECTION, {
    searches: [tier1Query(vec256, lang), tier2Query(vec256, vec1024, sparse, lang)],
  });
  return { tier1: tier1Res.points, tier2: tier2Res.points };
}
