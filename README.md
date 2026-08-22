# Zenith — voice RAG console

The interface layer of `hhg-voice-rag-system`, by **The Higher Celestials**.
HH Goa 2026 Shortlisting Task 2.

Speak a question, watch it move through the harness, read an answer traceable to the chunks it
came from — or watch the system refuse when the evidence doesn't support one.

```
mic ─► Sarvam STT ─► validate ─► e5 embed ─► Qdrant hybrid ─► rank ─► Groq ─► grounding gate
                     └──────────────── RAG-core, measured against 200 ms ─────────────────┘
```

---

## Integrate in three steps

**1 — Run it.** It needs no backend. With `BACKEND_URL` unset every request is served by the
built-in simulated responder, which implements the entire contract.

```bash
npm install
npm run dev            # http://localhost:3000
```

**2 — Point it at the pipeline.**

```bash
cp .env.example .env.local     # set BACKEND_URL=http://localhost:8080
npm run dev
```

Requests proxy through this app's own `/api/query`, so **the backend needs no CORS setup**.
There is no mock switch — every request goes live, and only an unreachable, timed-out, non-2xx or
non-JSON backend falls back to the simulated responder. See *Automatic fallback* below.

**3 — Return this shape from `POST /query`.**

```json
{
  "status": "answered",
  "answer": "Caffeine is absorbed within about forty-five minutes…",
  "transcript": "How long does caffeine stay in your system?",
  "language": "en",
  "confidence": 0.913,
  "threshold": 0.62,
  "evidence_ids": ["msx-en-330218-p1-a"],
  "evidence": [
    {
      "id": "msx-en-330218-p1-a",
      "text": "Caffeine is absorbed from the gastrointestinal tract within…",
      "score": 0.913,
      "dense_score": 0.902,
      "sparse_score": 14.22,
      "rrf_score": 0.0331,
      "rank": 1,
      "language": "en",
      "representation": "atomic",
      "parent_id": null,
      "parent_text": null,
      "query_id": "330218",
      "passage_rank": 1
    }
  ],
  "latency_ms": {
    "stt": 412.0, "validate": 2.1, "embed": 14.6, "retrieve": 9.8,
    "rank": 3.4, "generate": 68.0, "ground": 5.2,
    "rag_core": 124.3, "voice_e2e": 584.7
  },
  "model": "groq/openai-gpt-oss-20b",
  "trace_id": "req_01J…",
  "fallback": null
}
```

That's it. Full spec, refusal and error examples, and every accepted field alias:
**[`docs/api-contract.md`](docs/api-contract.md)**.

---

## The four fields that carry the submission

The brief asks for six things. Most are invisible unless the response carries the data:

**`evidence[]` as objects, not just IDs.** `evidence_ids` alone cannot be rendered. The evidence
panel and retrieval inspector are what make the *vast chunking* requirement visible to a judge.

**`latency_ms` broken out per stage.** The stage breakdown *is* the proof for `<200 ms`. `rag_core`
must cover **transcript available → verified answer** and must exclude STT. `voice_e2e` is optional
and shown separately.

**`representation` on every chunk** — which chunking strategy produced the hit:

| value | renders as | | value | renders as |
|---|---|---|---|---|
| `atomic` | A · Atomic passage | | `metadata` | E · Metadata-aware |
| `sentence_window` | B · Sentence window | | `query_enriched` | F · Query-enriched |
| `semantic` | C · Semantic | | `cross_lingual` | G · Cross-lingual twin |
| `parent_child` | D · Parent-child | | | |

Send `parent_text` on `parent_child` hits — the UI expands the parent inline.

**`cores` — the plugin that served each stage.** Every stage is a swappable core; declare the one
that actually ran and the UI reports it per request:

```json
"cores": {
  "asr":      { "id": "sarvam.saarika-v2",    "provider": "sarvam",   "version": "2.1" },
  "embed":    { "id": "e5.multilingual-base", "provider": "huggingface" },
  "retrieve": { "id": "qdrant.hybrid-rrf",    "provider": "qdrant",   "version": "1.12" },
  "generate": { "id": "groq.gpt-oss-20b",     "provider": "groq" }
}
```

