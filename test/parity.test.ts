/**
 * THE build gate for lib/jina.ts. If this fails, the API revision and the
 * Colab revision have diverged, or the truncation order differs. Do NOT
 * "fix" it by lowering the 0.999 threshold — every query would then return
 * confident, plausible, wrong results with nothing logging a warning. This
 * is the single worst failure mode in the system because it is invisible.
 *
 * Skips itself until test/fixtures/parity_vectors.json has real entries
 * (written by data_ingestion/ingest_msmarco.ipynb) and JINA_API_KEY is set
 * — there is nothing to compare against before ingestion has run.
 */
import { describe, it, expect } from "vitest";
import { embedQuery } from "../netlify/lib/jina.ts";
import fixturesFile from "./fixtures/parity_vectors.json" with { type: "json" };

const fixtures = (fixturesFile as { fixtures: Array<{ text: string; expected: number[] }> }).fixtures;
const hasKey = !!process.env.JINA_API_KEY;

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // both sides are already L2-normalized, so dot product == cosine
}

describe.skipIf(fixtures.length === 0 || !hasKey)("parity.test — API vs Colab vectors (blocking)", () => {
  for (const { text, expected } of fixtures) {
    it(`cosine(api, colab) > 0.999 for "${text.slice(0, 30)}..."`, async () => {
      const got = await embedQuery(text, AbortSignal.timeout(5000));
      expect(cosine(got, expected)).toBeGreaterThan(0.999);
    });
  }
});

if (fixtures.length === 0 || !hasKey) {
  describe("parity.test — skipped", () => {
    it("documents why", () => {
      expect(fixtures.length === 0 || !hasKey).toBe(true);
    });
  });
}
