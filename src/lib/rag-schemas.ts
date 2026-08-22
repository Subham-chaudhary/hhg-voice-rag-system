/**
 * zod schemas mirroring netlify/functions' response contracts. Deliberately
 * NOT imported from netlify/lib/schemas.ts — that package is bundled into
 * the serverless functions, and pulling it into the browser bundle would
 * blur the boundary integrate.md draws between "function code" and "client
 * code". Kept in sync by hand; a shape drift here should surface as a loud
 * zod parse error in rag-client.ts, not as `undefined.map is not a
 * function` inside a component.
 */
import { z } from "zod";

export const TimingsMsSchema = z.record(z.string(), z.number());

export const SttResponseSchema = z.object({
  status: z.enum(["ok", "error"]),
  transcript: z.string().optional(),
  language_code: z.string().optional(),
  request_id: z.string(),
  timings_ms: TimingsMsSchema,
  error: z.string().optional(),
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
  timings_ms: TimingsMsSchema,
});

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
  timings_ms: TimingsMsSchema,
});

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
  timings_ms: TimingsMsSchema,
  error: z.string().optional(),
});
