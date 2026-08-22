import { QueryStatus, StageKey } from "./contract";

const KEY = "zenith.latency.v1";
const LIMIT = 500;

export interface LatencyRecord {
  id: string;
  at: number;
  transcript: string;
  language: string;
  status: QueryStatus;
  viaVoice: boolean;
  ragCore: number;
  voiceE2E?: number;
  stages: Partial<Record<StageKey, number>>;
  clientRoundTripMs: number;
  traceId: string | null;
}

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

const EMPTY: LatencyRecord[] = [];
const listeners = new Set<() => void>();
let cache: LatencyRecord[] | null = null;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): LatencyRecord[] {
  if (cache === null) cache = loadRecords();
  return cache;
}

export function getServerSnapshot(): LatencyRecord[] {
  return EMPTY;
}

function publish(next: LatencyRecord[]): void {
  cache = next;
  listeners.forEach((listener) => listener());
}

export function loadRecords(): LatencyRecord[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is LatencyRecord =>
        entry && typeof entry.id === "string" && typeof entry.ragCore === "number",
    );
  } catch {
    return [];
  }
}

export function appendRecord(record: LatencyRecord): LatencyRecord[] {
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
  return next;
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

export function toBenchmarkJson(records: LatencyRecord[], label: string) {
  return {
    label,
    placeholder: false,
    commit: null,
    measured_at: new Date(records[0]?.at ?? Date.now()).toISOString(),
    warmups: 0,
    repeats: 1,
    timeouts: 0,
    errors: records.filter((r) => r.status === "error").length,
    source: "browser session log — client-observed, not the harness",
    records: records.map((record, index) => ({
      query_id: `s${String(index + 1).padStart(4, "0")}`,
      language: record.language,
      status: record.status,
      rag_core: record.ragCore,
      voice_e2e: record.voiceE2E,
      stages: record.stages,
      client_round_trip: record.clientRoundTripMs,
      trace_id: record.traceId,
    })),
  };
}
