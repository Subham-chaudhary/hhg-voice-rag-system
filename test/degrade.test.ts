/**
 * Full end-to-end proof of the degradation ladder is the manual demo
 * described in serverless.md §6: unset JINA_API_KEY on the deployed site,
 * curl /api/search, confirm evidence still comes back with
 * degraded: "sparse_only". That requires a live Qdrant collection and isn't
 * reproducible in a unit test.
 *
 * What IS unit-testable, and is the actual mechanism the sparse-only rung
 * depends on: (1) the sparse encoder needs no embedding call at all, and
 * (2) a broken/missing Jina key makes embedQueryBoth fail loudly rather
 * than silently — which is exactly the signal search.mts's try/catch uses
 * to flip degraded = "sparse_only".
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { encodeSparseQuery } from "../netlify/lib/sparse.ts";
import { embedQueryBoth } from "../netlify/lib/jina.ts";

describe("degrade.test — sparse-only path needs no embedding call", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("encodeSparseQuery produces non-empty term indices with zero network calls", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const sparse = encodeSparseQuery("caffeine absorption rate in the body");
    expect(sparse.indices.length).toBeGreaterThan(0);
    expect(sparse.indices.length).toBe(sparse.values.length);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("encodeSparseQuery tokenizes Devanagari script (non-zero terms)", () => {
    const sparse = encodeSparseQuery("कैफीन शरीर में कितनी देर रहता है");
    expect(sparse.indices.length).toBeGreaterThan(3);
  });

  it("embedQueryBoth throws when the Jina API is unreachable/unauthorized (the signal search.mts degrades on)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("unauthorized", { status: 401 }) as unknown as Response,
    );
    await expect(embedQueryBoth("test query", AbortSignal.timeout(1000))).rejects.toThrow();
  });
});
