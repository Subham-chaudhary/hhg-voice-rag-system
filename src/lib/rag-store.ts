/**
 * Session latency ring buffer — last 50 /fn/search calls, in memory only.
 * "Session" is read literally: this tab's lifetime, not persisted across
 * reloads (unlike the older lib/store.ts, which is a different, richer
 * benchmark log for the not-yet-built generation phase).
 */
import { percentile } from "./format";
import type { SearchStatus } from "./rag-types";

export interface SessionRecord {
  id: string;
  requestId: string;
  at: number;
  transcript: string;
  language: string;
  status: SearchStatus;
  reranked: boolean;
  earlyExit: boolean;
  degraded: string | null;
  ragCore: number;
  clientRoundTripMs: number;
}

const LIMIT = 50;
const EMPTY: SessionRecord[] = [];
const listeners = new Set<() => void>();
let records: SessionRecord[] = [];

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): SessionRecord[] {
  return records;
}

export function getServerSnapshot(): SessionRecord[] {
  return EMPTY;
}

export function appendRecord(record: SessionRecord): void {
  records = [record, ...records].slice(0, LIMIT);
  listeners.forEach((listener) => listener());
}

export function clearRecords(): void {
  records = [];
  listeners.forEach((listener) => listener());
}

export interface LatencyPercentiles {
  p50: number;
  p70: number;
  p100: number;
  n: number;
}

function summariseRagCore(values: number[]): LatencyPercentiles {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 0.5),
    p70: percentile(sorted, 0.7),
    p100: percentile(sorted, 1), // nearest-rank, P100 = max observed — not P99.99
    n: sorted.length,
  };
}

export interface SegmentedLatency {
  fast: LatencyPercentiles;
  rerank: LatencyPercentiles;
  blended: LatencyPercentiles;
  rerankRate: number;
}

/** Segmented per §6 of integrate.md — a blended P50 alone hides the slow path. */
export function segmentLatency(records: SessionRecord[]): SegmentedLatency {
  const measured = records.filter((r) => r.ragCore > 0);
  const fastValues = measured.filter((r) => !r.reranked).map((r) => r.ragCore);
  const rerankValues = measured.filter((r) => r.reranked).map((r) => r.ragCore);
  const blendedValues = measured.map((r) => r.ragCore);

  return {
    fast: summariseRagCore(fastValues),
    rerank: summariseRagCore(rerankValues),
    blended: summariseRagCore(blendedValues),
    rerankRate: measured.length ? rerankValues.length / measured.length : 0,
  };
}
