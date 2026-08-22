import { z } from "zod";
import {
  SttResponseSchema,
  SearchResponseSchema,
  SearchStatusSchema,
  EvidenceItemSchema,
  HealthResponseSchema,
} from "./rag-schemas";

export type SttResponse = z.infer<typeof SttResponseSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type SearchStatus = z.infer<typeof SearchStatusSchema>;
export type Evidence = z.infer<typeof EvidenceItemSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const KNOWN_DEGRADED_REASONS = [
  "sparse_only",
  "tier1_only",
  "rerank_failed",
  "budget_exhausted",
] as const;

export type DegradedReason = (typeof KNOWN_DEGRADED_REASONS)[number];

export const LANGUAGE_NAME: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  mr: "Marathi",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  or: "Odia",
  as: "Assamese",
  ne: "Nepali",
  sa: "Sanskrit",
  ur: "Urdu",
  kok: "Konkani",
  unknown: "Auto-detected",
};

export function languageName(code: string | undefined): string {
  if (!code) return "Unknown";
  return LANGUAGE_NAME[code] ?? code.toUpperCase();
}
