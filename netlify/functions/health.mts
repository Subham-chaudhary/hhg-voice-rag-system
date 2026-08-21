/**
 * GET /api/health — pings Jina, Qdrant, Sarvam with 2s timeouts in
 * parallel. 503 if Qdrant is down; 200 with a warning if only Sarvam is.
 * Also asserts collection points_count matches the ingestion manifest — a
 * silent mismatch means the cluster was rebuilt or partially loaded.
 */
import type { Config } from "@netlify/functions";
import { embedText } from "../lib/jina.ts";
import { qdrant, COLLECTION } from "../lib/qdrant.ts";
import { manifest, totalPoints } from "../lib/manifest.ts";

const PING_TIMEOUT_MS = 2000;

type DepStatus = { ok: boolean; latency_ms?: number; error?: string };

async function timed<T>(fn: () => Promise<T>): Promise<{ result?: T; status: DepStatus }> {
  const start = performance.now();
  try {
    const result = await fn();
    return { result, status: { ok: true, latency_ms: round(performance.now() - start) } };
  } catch (err) {
    return { status: { ok: false, latency_ms: round(performance.now() - start), error: String(err) } };
  }
}

async function pingJina(): Promise<DepStatus> {
  const { status } = await timed(() => embedText("ok", "retrieval.query", AbortSignal.timeout(PING_TIMEOUT_MS)));
  return status;
}

async function pingQdrant(): Promise<{ status: DepStatus; pointsCount?: number }> {
  const { result, status } = await timed(() => qdrant.getCollection(COLLECTION));
  return { status, pointsCount: result?.points_count ?? undefined };
}

async function pingSarvam(): Promise<DepStatus> {
  // No cheap dedicated health endpoint; a bare request to the STT endpoint
  // (rejected fast for missing multipart body) still proves DNS/TLS/reachability.
  const { status } = await timed(async () => {
    const r = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "GET",
      headers: { "api-subscription-key": process.env.SARVAM_API_KEY ?? "" },
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    // Any HTTP response (even 4xx/405) means the service is reachable.
    if (r.status >= 500) throw new Error(`sarvam ${r.status}`);
  });
  return status;
}

const handler = async (): Promise<Response> => {
  const t0 = performance.now();
  const requestId = crypto.randomUUID();

  const [jina, qdrantResult, sarvam] = await Promise.all([pingJina(), pingQdrant(), pingSarvam()]);

  const pointsCount = qdrantResult.pointsCount;
  const pointsMismatch = pointsCount !== undefined && pointsCount !== totalPoints;

  const overall: "ok" | "degraded" | "down" = !qdrantResult.status.ok
    ? "down"
    : !jina.ok || !sarvam.ok || pointsMismatch
      ? "degraded"
      : "ok";

  const timings_ms = { total: round(performance.now() - t0) };
  const body = {
    status: overall,
    jina,
    qdrant: qdrantResult.status,
    sarvam,
    manifest_revision: manifest.revision,
    points_count: pointsCount,
    points_count_expected: totalPoints,
    points_count_mismatch: pointsMismatch,
    request_id: requestId,
    timings_ms,
  };

  console.log(JSON.stringify({ request_id: requestId, fn: "health", status: overall, timings_ms, degraded: null }));

  return new Response(JSON.stringify(body), {
    status: overall === "down" ? 503 : 200,
    headers: { "content-type": "application/json" },
  });
};

export default handler;

function round(ms: number) {
  return Math.round(ms * 10) / 10;
}

export const config: Config = { path: "/api/health" };