`status: "disabled"` renders as **not run** — use it for stages skipped by a guardrail.
Swapping Sarvam for ElevenLabs or Groq for a local model changes the `id` and nothing else.
Full key list and aliases in the contract doc.

## Automatic fallback

There is no mock mode to switch into. Every request goes to the live pipeline. If `BACKEND_URL`
is unset, or the backend is unreachable, times out, returns non-2xx, or returns something that
is not JSON, the app answers from the simulated responder and marks it:

- a **SIMULATED** pill in the header, on the answer card (with the reason), and on the latency strip
- **excluded** from the session log, from the P100 statistic, and from the exported JSON

A demo never dead-ends, and no fabricated number can be mistaken for a measurement.

## Requests

**Text** — `application/json`: `{ "transcript": "…", "language": "en" }`

**Voice** — `multipart/form-data`: `audio` (16 kHz mono 16-bit WAV, encoded in-browser — no
server-side transcoding), optional `language` hint, optional `transcript`.

`language` is a hint, never an override. Return what Sarvam actually detected.

## Refusals

Return HTTP **200** for `status: "refused"` — a refusal is a successful request, not an error.

```json
{
  "status": "refused",
  "answer": "",
  "confidence": 0.318,
  "threshold": 0.62,
  "refusal_reason": "insufficient_evidence",
  "evidence": [ "…the chunks retrieved and then rejected…" ],
  "latency_ms": { "validate": 1.4, "embed": 14.2, "retrieve": 9.1, "rank": 2.6, "ground": 1.1, "rag_core": 60.2 }
}
```

Reasons: `insufficient_evidence` · `off_topic` · `unsafe_input` · `empty_or_unintelligible` ·
`ungrounded_answer`. Anything unrecognised falls back to `insufficient_evidence`.

Two things worth doing here:

- **Keep returning `evidence[]` on a low-confidence refusal.** Showing what was found *and rejected*, with scores, is the strongest demonstration of the confidence gate. The UI renders them beside the refusal.
- **Omit stages that never ran.** The UI renders them as `skipped` — exactly the story you want for an unsafe input blocked before retrieval.

Errors: `{ "status": "error", "detail": "Qdrant unreachable" }`. The UI retries once on
408/425/429/5xx, then shows the error state.

## If your shape differs

Don't change the backend. `src/lib/adapter.ts` is the only file that needs editing, and it already
tolerates:

- snake_case or camelCase, and responses wrapped in `result` / `data` / `response`
- evidence array named `evidence` · `chunks` · `contexts` · `sources` · `documents` · `passages` · `hits`
- chunk text as `text` · `content` · `passage` · `chunk` · `body` · `page_content`
- latency container as `latency_ms` · `latencies` · `timings`; stages as `stt`/`asr`, `retrieve`/`search`/`qdrant`, `rank`/`fuse`/`rrf`, `generate`/`llm`, `ground`/`verify`
- status `ok`/`success` → answered, `abstain`/`no_answer` → refused

Missing `rag_core` is summed from the stages. Anything genuinely different — send the shape and
it gets mapped.

## Benchmark page

`/benchmark` reads `benchmarks/results/*.json`, preferring a filename containing `final`:

```json
{
  "label": "final run", "commit": "9f2c1ab", "measured_at": "2026-08-22T09:12:00Z",
  "warmups": 10, "repeats": 2, "timeouts": 0, "errors": 0,
  "records": [
    { "query_id": "q0001", "language": "hi", "status": "answered",
      "rag_core": 148.2, "voice_e2e": 612.4,
      "stages": { "stt": 421.0, "validate": 1.9, "embed": 14.2, "retrieve": 9.4,
                  "rank": 3.1, "generate": 71.0, "ground": 4.8 } }
  ]
}
```

P50 / P70 / P100, mean, σ, the histogram and the per-language table are all computed from
`records` — **do not precompute them**. Write the harness output to this directory and the page
fills in; no UI change needed.

