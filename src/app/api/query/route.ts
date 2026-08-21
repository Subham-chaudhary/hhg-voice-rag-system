import { NextRequest, NextResponse } from "next/server";
import { buildMockResponse } from "@/lib/mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL?.replace(/\/$/, "");
const BACKEND_QUERY_PATH = process.env.BACKEND_QUERY_PATH ?? "/query";
const BACKEND_TIMEOUT_MS = Number(process.env.BACKEND_TIMEOUT_MS ?? 20000);

function wantsMock(request: NextRequest): boolean {
  if (request.nextUrl.searchParams.get("mode") === "mock") return true;
  if (request.nextUrl.searchParams.get("mode") === "live") return false;
  return !BACKEND_URL;
}

async function forward(request: NextRequest, body: BodyInit, headers: HeadersInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${BACKEND_URL}${BACKEND_QUERY_PATH}`, {
      method: "POST",
      headers: {
        ...headers,
        ...(process.env.BACKEND_API_KEY ? { authorization: `Bearer ${process.env.BACKEND_API_KEY}` } : {}),
      },
      body,
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        { status: "error", detail: text.slice(0, 500) || `Upstream ${upstream.status}` },
        { status: upstream.status },
      );
    }

    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      return NextResponse.json({ status: "error", detail: "Upstream did not return JSON." }, { status: 502 });
    }
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return NextResponse.json(
      {
        status: "error",
        detail: aborted
          ? `Backend did not respond within ${BACKEND_TIMEOUT_MS} ms.`
          : `Could not reach the backend at ${BACKEND_URL}.`,
      },
      { status: 504 },
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");

  if (wantsMock(request)) {
    let transcript = "";
    let hasAudio = false;

    if (isMultipart) {
      const form = await request.formData();
      transcript = String(form.get("transcript") ?? "");
      hasAudio = form.get("audio") instanceof Blob;
      if (!transcript && hasAudio) transcript = "जलविद्युत ऊर्जा कैसे काम करती है?";
    } else {
      const json = (await request.json().catch(() => ({}))) as { transcript?: string };
      transcript = json.transcript ?? "";
    }

    const payload = buildMockResponse(transcript, hasAudio);
    const settle = (payload.latency_ms.voice_e2e ?? payload.latency_ms.rag_core) * 0.85;
    await new Promise((resolve) => setTimeout(resolve, Math.min(1400, settle)));
    return NextResponse.json(payload);
  }

  if (!BACKEND_URL) {
    return NextResponse.json(
      { status: "error", detail: "BACKEND_URL is not configured. Set it in .env.local or use mock mode." },
      { status: 503 },
    );
  }

  if (isMultipart) {
    const form = await request.formData();
    return forward(request, form, {});
  }

  const raw = await request.text();
  return forward(request, raw, { "content-type": "application/json" });
}

export async function GET() {
  return NextResponse.json({
    mode: BACKEND_URL ? "live" : "mock",
    backend: BACKEND_URL ?? null,
    queryPath: BACKEND_QUERY_PATH,
  });
}
