import {
  ALL_STAGES,
  CORE_KEYS,
  ChunkRepresentation,
  CoreInfo,
  Evidence,
  LatencyBreakdown,
  QueryResult,
  QueryStatus,
  RefusalCode,
  StageKey,
} from "./contract";

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
  unknown: "Auto-detected",
};

type Raw = Record<string, unknown>;

function isObject(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick(source: Raw, ...keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
    const snake = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    if (source[snake] !== undefined && source[snake] !== null) return source[snake];
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (source[camel] !== undefined && source[camel] !== null) return source[camel];
  }
  return undefined;
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normaliseStatus(value: unknown, hasAnswer: boolean): QueryStatus {
  const raw = asString(value).toLowerCase();
  if (["refused", "refuse", "rejected", "no_answer", "abstain", "abstained"].includes(raw)) {
    return "refused";
  }
  if (["error", "failed", "failure", "timeout"].includes(raw)) return "error";
  if (["answered", "ok", "success", "answer", "grounded"].includes(raw)) return "answered";
  return hasAnswer ? "answered" : "refused";
}

const REFUSAL_ALIASES: Record<string, RefusalCode> = {
  insufficient_evidence: "insufficient_evidence",
  low_confidence: "insufficient_evidence",
  no_evidence: "insufficient_evidence",
  below_threshold: "insufficient_evidence",
  off_topic: "off_topic",
  ood: "off_topic",
  out_of_domain: "off_topic",
  out_of_scope: "off_topic",
  unsafe: "unsafe_input",
  unsafe_input: "unsafe_input",
  blocked: "unsafe_input",
  safety: "unsafe_input",
  empty: "empty_or_unintelligible",
  empty_audio: "empty_or_unintelligible",
  invalid_or_off_topic: "off_topic",
  unintelligible: "empty_or_unintelligible",
  ungrounded: "ungrounded_answer",
  ungrounded_answer: "ungrounded_answer",
  grounding_failed: "ungrounded_answer",
};

function normaliseRefusal(value: unknown): RefusalCode | null {
  const raw = asString(value).toLowerCase().trim();
  if (!raw) return null;
  if (REFUSAL_ALIASES[raw]) return REFUSAL_ALIASES[raw];
  for (const [alias, code] of Object.entries(REFUSAL_ALIASES)) {
    if (raw.includes(alias)) return code;
  }
  return "insufficient_evidence";
}

const REPRESENTATION_ALIASES: Record<string, ChunkRepresentation> = {
  a: "atomic",
  atomic: "atomic",
  passage: "atomic",
  atomic_passage: "atomic",
  b: "sentence_window",
  sentence: "sentence_window",
  sentence_window: "sentence_window",
  window: "sentence_window",
  c: "semantic",
  semantic: "semantic",
  d: "parent_child",
  parent_child: "parent_child",
  child: "parent_child",
  parent: "parent_child",
  e: "metadata",
  metadata: "metadata",
  metadata_aware: "metadata",
  f: "query_enriched",
  query_enriched: "query_enriched",
  enriched: "query_enriched",
  g: "cross_lingual",
  cross_lingual: "cross_lingual",
  twin: "cross_lingual",
  bilingual: "cross_lingual",
};

function normaliseRepresentation(value: unknown): ChunkRepresentation {
  const raw = asString(value).toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (!raw) return "unknown";
  return REPRESENTATION_ALIASES[raw] ?? "unknown";
}

function normaliseLatency(source: Raw): LatencyBreakdown {
  const container = (pick(source, "latency_ms", "latencies", "timings", "timing", "latency") ??
    source) as Raw;
  const bag = isObject(container) ? container : {};

  const stages: Partial<Record<StageKey, number>> = {};
  const aliases: Record<StageKey, string[]> = {
    stt: ["stt", "transcribe", "transcription", "asr", "speech_to_text"],
    validate: ["validate", "validation", "normalise", "normalize", "guardrail_in"],
    embed: ["embed", "embedding", "encode", "query_embed"],
    retrieve: ["retrieve", "retrieval", "search", "qdrant", "vector_search"],
    rank: ["rank", "ranking", "rerank", "fuse", "fusion", "rrf"],
    generate: ["generate", "generation", "llm", "completion"],
    ground: ["ground", "grounding", "verify", "guardrail_out", "serialize"],
  };

  for (const stage of ALL_STAGES) {
    const value = asNumber(pick(bag, ...aliases[stage]));
    if (value !== undefined) stages[stage] = value;
  }

  const coreStages = (["validate", "embed", "retrieve", "rank", "generate", "ground"] as StageKey[])
    .map((stage) => stages[stage] ?? 0)
    .reduce((sum, value) => sum + value, 0);

  const ragCore =
    asNumber(pick(bag, "rag_core", "ragCore", "core", "pipeline", "total_rag", "post_stt")) ??
    (coreStages > 0 ? coreStages : (asNumber(pick(bag, "total", "total_ms", "elapsed")) ?? 0));

  const voiceE2E = asNumber(
    pick(bag, "voice_e2e", "voiceE2e", "e2e", "end_to_end", "total_voice", "wall_clock"),
  );

  return { ...stages, rag_core: Math.max(0, ragCore), voice_e2e: voiceE2E };
}

const CORE_ALIASES: Record<StageKey, string[]> = {
  stt: ["stt", "asr", "speech", "transcribe", "transcription"],
  validate: ["validate", "guard", "guardrail", "guardrail_in", "safety"],
  embed: ["embed", "embedding", "encoder", "embedder"],
  retrieve: ["retrieve", "retrieval", "vector", "index", "search", "rag"],
  rank: ["rank", "rerank", "fusion", "fuse", "rrf"],
  generate: ["generate", "llm", "generator", "generation", "answer"],
  ground: ["ground", "grounding", "verifier", "guardrail_out", "gate"],
};

function normaliseCores(source: Raw, latency: LatencyBreakdown): CoreInfo[] {
  const container = pick(source, "cores", "plugins", "components", "stack", "engines");
  if (!isObject(container)) return [];

  const cores: CoreInfo[] = [];

  for (const key of CORE_KEYS) {
    const entry = pick(container, ...CORE_ALIASES[key]);
    if (entry === undefined) continue;

    if (typeof entry === "string") {
      cores.push({
        key,
        id: entry,
        provider: entry.includes(".") ? entry.split(".")[0] : null,
        model: null,
        version: null,
        status: "active",
        latencyMs: latency[key as keyof LatencyBreakdown] as number | undefined,
      });
      continue;
    }

    if (!isObject(entry)) continue;

    const id = asString(pick(entry, "id", "name", "plugin", "impl", "implementation"));
    if (!id) continue;

    const rawStatus = asString(pick(entry, "status", "state")).toLowerCase();
    const status: CoreInfo["status"] =
      rawStatus === "fallback" || rawStatus === "degraded"
        ? "fallback"
        : rawStatus === "disabled" || rawStatus === "off" || rawStatus === "skipped"
          ? "disabled"
          : "active";

    cores.push({
      key,
      id,
      provider: asString(pick(entry, "provider", "vendor", "backend")) || (id.includes(".") ? id.split(".")[0] : null),
      model: asString(pick(entry, "model", "checkpoint", "revision")) || null,
      version: asString(pick(entry, "version", "ver", "build")) || null,
      status,
      latencyMs: latency[key as keyof LatencyBreakdown] as number | undefined,
    });
  }

  return cores;
}

function normaliseEvidence(source: Raw, citedIds: string[]): Evidence[] {
  const rawList =
    pick(source, "evidence", "chunks", "contexts", "sources", "documents", "passages", "hits") ??
    [];
  if (!Array.isArray(rawList)) return [];

  const cited = new Set(citedIds.map((id) => id.toLowerCase()));

  return rawList.map((entry, index) => {
    if (typeof entry === "string") {
      const id = `chunk-${index + 1}`;
      return {
        id,
        text: entry,
        score: 0,
        representation: "unknown" as ChunkRepresentation,
        cited: cited.has(id.toLowerCase()),
        rank: index + 1,
      };
    }

    const item = isObject(entry) ? entry : {};
    const id = asString(
      pick(item, "id", "chunk_id", "evidence_id", "doc_id", "_id", "uuid"),
      `chunk-${index + 1}`,
    );
    const text = asString(
      pick(item, "text", "content", "passage", "chunk", "body", "page_content", "translated_passage"),
    );

    const dense = asNumber(pick(item, "dense_score", "dense", "vector_score", "cosine"));
    const sparse = asNumber(pick(item, "sparse_score", "sparse", "bm25", "bm25_score", "lexical"));
    const rrf = asNumber(pick(item, "rrf_score", "rrf", "fused_score", "fusion_score"));
    const score = asNumber(pick(item, "score", "relevance", "similarity")) ?? rrf ?? dense ?? 0;

    return {
      id,
      text,
      score,
      language: asString(pick(item, "language", "lang", "language_code", "target_lang")) || undefined,
      parentId: (asString(pick(item, "parent_id", "parent", "parent_chunk_id")) || null) as string | null,
      parentText: (asString(pick(item, "parent_text", "parent_content")) || null) as string | null,
      representation: normaliseRepresentation(
        pick(item, "representation", "chunk_type", "strategy", "chunker", "variant"),
      ),
      denseScore: dense,
      sparseScore: sparse,
      rrfScore: rrf,
      rank: asNumber(pick(item, "rank", "position")) ?? index + 1,
      queryId: asString(pick(item, "query_id", "qid")) || undefined,
      passageRank: asNumber(pick(item, "passage_rank", "passage_index")),
      cited: cited.has(id.toLowerCase()),
    };
  });
}

export function adaptQueryResponse(payload: unknown): QueryResult {
  const root = isObject(payload) ? payload : {};
  const body = isObject(pick(root, "result", "data", "response"))
    ? (pick(root, "result", "data", "response") as Raw)
    : root;

  const answer = asString(
    pick(body, "answer", "response", "text", "output", "completion", "generated_answer"),
  ).trim();

  const evidenceIds = (() => {
    const raw = pick(body, "evidence_ids", "citations", "cited_ids", "source_ids");
    if (Array.isArray(raw)) return raw.map((value) => asString(value)).filter(Boolean);
    return [];
  })();

  const status = normaliseStatus(pick(body, "status", "state", "outcome"), answer.length > 0);
  const evidence = normaliseEvidence(body, evidenceIds);
  const language = (asString(pick(body, "language", "lang", "detected_language")) || "unknown").toLowerCase();

  const refusalCode =
    status === "refused"
      ? normaliseRefusal(pick(body, "refusal_reason", "reason", "refusal", "refusal_code", "error_code")) ??
        "insufficient_evidence"
      : null;

  const latency = normaliseLatency(body);
  const simulated =
    pick(root, "simulated") === true ||
    pick(body, "simulated") === true ||
    asString(pick(root, "source", "mode")).toLowerCase() === "simulated";

  return {
    status,
    answer,
    transcript: asString(pick(body, "transcript", "query", "question", "text_query", "asr_text")),
    language,
    languageName: LANGUAGE_NAME[language] ?? language.toUpperCase(),
    confidence: asNumber(pick(body, "confidence", "score", "fused_score")) ?? 0,
    threshold: asNumber(pick(body, "threshold", "confidence_threshold", "gate")) ?? null,
    evidence,
    evidenceIds: evidenceIds.length ? evidenceIds : evidence.filter((e) => e.cited).map((e) => e.id),
    latency,
    cores: normaliseCores(body, latency),
    refusalReason: asString(pick(body, "refusal_message", "message", "detail")) || null,
    refusalCode,
    fallback: (asString(pick(body, "fallback", "fallback_mode")) || null) as QueryResult["fallback"],
    traceId: asString(pick(body, "trace_id", "traceId", "request_id")) || null,
    model: asString(pick(body, "model", "llm", "generator")) || null,
    source: simulated ? "simulated" : "live",
    fallbackReason: asString(pick(root, "fallback_reason"), "") || null,
    receivedAt: Date.now(),
  };
}