> ⚠️ `benchmarks/results/example.json` holds **synthetic** data so the page could be reviewed
> before the harness existed. The UI labels it in red as not-a-measured-run. **Delete it once
> `final.json` lands.** No invented numbers go into the submission.

## Environment

| variable | default | purpose |
|---|---|---|
| `BACKEND_URL` | unset → mock mode | FastAPI pipeline base URL |
| `BACKEND_QUERY_PATH` | `/query` | path appended to `BACKEND_URL` |
| `BACKEND_TIMEOUT_MS` | `20000` | upstream timeout before the error state |
| `BACKEND_API_KEY` | unset | sent as `Authorization: Bearer …` if set |
| `NEXT_PUBLIC_PUBLIC_URL` | unset | public address the QR code encodes; falls back to the browser origin |

## What the interface shows

| Requirement | Where it surfaces |
|---|---|
| Speech-to-text | Hold-to-talk capture, live level meter, transcript with detected language |
| Vast chunking | Every chunk tagged A–G; retrieval inspector breaks out dense vs sparse contribution, fused RRF score, parent-chunk expansion |
| < 200 ms | Per-stage latency strip with the budget line drawn on it, RAG-core badged pass/fail |
| P50 / P70 / P100 | `/benchmark` — percentiles, distribution, per-stage medians, per-language table |
| Harness | Stage rail mirrors the backend state machine; skipped stages render as `skipped` |
| Guardrails | Refusal is a first-class state with its own copy, the confidence score, the gate it failed, and the evidence it rejected |
| Plugin cores | A Cores panel naming the plugin, provider and version that served each stage of the request |

## Layout

```
src/
  app/
    page.tsx                console
    benchmark/page.tsx      latency analytics
    api/query/route.ts      mock server + backend proxy
    api/benchmark/route.ts  reads benchmarks/results/*.json
  components/               LatencyStrip · EvidencePanel · AnswerCard · Composer
                            StageRail · Histogram · SessionHistory · SampleQuestions · TopBar
  lib/
    contract.ts             shared types, stage + core metadata, refusal copy
    adapter.ts              backend response → UI model  ← the integration seam
    client.ts               fetch with timeout + one retry
    audio.ts                capture → 16 kHz mono resample → WAV encode, in-browser
    store.ts                per-request latency log in localStorage (live results only)
    mock.ts                 simulated fallback responses
  data/samples.ts           one-click demo queries
docs/api-contract.md
benchmarks/results/
```

## Build notes

- **Audio is encoded client-side.** `MediaRecorder` output differs by browser (webm/opus in Chromium, mp4 in Safari), so it is decoded, resampled through `OfflineAudioContext` and re-encoded to 16 kHz mono WAV before upload.
- **Push-to-talk, not VAD.** Silence detection adds latency and fails on camera.
- **A text path and one-click samples sit alongside the mic**, because most people opening a live link won't grant microphone permission — and a judge who can't get past a permission prompt sees a broken app.
- **Two latency numbers, never one.** RAG-core is the `<200 ms` claim; voice end-to-end includes networked STT and is reported separately and visibly.
- **Mock mode is a shipped feature, not a stub** — answered, low-confidence refusal, off-topic, unsafe-block and extractive-fallback scenarios with realistic per-stage delays.
- **Every live request is logged to `localStorage`** — capped at 500, wrapped in try/catch so private mode degrades quietly. Export writes the harness's own JSON shape, so a session log can be dropped straight into `benchmarks/results/`. Simulated responses are never written.
- **A QR code opens the console on a phone**, encoding `NEXT_PUBLIC_PUBLIC_URL` or the current origin, and warning when the target is localhost and therefore unreachable from a handset.
- Next.js 16 · React 19 · TypeScript · Tailwind v4. No component library, no chart library.
- Responsive from 320 px up; verified zero horizontal overflow at 320 / 375 / 390 / 414 / 820 / 1440 px.
- Stage colours are a single-hue ordinal ramp validated for lightness monotonicity and contrast against the page surface — pipeline stages are ordered in time, so they get one hue stepped, not seven competing hues.

## Stack

`npm run dev` · `npm run build` · `npm run lint`
