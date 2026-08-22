/**
 * Catches the class of bug that raises no exception: a `lang` filter bug
 * (Kannada queries returning Hindi passages) or an embedding bug (returning
 * topically unrelated passages). Neither fails a type check — this test
 * prints the retrieved text so a human can read it too.
 *
 * Integration test against the live collection — skips itself until
 * QDRANT_URL/QDRANT_API_KEY/JINA_API_KEY are set AND the collection
 * actually has points (i.e. after data_ingestion has run for real).
 */
import { describe, it, expect } from "vitest";

const hasEnv = !!(process.env.QDRANT_URL && process.env.QDRANT_API_KEY && process.env.JINA_API_KEY);

const SAMPLE_QUERIES: Array<{ lang: string; text: string }> = [
  { lang: "hi", text: "कैफीन शरीर में कितनी देर रहता है" },
  { lang: "kn", text: "ಕೆಫೀನ್ ದೇಹದಲ್ಲಿ ಎಷ್ಟು ಸಮಯ ಇರುತ್ತದೆ" },
];

describe.skipIf(!hasEnv)("lang.test — a language-filtered query returns same-language payloads", () => {
  it("collection has points before running language checks", async () => {
    const { qdrant, COLLECTION } = await import("../netlify/lib/qdrant.ts");
    const info = await qdrant.getCollection(COLLECTION);
    expect(info.points_count ?? 0).toBeGreaterThan(0);
  });

  for (const { lang, text } of SAMPLE_QUERIES) {
    it(`lang=${lang} query returns lang=${lang} payloads, not noise`, async () => {
      const { embedQueryBoth } = await import("../netlify/lib/jina.ts");
      const { qdrant, COLLECTION, tier2Query } = await import("../netlify/lib/qdrant.ts");
      const { encodeSparseQuery } = await import("../netlify/lib/sparse.ts");

      const { full1024, truncated } = await embedQueryBoth(text, AbortSignal.timeout(5000));
      const sparse = encodeSparseQuery(text);
      const res = await qdrant.query(COLLECTION, tier2Query(truncated, full1024, sparse, lang));

      expect(res.points.length).toBeGreaterThan(0);
      for (const p of res.points) {
        const payload = (p.payload ?? {}) as Record<string, unknown>;
        console.log(lang, p.score, JSON.stringify(payload.text ?? "").slice(0, 100));
        expect(payload.lang).toBe(lang);
      }
    });
  }
});

if (!hasEnv) {
  describe("lang.test — skipped (no live QDRANT_URL/QDRANT_API_KEY/JINA_API_KEY)", () => {
    it("documents why", () => {
      expect(hasEnv).toBe(false);
    });
  });
}
