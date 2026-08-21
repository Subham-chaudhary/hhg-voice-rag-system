/**
 * Scheduled function. Qdrant Cloud Free suspends after one week of
 * inactivity and deletes after four. Judging may happen days after
 * submission — this is data-loss prevention, not an optimization.
 */
import type { Config } from "@netlify/functions";
import { qdrant, COLLECTION } from "../lib/qdrant.ts";

const handler = async (): Promise<Response> => {
  const t0 = performance.now();
  try {
    const result = await qdrant.count(COLLECTION, { exact: false });
    console.log(
      JSON.stringify({ fn: "keepalive", status: "ok", count: result.count, timings_ms: { total: round(performance.now() - t0) } }),
    );
  } catch (err) {
    console.log(
      JSON.stringify({ fn: "keepalive", status: "error", error: String(err), timings_ms: { total: round(performance.now() - t0) } }),
    );
  }
  return new Response("ok");
};

export default handler;

function round(ms: number) {
  return Math.round(ms * 10) / 10;
}

export const config: Config = { schedule: "*/4 * * * *" };
