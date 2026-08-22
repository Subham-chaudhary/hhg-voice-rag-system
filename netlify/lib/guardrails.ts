/**
 * Deterministic gates only. No LLM anywhere in this file.
 *
 * checkQuery  — pre-retrieval. Rejects garbage before a single API call is spent.
 * evaluateGate — post-retrieval. The four-band confidence ladder (§5 of the spec).
 */

export type QueryCheck = { ok: true } | { ok: false; reason: string };

const MIN_LEN = 3;
const MAX_LEN = 500;
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

// Minimal deterministic block-list for obviously unsafe intents. This is a
// coarse pre-filter, not a safety classifier — it exists so the guardrail
// layer stays LLM-free and explainable, and is expected to be expanded
// during calibration, not treated as complete.
const UNSAFE_PATTERNS: RegExp[] = [
  /\bhow (?:to|do i) (?:make|build|synthesi[sz]e) (?:a )?(?:bomb|explosive|nerve agent)\b/i,
  /\bhow (?:to|do i) (?:kill|murder|poison) (?:someone|myself|a person)\b/i,
  /\bchild sexual abuse\b/i,
];

export function checkQuery(text: string): QueryCheck {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: false, reason: "empty" };
  if (trimmed.length < MIN_LEN) return { ok: false, reason: "too_short" };
  if (trimmed.length > MAX_LEN) return { ok: false, reason: "too_long" };
  if (!HAS_LETTER_OR_DIGIT.test(trimmed)) return { ok: false, reason: "no_content" };
  if (UNSAFE_PATTERNS.some((re) => re.test(trimmed))) return { ok: false, reason: "unsafe_content" };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Post-retrieval confidence ladder
// ---------------------------------------------------------------------------

export type GateAction = "early_exit" | "proceed" | "rerank" | "abstain";

export type ScoredCandidate = {
  id: string;
  score: number;
  payload: Record<string, unknown>;
  source: "tier1" | "tier2";
};

export type GateResult = {
  ok: boolean;
  reason?: string;
  evidence: ScoredCandidate[];
  confidence: number;
  action: GateAction;
};

export type Thresholds = {
  TAU_HIGH: number;
  TAU_GOOD: number;
  TAU_FLOOR: number;
  TAU_RERANK_PASS: number;
};

// Same numbers documented as the starting point in serverless.md §5.2 — used
// only if the env var is genuinely unset (e.g. running a unit test), so the
// ladder logic itself never hardcodes a threshold. Production must set these
// in the Netlify UI per §2.
const FALLBACK_THRESHOLDS: Thresholds = {
  TAU_HIGH: 0.92,
  TAU_GOOD: 0.78,
  TAU_FLOOR: 0.45,
  TAU_RERANK_PASS: 0.35,
};

export function getThresholds(env: NodeJS.ProcessEnv = process.env): Thresholds {
  const read = (key: keyof Thresholds): number => {
    const raw = env[key];
    if (raw === undefined || raw === "") {
      console.warn(`[guardrails] ${key} not set in env — falling back to placeholder ${FALLBACK_THRESHOLDS[key]}`);
      return FALLBACK_THRESHOLDS[key];
    }
    const n = Number(raw);
    if (Number.isNaN(n)) throw new Error(`invalid threshold env var ${key}=${raw}`);
    return n;
  };
  return {
    TAU_HIGH: read("TAU_HIGH"),
    TAU_GOOD: read("TAU_GOOD"),
    TAU_FLOOR: read("TAU_FLOOR"),
    TAU_RERANK_PASS: read("TAU_RERANK_PASS"),
  };
}

const MARGIN_THRESHOLD = 0.03;

/**
 * tier1: the single query-index fast-path hit, or null.
 * tier2: up to 10 wide-cascade hits (already RRF-fused + rescored).
 */
export function evaluateGate(
  tier1: { id: string; score: number; payload: Record<string, unknown> } | null,
  tier2: Array<{ id: string; score: number; payload: Record<string, unknown> }>,
  thresholds: Thresholds = getThresholds(),
): GateResult {
  const candidates: ScoredCandidate[] = [
    ...(tier1 ? [{ id: tier1.id, score: tier1.score, payload: tier1.payload, source: "tier1" as const }] : []),
    ...tier2.map((h) => ({ id: h.id, score: h.score, payload: h.payload, source: "tier2" as const })),
  ].sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    return { ok: false, reason: "no_results", evidence: [], confidence: 0, action: "abstain" };
  }

  const top1 = candidates[0];
  const top2 = candidates[1];
  const margin = top2 ? top1.score - top2.score : 1;

  let action: GateAction;
  if (top1.score >= thresholds.TAU_HIGH) action = "early_exit";
  else if (top1.score >= thresholds.TAU_GOOD) action = "proceed";
  else if (top1.score >= thresholds.TAU_FLOOR) action = "rerank";
  else action = "abstain";

  // Undecided even at a high score: let the cross-encoder break the tie.
  // Never overridden into rerank from abstain — reordering irrelevant
  // documents just produces the best-ranked irrelevant document.
  if (action !== "abstain" && margin < MARGIN_THRESHOLD) action = "rerank";

  return {
    ok: action !== "abstain",
    reason: action === "abstain" ? "low_confidence" : undefined,
    evidence: candidates,
    confidence: top1.score,
    action,
  };
}

/** Re-gate after reranking. Different model, different scale, different threshold — never TAU_GOOD/TAU_HIGH here. */
export function evaluateRerankGate(
  topRerankScore: number,
  thresholds: Thresholds = getThresholds(),
): { ok: boolean; action: "proceed" | "abstain" } {
  const ok = topRerankScore >= thresholds.TAU_RERANK_PASS;
  return { ok, action: ok ? "proceed" : "abstain" };
}
