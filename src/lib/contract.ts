export type QueryStatus = "answered" | "refused" | "error";

export type StageKey =
  | "stt"
  | "validate"
  | "embed"
  | "retrieve"
  | "rank"
  | "generate"
  | "ground";

export const RAG_CORE_STAGES: StageKey[] = [
  "validate",
  "embed",
  "retrieve",
  "rank",
  "generate",
  "ground",
];

export const ALL_STAGES: StageKey[] = ["stt", ...RAG_CORE_STAGES];

export const STAGE_LABEL: Record<StageKey, string> = {
  stt: "Speech-to-text",
  validate: "Validate",
  embed: "Embed",
  retrieve: "Retrieve",
  rank: "Rank & fuse",
  generate: "Generate",
  ground: "Grounding",
};

export const STAGE_DETAIL: Record<StageKey, string> = {
  stt: "Sarvam transcription and language detection",
  validate: "Normalisation, safety and off-topic screening",
  embed: "multilingual-e5 query vector",
  retrieve: "Qdrant hybrid dense + sparse",
  rank: "RRF fusion, diversity, confidence gate",
  generate: "Grounded answer, capped output",
  ground: "Evidence verification and serialisation",
};

export const STAGE_COLOR: Record<StageKey, string> = {
  stt: "var(--stage-1)",
  validate: "var(--stage-2)",
  embed: "var(--stage-3)",
  retrieve: "var(--stage-4)",
  rank: "var(--stage-5)",
  generate: "var(--stage-6)",
  ground: "var(--stage-7)",
};

export const RAG_CORE_BUDGET_MS = 200;

export type ChunkRepresentation =
  | "atomic"
  | "sentence_window"
  | "semantic"
  | "parent_child"
  | "metadata"
  | "query_enriched"
  | "cross_lingual"
  | "unknown";

export const REPRESENTATION_LABEL: Record<ChunkRepresentation, string> = {
  atomic: "A · Atomic passage",
  sentence_window: "B · Sentence window",
  semantic: "C · Semantic",
  parent_child: "D · Parent-child",
  metadata: "E · Metadata-aware",
  query_enriched: "F · Query-enriched",
  cross_lingual: "G · Cross-lingual twin",
  unknown: "Unlabelled",
};

export interface LatencyBreakdown {
  stt?: number;
  validate?: number;
  embed?: number;
  retrieve?: number;
  rank?: number;
  generate?: number;
  ground?: number;
  rag_core: number;
  voice_e2e?: number;
}

export interface Evidence {
  id: string;
  text: string;
  score: number;
  language?: string;
  parentId?: string | null;
  parentText?: string | null;
  representation: ChunkRepresentation;
  denseScore?: number;
  sparseScore?: number;
  rrfScore?: number;
  rank?: number;
  queryId?: string | number;
  passageRank?: number;
  cited: boolean;
}

export interface QueryResult {
  status: QueryStatus;
  answer: string;
  transcript: string;
  language: string;
  languageName: string;
  confidence: number;
  threshold: number | null;
  evidence: Evidence[];
  evidenceIds: string[];
  latency: LatencyBreakdown;
  refusalReason: string | null;
  refusalCode: RefusalCode | null;
  fallback: "extractive" | "cached" | null;
  traceId: string | null;
  model: string | null;
  source: "live" | "mock";
  receivedAt: number;
}

export type RefusalCode =
  | "insufficient_evidence"
  | "off_topic"
  | "unsafe_input"
  | "empty_or_unintelligible"
  | "ungrounded_answer";

export const REFUSAL_COPY: Record<RefusalCode, { title: string; body: string }> = {
  insufficient_evidence: {
    title: "Below the horizon",
    body: "Retrieval returned passages, but none cleared the confidence gate. Answering from them would mean guessing.",
  },
  off_topic: {
    title: "Outside the corpus",
    body: "This question falls outside the MSMARCO-XI corpus. Zenith only answers from indexed evidence.",
  },
  unsafe_input: {
    title: "Blocked before retrieval",
    body: "The safety filter rejected this input. It never reached the index or the model.",
  },
  empty_or_unintelligible: {
    title: "Nothing to work with",
    body: "No usable speech was detected in the audio. Try again, closer to the microphone.",
  },
  ungrounded_answer: {
    title: "Answer failed grounding",
    body: "A draft answer was produced but at least one claim could not be traced to retrieved evidence, so it was discarded.",
  },
};

export interface BenchmarkPercentiles {
  p50: number;
  p70: number;
  p100: number;
  mean: number;
  stddev: number;
}

export interface BenchmarkRun {
  label: string;
  commit: string | null;
  measuredAt: string | null;
  queryCount: number;
  warmups: number;
  repeats: number;
  timeouts: number;
  errors: number;
  ragCore: BenchmarkPercentiles;
  voiceE2E: BenchmarkPercentiles | null;
  stageMedians: Partial<Record<StageKey, number>>;
  samples: number[];
  voiceSamples: number[];
  byLanguage: { language: string; count: number; p50: number; p100: number }[];
  isPlaceholder: boolean;
}
