import { NextRequest, NextResponse } from "next/server";
import { buildMockResponse } from "@/lib/mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL?.replace(/\/$/, "");
const BACKEND_QUERY_PATH = process.env.BACKEND_QUERY_PATH ?? "/query";
const BACKEND_TIMEOUT_MS = Number(process.env.BACKEND_TIMEOUT_MS ?? 20000);

interface ParsedRequest {
  transcript: string;
  language?: string;
  hasAudio: boolean;
  audio?: File;
}

async function parse(request: NextRequest): Promise<ParsedRequest> {
  if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await request.formData();
    const audio = form.get("audio");
    return {
      transcript: String(form.get("transcript") ?? ""),
      language: (form.get("language") as string) || undefined,
      hasAudio: audio instanceof File,
      audio: audio instanceof File ? audio : undefined,
    };
  }

  const json = (await request.json().catch(() => ({}))) as { transcript?: string; language?: string };
  return { transcript: json.transcript ?? "", language: json.language, hasAudio: false };
}

function simulated(parsed: ParsedRequest, reason: string) {
  const transcript =
    parsed.transcript || (parsed.hasAudio ? "जलविद्युत ऊर्जा कैसे काम करती है?" : "");
  return {
    ...buildMockResponse(transcript, parsed.hasAudio),
    simulated: true,
    fallback_reason: reason,
  };
}

async function callBackend(parsed: ParsedRequest): Promise<{ ok: true; payload: unknown } | { ok: false; reason: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  try {
    let body: BodyInit;
    const headers: Record<string, string> = {};

    if (parsed.audio) {
      const form = new FormData();
      form.append("audio", parsed.audio, parsed.audio.name || "query.wav");
      if (parsed.language) form.append("language", parsed.language);
      if (parsed.transcript) form.append("transcript", parsed.transcript);
      body = form;
    } else {
      headers["content-type"] = "application/json";
      body = JSON.stringify({ transcript: parsed.transcript, language: parsed.language });
    }

    if (process.env.BACKEND_API_KEY) {
      headers.authorization = `Bearer ${process.env.BACKEND_API_KEY}`;
    }

    const upstream = await fetch(`${BACKEND_URL}${BACKEND_QUERY_PATH}`, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await upstream.text();

    if (!upstream.ok) {
      return { ok: false, reason: `backend returned ${upstream.status}` };
    }

    try {
      return { ok: true, payload: JSON.parse(text) };
    } catch {
      return { ok: false, reason: "backend did not return JSON" };
    }
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return {
      ok: false,
      reason: aborted ? `backend timed out after ${BACKEND_TIMEOUT_MS} ms` : "backend unreachable",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parse(request);

  if (!BACKEND_URL) {
    const payload = simulated(parsed, "no backend configured");
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(1400, (payload.latency_ms.voice_e2e ?? payload.latency_ms.rag_core) * 0.85)),
    );
    return NextResponse.json(payload);
  }

  const result = await callBackend(parsed);
  if (result.ok) return NextResponse.json(result.payload);

  return NextResponse.json(simulated(parsed, result.reason));
}

export async function GET() {
  return NextResponse.json({
    backend: BACKEND_URL ?? null,
    queryPath: BACKEND_QUERY_PATH,
    configured: Boolean(BACKEND_URL),
  });
}
