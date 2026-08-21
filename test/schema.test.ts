import { describe, it, expect } from "vitest";
import {
  SearchRequestSchema,
  SearchResponseSchema,
  EmbedRequestSchema,
  EmbedResponseSchema,
  RerankRequestSchema,
  RerankResponseSchema,
  SttResponseSchema,
  HealthResponseSchema,
} from "../netlify/lib/schemas.ts";

describe("schema.test — every response shape validates against its zod schema", () => {
  it("SearchRequestSchema accepts the documented request", () => {
    expect(SearchRequestSchema.safeParse({ transcript: "how long does caffeine last", language_code: "en-IN" }).success).toBe(true);
  });

  it("SearchRequestSchema rejects an empty transcript", () => {
    expect(SearchRequestSchema.safeParse({ transcript: "" }).success).toBe(false);
  });

  it("SearchResponseSchema validates an 'answered' response", () => {
    const res = SearchResponseSchema.safeParse({
      status: "answered",
      answer: "Caffeine is absorbed within about forty-five minutes.",
      evidence: [{ id: "abc", text: "...", score: 0.94, strategy: "query", lang: "en", qid: "q1" }],
      early_exit: true,
      reranked: false,
      degraded: null,
      confidence: 0.94,
      request_id: "11111111-1111-1111-1111-111111111111",
      timings_ms: { embed: 180, retrieve: 8, gate: 1, rag_core: 190 },
    });
    expect(res.success).toBe(true);
  });

  it("SearchResponseSchema validates a 'refused' response with no evidence", () => {
    const res = SearchResponseSchema.safeParse({
      status: "refused",
      reason: "too_short",
      request_id: "11111111-1111-1111-1111-111111111111",
      timings_ms: {},
    });
    expect(res.success).toBe(true);
  });

  it("EmbedRequestSchema / EmbedResponseSchema round-trip", () => {
    expect(EmbedRequestSchema.safeParse({ text: "मुझे बताओ" }).success).toBe(true);
    expect(
      EmbedResponseSchema.safeParse({
        status: "ok",
        vector: Array(256).fill(0.01),
        dim: 256,
        request_id: "11111111-1111-1111-1111-111111111111",
        timings_ms: { embed: 120 },
      }).success,
    ).toBe(true);
  });

  it("RerankRequestSchema / RerankResponseSchema round-trip", () => {
    expect(RerankRequestSchema.safeParse({ query: "q", documents: ["a", "b"], top_n: 2 }).success).toBe(true);
    expect(
      RerankResponseSchema.safeParse({
        status: "ok",
        results: [{ index: 1, relevance_score: 0.9 }],
        request_id: "11111111-1111-1111-1111-111111111111",
        timings_ms: { rerank: 200 },
      }).success,
    ).toBe(true);
  });

  it("SttResponseSchema validates a successful transcription", () => {
    expect(
      SttResponseSchema.safeParse({
        status: "ok",
        transcript: "नमस्ते",
        language_code: "hi-IN",
        request_id: "11111111-1111-1111-1111-111111111111",
        timings_ms: { stt: 412 },
      }).success,
    ).toBe(true);
  });

  it("HealthResponseSchema validates a healthy response", () => {
    expect(
      HealthResponseSchema.safeParse({
        status: "ok",
        jina: { ok: true, latency_ms: 90 },
        qdrant: { ok: true, latency_ms: 12 },
        sarvam: { ok: true, latency_ms: 40 },
        manifest_revision: "abc123",
        points_count: 290000,
        points_count_expected: 290000,
        points_count_mismatch: false,
        request_id: "11111111-1111-1111-1111-111111111111",
        timings_ms: { total: 95 },
      }).success,
    ).toBe(true);
  });
});
