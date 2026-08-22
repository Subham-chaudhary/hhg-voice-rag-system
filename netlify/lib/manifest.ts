/**
 * manifest.json is the artifact data_ingestion/ingest_msmarco.ipynb emits
 * (see §11 of the ingestion cell / manifest.json shape). Loaded at module
 * scope so a deploy that would have served garbage fails to boot instead of
 * failing silently at query time.
 *
 * Field names here intentionally match what the ingestion notebook actually
 * writes (model, revision, corpus_task, query_task, dims[], per_language,
 * ...) rather than the shorthand (`dim_primary`, `total_points`) sketched in
 * serverless.md §3.2 — those are derived below instead of assumed to exist
 * verbatim, since the two artifacts are produced by different phases of
 * this project and must be reconciled somewhere.
 */
import manifestJson from "../manifest.json" with { type: "json" };

export type Manifest = {
  model: string;
  revision: string;
  corpus_task: string;
  query_task: string;
  dims: number[];
  collection: string;
  dataset: string;
  timestamp: number;
  per_language: Record<string, { n_points: number; tier: string }>;
  tiers: Record<string, string[]>;
  projected_points: number;
};

function baseModelName(id: string): string {
  // "jinaai/jina-embeddings-v5-text-small" (HF repo id, used by Colab) and
  // "jina-embeddings-v5-text-small" (Jina API model id, used at query time)
  // name the same model family — compare the part after any "org/" prefix.
  return id.includes("/") ? id.split("/").pop()! : id;
}

export const manifest = manifestJson as Manifest;

export const totalPoints = Object.values(manifest.per_language ?? {}).reduce(
  (sum, l) => sum + (l.n_points ?? 0),
  0,
);

function assertManifest() {
  const jinaModel = process.env.JINA_MODEL ?? "";
  if (baseModelName(manifest.model) !== baseModelName(jinaModel)) {
    throw new Error(`manifest/env model mismatch: manifest="${manifest.model}" env JINA_MODEL="${jinaModel}"`);
  }

  const embedDim = Number(process.env.EMBED_DIM);
  if (!manifest.dims?.includes(embedDim)) {
    throw new Error(`manifest/env dim mismatch: manifest.dims=${JSON.stringify(manifest.dims)} env EMBED_DIM=${embedDim}`);
  }

  if (manifest.query_task !== "retrieval.query") {
    throw new Error(`manifest query_task mismatch: "${manifest.query_task}" !== "retrieval.query"`);
  }

  if (manifest.revision?.startsWith("PLACEHOLDER")) {
    console.warn(
      "[manifest] loaded a PLACEHOLDER manifest.json — replace netlify/manifest.json with the real " +
        "artifact from data_ingestion/ before relying on retrieval quality.",
    );
  }

  console.log(`[manifest] loaded revision=${manifest.revision} model=${manifest.model} dims=${manifest.dims}`);
}

assertManifest();
