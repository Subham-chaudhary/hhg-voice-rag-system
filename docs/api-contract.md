# Zenith ⇄ pipeline API contract

The UI on the `ui` branch is built against this contract and ships a mock server that
implements it exactly. Match this shape and integration is a one-line environment change.

**Base URL** is whatever `BACKEND_URL` points at. The UI proxies through its own
`/api/query` route by default, so the backend does **not** need CORS headers.

---

## 1. `POST /query`

Two accepted request bodies.

**Text path** — `application/json`

```json
{ "transcript": "How long does caffeine stay in your system?", "language": "en" }
```

**Voice path** — `multipart/form-data`

| field | type | notes |
|---|---|---|
| `audio` | file | 16 kHz mono 16-bit PCM WAV. The browser resamples and encodes; no transcoding needed server-side. |
| `language` | string | optional BCP-47-ish code. Omit or send `unknown` for auto-detect. |
| `transcript` | string | optional; present only when replaying a known query. |

`language` is a hint, never an override — return whatever Sarvam actually detected.

---

## 2. Response

One JSON object, same shape for every outcome. HTTP 200 for `answered` and `refused`
alike — a refusal is a successful request.

```json
{
  "status": "answered",
  "answer": "Caffeine is absorbed within about forty-five minutes…",
  "transcript": "How long does caffeine stay in your system?",
  "language": "en",
  "confidence": 0.913,
  "threshold": 0.62,
  "evidence_ids": ["msx-en-330218-p1-a", "msx-en-330218-p3-c2"],
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
    "stt": 412.0,
    "validate": 2.1,
    "embed": 14.6,
    "retrieve": 9.8,
    "rank": 3.4,
    "generate": 68.0,
    "ground": 5.2,
    "rag_core": 124.3,
    "voice_e2e": 584.7
  },
  "model": "groq/openai-gpt-oss-20b",
  "trace_id": "req_01J…",
  "fallback": null
}
```

### The three fields that carry the whole submission

**`evidence[]` — objects, not just IDs.** `evidence_ids` alone cannot be rendered. The
evidence panel and the retrieval inspector are what make the "vast chunking" requirement
visible to a judge; without the objects there is nothing to show.

**`latency_ms` — per stage, not just a total.** The stage breakdown *is* the proof for the
`<200 ms` requirement. `rag_core` must cover **transcript available → verified answer** and
must exclude STT. `voice_e2e` is optional and reported separately by the UI.

**`representation`** — which chunking strategy produced the hit. Accepted values (aliases in
parentheses are also understood):

| value | shown as |
|---|---|
| `atomic` (`a`, `passage`) | A · Atomic passage |
| `sentence_window` (`b`, `window`) | B · Sentence window |
| `semantic` (`c`) | C · Semantic |
| `parent_child` (`d`, `child`) | D · Parent-child |
| `metadata` (`e`, `metadata_aware`) | E · Metadata-aware |
| `query_enriched` (`f`, `enriched`) | F · Query-enriched |
| `cross_lingual` (`g`, `twin`) | G · Cross-lingual twin |

Send `parent_text` on `parent_child` hits — the UI renders the expanded parent inline.

### Refusal

```json
{
  "status": "refused",
  "answer": "",
  "transcript": "Should I buy this stock right now?",
  "language": "en",
  "confidence": 0.318,
  "threshold": 0.62,
  "refusal_reason": "insufficient_evidence",
  "evidence": [ "…the chunks that were retrieved but rejected…" ],
  "latency_ms": { "validate": 1.4, "embed": 14.2, "retrieve": 9.1, "rank": 2.6, "ground": 1.1, "rag_core": 60.2 }
}
```

Recognised `refusal_reason` values — anything unknown falls back to `insufficient_evidence`:

`insufficient_evidence` · `off_topic` · `unsafe_input` · `empty_or_unintelligible` · `ungrounded_answer`

Keep returning `evidence[]` on a low-confidence refusal. Showing the chunks that were found
*and rejected* is the strongest possible demonstration of the confidence gate — the UI
displays them with their scores beside the refusal.

Omit stages that never ran. The UI renders them as `skipped`, which is exactly the story you
want for an unsafe input blocked before retrieval.

### Error

```json
{ "status": "error", "detail": "Qdrant unreachable" }
```

The UI retries once on 408/425/429/5xx, then surfaces the error state.

---

## 3. Tolerances already built in

The adapter (`src/lib/adapter.ts`) is the only file that needs to change if your shape
differs, and it already normalises a lot. It accepts snake_case or camelCase, tolerates the
response being wrapped in `result` / `data` / `response`, and understands these aliases:

- **evidence array**: `evidence` · `chunks` · `contexts` · `sources` · `documents` · `passages` · `hits`
- **chunk text**: `text` · `content` · `passage` · `chunk` · `body` · `page_content`
- **chunk id**: `id` · `chunk_id` · `evidence_id` · `doc_id` · `_id`
- **latency container**: `latency_ms` · `latencies` · `timings` · `timing`
- **stage names**: `stt`/`transcribe`/`asr`, `retrieve`/`search`/`qdrant`, `rank`/`fuse`/`rrf`, `generate`/`llm`, `ground`/`verify`
- **status**: `ok`/`success` → answered, `abstain`/`no_answer` → refused

If `rag_core` is missing it is summed from the stages. Anything genuinely different — tell
me the shape and I will map it rather than asking you to change the backend.

---

## 4. Benchmark results file

The `/benchmark` page reads `benchmarks/results/*.json`, preferring a filename containing
`final`. Write the harness output here and the page fills in — no UI change needed.

```json
{
  "label": "final run, commit 9f2c1ab",
  "commit": "9f2c1ab",
  "measured_at": "2026-08-22T09:12:00Z",
  "warmups": 10,
  "repeats": 2,
  "timeouts": 0,
  "errors": 0,
  "records": [
    {
      "query_id": "q0001",
      "language": "hi",
      "status": "answered",
      "rag_core": 148.2,
      "voice_e2e": 612.4,
      "stages": { "stt": 421.0, "validate": 1.9, "embed": 14.2, "retrieve": 9.4, "rank": 3.1, "generate": 71.0, "ground": 4.8 }
    }
  ]
}
```

P50 / P70 / P100, mean, σ, the histogram and the per-language table are all computed from
`records` — do not precompute them.

`benchmarks/results/example.json` currently holds **synthetic** data so the page can be
reviewed, and the UI labels it as such in red. Delete it once `final.json` exists.

---

## 5. Running the UI against the backend

```bash
cp .env.example .env.local     # set BACKEND_URL
npm run dev
```

The header has a **MOCK / LIVE** switch. Mock runs entirely in the browser process against
the built-in scenarios, so the interface stays demoable whether or not the pipeline is up.
