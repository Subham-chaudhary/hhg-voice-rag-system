/**
 * zod contracts for every request/response. Every function validates its
 * input against one of these and returns 400 with the parse error on failure.
 */
import { z } from "zod";

export const RequestIdSchema = z.string().uuid().optional();

export const TimingsSchema = z.record(z.string(), z.number());

// ---------------------------------------------------------------------------
// /fn/stt
// ---------------------------------------------------------------------------

export const SttFieldsSchema = z.object({
  language_code: z.string().min(2).max(16).optional(),
  request_id: z.string().uuid().optional(),
});

export const SttResponseSchema = z.object({
  status: z.enum(["ok", "error"]),
  transcript: z.string().optional(),
  language_code: z.string().optional(),
  request_id: z.string(),
  timings_ms: TimingsSchema,
  error: z.string().optional(),
});

// ---------------------------------------------------------------------------
// /fn/embed
// ---------------------------------------------------------------------------

export const EmbedRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  task: z.enum(["retrieval.query", "retrieval.passage"]).default("retrieval.query"),
  request_id: z.string().uuid().optional(),
});

export const EmbedResponseSchema = z.object({
  status: z.enum(["ok", "error"]),
  vector: z.array(z.number()).optional(),
  dim: z.number().optional(),
  request_id: z.string(),
  timings_ms: TimingsSchema,
  error: z.string().optional(),
});

// ---------------------------------------------------------------------------
// /fn/rerank
// ---------------------------------------------------------------------------

export const RerankRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  documents: z.array(z.string().min(1)).min(1).max(100),
  top_n: z.number().int().positive().max(100).optional(),
  request_id: z.string().uuid().optional(),
});

export const RerankResultSchema = z.object({
  index: z.number().int(),
  relevance_score: z.number(),
});

export const RerankResponseSchema = z.object({
  status: z.enum(["ok", "error"]),
  results: z.array(RerankResultSchema).optional(),
  request_id: z.string(),
  timings_ms: TimingsSchema,
  error: z.string().optional(),
});

// ---------------------------------------------------------------------------
// /fn/search — the measured path
// ---------------------------------------------------------------------------

export const SearchRequestSchema = z.object({
  transcript: z.string().min(1).max(2000),
  language_code: z.string().min(2).max(16).optional(),
  request_id: z.string().uuid().optional(),
});

export const EvidenceItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  score: z.number(),
  strategy: z.string(),
  lang: z.string(),
  qid: z.string().optional(),
  pid: z.string().optional(),
  parent_id: z.string().nullable().optional(),
});

export const SearchStatusSchema = z.enum(["answered", "ok", "abstained", "refused", "error"]);

export const SearchResponseSchema = z.object({
  status: SearchStatusSchema,
  answer: z.string().optional(),
  evidence: z.array(EvidenceItemSchema).optional(),
  early_exit: z.boolean().optional(),
  reranked: z.boolean().optional(),
  degraded: z.string().nullable().optional(),
  confidence: z.number().optional(),
  reason: z.string().optional(),
  request_id: z.string(),
  timings_ms: TimingsSchema,
});

// ---------------------------------------------------------------------------
// /fn/health
// ---------------------------------------------------------------------------

export const DependencyStatusSchema = z.object({
  ok: z.boolean(),
  latency_ms: z.number().optional(),
  error: z.string().optional(),
});

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  jina: DependencyStatusSchema,
  qdrant: DependencyStatusSchema,
  sarvam: DependencyStatusSchema,
  manifest_revision: z.string().optional(),
  points_count: z.number().optional(),
  points_count_expected: z.number().optional(),
  points_count_mismatch: z.boolean().optional(),
  request_id: z.string(),
  timings_ms: TimingsSchema,
});

// ---------------------------------------------------------------------------
// /fn/samples — random real indexed queries for the "Try one" preset row
// ---------------------------------------------------------------------------

export const SampleItemSchema = z.object({
  id: z.string(),
  transcript: z.string(),
  language: z.string(),
  qid: z.string().optional(),
});

export const SamplesResponseSchema = z.object({
  status: z.enum(["ok", "error"]),
  samples: z.array(SampleItemSchema).optional(),
  request_id: z.string(),
  timings_ms: TimingsSchema,
  error: z.string().optional(),
});

export type SampleItem = z.infer<typeof SampleItemSchema>;
export type SamplesResponse = z.infer<typeof SamplesResponseSchema>;

export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type EmbedRequest = z.infer<typeof EmbedRequestSchema>;
export type RerankRequest = z.infer<typeof RerankRequestSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
