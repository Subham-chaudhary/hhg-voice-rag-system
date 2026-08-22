/**
 * Session latency log — up to 200 /fn/search calls, persisted to
 * localStorage so it survives reloads and backs both the console's live
 * SessionLatencyPanel and the /benchmark page's local-history fallback.
 * Same safe-storage pattern as the older lib/store.ts (try/catch probe,
 * lazy-loaded cache, quota-exceeded fallback trim) — kept as a separate
 * key/store rather than reusing store.ts, since that one is scaffolding
 * for a different, not-yet-built (LLM generation) contract.
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

const KEY = "zenith.rag-session.v1";
const LIMIT = 200;

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const probe = window.localStorage;
    probe.getItem(KEY);
    return probe;
  } catch {
    return null;
  }
}

const EMPTY: SessionRecord[] = [];
const listeners = new Set<() => void>();
let cache: SessionRecord[] | null = null;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): SessionRecord[] {
  if (cache === null) cache = loadRecords();
  return cache;
}

export function getServerSnapshot(): SessionRecord[] {
  return EMPTY;
}

function publish(next: SessionRecord[]): void {
  cache = next;
  listeners.forEach((listener) => listener());
}

export function loadRecords(): SessionRecord[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is SessionRecord =>
        entry && typeof entry.id === "string" && typeof entry.ragCore === "number",
    );
  } catch {
    return [];
  }
}

export function appendRecord(record: SessionRecord): void {
  const next = [record, ...getSnapshot()].slice(0, LIMIT);
  const store = storage();
  if (store) {
    try {
      store.setItem(KEY, JSON.stringify(next));
    } catch {
      try {
        store.setItem(KEY, JSON.stringify(next.slice(0, 100)));
      } catch {
        // storage is full or unavailable; the in-memory list still works
      }
    }
  }
  publish(next);
}

export function clearRecords(): void {
  const store = storage();
  if (store) {
    try {
      store.removeItem(KEY);
    } catch {
      // nothing to do
    }
  }
  publish(EMPTY);
}

export function isPersistent(): boolean {
  return storage() !== null;
}

/** Distinct from isPersistent(): storage can work but hold nothing yet. */
export function hasStoredKey(): boolean {
  const store = storage();
  if (!store) return false;
  try {
    return store.getItem(KEY) !== null;
  } catch {
    return false;
  }
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
