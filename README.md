# Zenith — voice RAG console

By **The Higher Celestials**, for Hacker House Goa 2026, Shortlisting Task 2.

Ask a question — by voice or text, in eight languages — and get back retrieved evidence, live,
with the confidence gate, timing, and retrieval strategy all visible instead of hidden behind a
spinner. No mocks, no simulated fallback: this hits real Netlify Functions, a real Qdrant
collection, and a real Jina model, end to end.

```
mic / text
   │
   ▼
POST /fn/stt ─────────────► Sarvam         (voice only; skipped for text)
   │  transcript + language
   ▼
POST /fn/search ──────────► Jina embed → Qdrant hybrid retrieve → confidence gate → [rerank]
   │  evidence + timings_ms + confidence
   ▼
answered · ok · abstained · refused · error
```

This is the **retrieval phase**. There's no LLM generation yet — that's next. What you get today
is real, traced-to-source evidence, not a made-up answer.

---

## Run it

```bash
npm install
cp .env.example .env      # paste in your keys — see below
npm run functions:dev     # netlify dev — runs the UI *and* the Netlify Functions together
```

Open `http://localhost:8888`. Hold the mic button or type a question, or tap one of the five
presets. `npm run dev` (plain `next dev`, port 3000) also works if you only want the UI — the
`/fn/*` calls will just 404 until you run functions alongside it.

### Environment variables

Everything the app reads is listed and commented in **[`.env.example`](.env.example)** — copy it
to `.env` and fill in:

| Variable | What breaks without it |
|---|---|
| `SARVAM_API_KEY` | Voice input — text still works |
| `JINA_API_KEY` | Falls back to sparse-only (BM25) retrieval — see *degradation demo* below |
| `QDRANT_URL` / `QDRANT_API_KEY` | All retrieval — `/fn/health` reports `down` |
| `QDRANT_COLLECTION`, `EMBED_DIM`, `JINA_MODEL`, `JINA_RERANK_MODEL` | Must match what `data_ingestion/` actually ingested — asserted at boot, fails loudly if wrong |
| `TAU_HIGH` / `TAU_GOOD` / `TAU_FLOOR` / `TAU_RERANK_PASS` | Tunable confidence thresholds — see the ladder below |

Netlify Functions env vars go in the Netlify UI (Site configuration → Environment variables,
scope **Functions**) for a real deploy — `.env` is for local `netlify dev` only. Full rationale
in [`docs/serverless-guide.md`](docs/serverless-guide.md).

---

## What's actually cool here

**A real, multilingual index.** 53,444 points across Hindi, Kannada, Tamil, Malayalam, Marathi,
Odia, Bengali and English, built from `ai4bharat/MSMARCO-XI` with five retrieval strategies
(atomic passages, sentence windows, query-enriched, cross-lingual twins, and a query fast-path) —
not a toy demo corpus.

**The four-band confidence ladder, visible live.** Every query lands in one of four bands —
*early exit* (near-exact match, ~120 ms, no rerank), *proceed* (confident enough, skip the
rerank), *rerank* (genuinely ambiguous — worth the extra latency), or *abstain* (nothing relevant,
say so instead of guessing). The console shows which one fired, not just a spinner.

**Watch it degrade on purpose.** Unset `JINA_API_KEY` and ask a question anyway — the search still
returns real results from sparse (BM25) retrieval alone, with a banner explaining exactly what's
degraded and why. This is the actual failure-recovery story, demonstrated, not claimed.

**Session latency that doesn't lie.** P50 / P70 / P100 for the *fast path* and the *rerank path*,
reported separately with the rerank rate — a blended number alone hides the slow path. This log
now **persists in your browser** (localStorage) across reloads, and feeds `/benchmark` directly:
run a few queries on the console, then check `/benchmark` — it shows your own history the moment
there's no official harness `final.json` yet.

**Five one-tap presets** — normal, ambiguous, an Indic-language query, a deliberate no-match, and
an adversarial input the guardrail should refuse before a single API call — so a demo never
depends on typing under pressure.

**Every response carries a `request_id`**, copyable in the UI, that reconstructs the same request
across both the `/fn/stt` and `/fn/search` function logs.

---

## Project layout

```
netlify/
  functions/     stt · embed · rerank · search · health · keepalive  (the actual backend)
  lib/           sarvam · jina · qdrant · sparse · budget · guardrails · schemas · manifest
  manifest.json  the ingestion contract — asserted against env at boot, fails loudly on mismatch

src/
  app/
    page.tsx              the console
    benchmark/page.tsx    latency analytics (harness file, or local history as fallback)
  components/    Composer (push-to-talk) · StageTimeline · ResultCard · EvidenceList ·
                 SessionLatencyPanel · RagSampleQuestions · DegradedBanner · ...
  lib/           rag-client.ts (the only file allowed to call /fn/*) · use-rag.ts (state
                 machine) · rag-store.ts (localStorage session log) · rag-schemas.ts

data_ingestion/  the Colab notebook that actually built the index, + a run guide
test/            7 vitest suites covering the functions — parity, guardrails, ladder,
                 budget, degrade, schema, lang
docs/            serverless-guide.md, ingestion guide, the (future-phase) API contract
```

`src/lib/{contract,adapter,client,mock,store}.ts` and `src/app/api/query/route.ts` are
scaffolding for a **later** LLM-generation phase — not wired into the current console, kept
around so that phase doesn't start from zero.

---

## Testing

```bash
npm test           # vitest — the 7 suites above, run against the functions directly
npm run lint        # eslint
npx tsc --noEmit    # typecheck
```

Or exercise a function directly:

```bash
curl -X POST localhost:8888/fn/search -H 'content-type: application/json' \
  -d '{"transcript":"how long does caffeine stay in your system"}'
curl localhost:8888/fn/health
```

`parity.test.ts` is the one that matters most before trusting any retrieval result — it checks
that this app's query-time embeddings still agree with what the corpus was actually built with.

---

## Read next

- [`docs/serverless-guide.md`](docs/serverless-guide.md) — how the functions are built, what's
  been verified against live provider docs, and known open risks (e.g. sparse-vector tokenizer
  parity).
- [`data_ingestion/guide.md`](data_ingestion/guide.md) — how to run the ingestion notebook.
- [`docs/api-contract.md`](docs/api-contract.md) — the contract for the *future* generation
  phase, not what's live today.
