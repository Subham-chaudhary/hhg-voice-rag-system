/**
 * manifest.json is the artifact the real ingestion run (Colab notebook,
 * data_ingestion/ingest_msmarco.ipynb) emits. Loaded at module scope so a
 * deploy that would have served garbage fails to boot instead of failing
 * silently at query time.
 */
import manifestJson from "../manifest.json" with { type: "json" };

export type Manifest = {
  model: string; // HF repo id used by Colab's local .encode()
  api_model: string; // Jina API model id — must equal env JINA_MODEL exactly
  revision: string;
  task: string; // local .encode() task, e.g. "retrieval" (v5's shape — see lib/jina.ts's header comment)
  doc_prompt: string; // local .encode() prompt_name for corpus text
  query_prompt: string; // local .encode() prompt_name for queries
  dim_primary: number; // must equal env EMBED_DIM
  dim_rerank: number; // the untruncated rescore-stage width (dense_1024)
  normalized: boolean;
  truncation: string; // must be "slice_then_normalize" — see §1 of claude/ingestion.md and lib/jina.ts's matryoshka()
  collection: string;
  dataset: string;
  sparse: string; // "Qdrant/bm25" (fastembed's real BM25) or "regex_fallback" — see lib/sparse.ts
  total_points: number;
  languages: Record<string, number>;
  strategies: string[];
  timestamp: number;
  // Descriptive fields sometimes present, not required to exist:
  vectors?: Record<string, string>;
  language_note?: string;
  payload_fields?: string[];
  eval_only_fields?: string[];
};

export const manifest = manifestJson as Manifest;
export const totalPoints = manifest.total_points ?? 0;

function assertManifest() {
  const jinaModel = process.env.JINA_MODEL ?? "";
  if (manifest.api_model !== jinaModel) {
    throw new Error(`manifest/env model mismatch: manifest.api_model="${manifest.api_model}" env JINA_MODEL="${jinaModel}"`);
  }

  const embedDim = Number(process.env.EMBED_DIM);
  if (manifest.dim_primary !== embedDim) {
    throw new Error(`manifest/env dim mismatch: manifest.dim_primary=${manifest.dim_primary} env EMBED_DIM=${embedDim}`);
  }

  if (manifest.truncation !== "slice_then_normalize") {
    throw new Error(
      `manifest truncation order mismatch: "${manifest.truncation}" !== "slice_then_normalize" — the corpus ` +
        "may have been built with the normalize-then-slice bug §1 of claude/ingestion.md warns about.",
    );
  }

  if (!manifest.normalized) {
    throw new Error("manifest reports normalized: false — corpus vectors are not unit-normalized");
  }

  const qdrantCollection = process.env.QDRANT_COLLECTION;
  if (qdrantCollection && manifest.collection !== qdrantCollection) {
    throw new Error(
      `manifest/env collection mismatch: manifest.collection="${manifest.collection}" env QDRANT_COLLECTION="${qdrantCollection}"`,
    );
  }

  // lib/sparse.ts's query-time encoder always uses the regex+md5 fallback
  // scheme (there's no faithful JS port of fastembed's BM25 tokenizer) —
  // that only produces matching indices against a corpus built the same
  // way. A corpus built with real fastembed BM25 means sparse retrieval is
  // silently degraded (noise in the RRF fusion stage, not a crash).
  if (manifest.sparse && manifest.sparse !== "regex_fallback") {
    console.warn(
      `[manifest] corpus sparse vectors were built with "${manifest.sparse}", but lib/sparse.ts's query-time ` +
        "encoder always uses the regex+md5 fallback tokenizer — sparse/BM25 indices will NOT line up. Dense " +
        "retrieval is unaffected; the sparse contribution to tier-2 RRF fusion is degraded until this is reconciled.",
    );
  }

  if (manifest.revision?.startsWith("PLACEHOLDER")) {
    console.warn(
      "[manifest] loaded a PLACEHOLDER manifest.json — replace netlify/manifest.json with the real " +
        "artifact from data_ingestion/ before relying on retrieval quality.",
    );
  }

  console.log(
    `[manifest] loaded revision=${manifest.revision} model=${manifest.api_model} ` +
      `dim=${manifest.dim_primary}/${manifest.dim_rerank} points=${manifest.total_points} sparse=${manifest.sparse}`,
  );
}

assertManifest();
