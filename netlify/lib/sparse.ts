/**
 * Query-time BM25-style sparse vector encoder.
 *
 * Not listed as a separate lib in serverless.md, but §3.4/§6.4 require a
 * `sparse: SparseVec` for the tier-2 cascade and the spec never actually
 * says how the runtime produces it — only how the ingestion side does
 * (fastembed's `Qdrant/bm25`, with a regex+hash fallback if Indic
 * tokenization turns out degenerate, per ingestion §6.4).
 *
 * There is no faithful JS port of fastembed's BM25 tokenizer, so
 * reproducing it bit-for-bit at query time (needed for the sparse indices
 * to line up with what was indexed) is not reliable. Instead this uses the
 * SAME deterministic regex+md5 fallback scheme on both sides — see
 * data_ingestion/ingest_msmarco.ipynb's `sparse_fallback()` — so corpus and
 * query sparse vectors are guaranteed to tokenize identically regardless of
 * which BM25 path ingestion actually took. IDF is still computed
 * corpus-wide by Qdrant's `modifier: IDF` on the collection; this only
 * needs to emit matching (index, term-frequency) pairs.
 *
 * If a future ingestion run keeps fastembed's BM25 for the corpus, this
 * must be revisited — the indices would not match.
 */
import { createHash } from "node:crypto";

const TOKEN_RE = /[\p{L}\p{N}]+/gu;

function hashToken(token: string): number {
  const hex = createHash("md5").update(token).digest("hex").slice(0, 8);
  return parseInt(hex, 16);
}

export type SparseVec = { indices: number[]; values: number[] };

export function encodeSparseQuery(text: string): SparseVec {
  const counts = new Map<number, number>();
  for (const match of text.toLowerCase().matchAll(TOKEN_RE)) {
    const h = hashToken(match[0]);
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  return {
    indices: [...counts.keys()],
    values: [...counts.values()].map(Number),
  };
}
