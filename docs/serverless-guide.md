# Netlify serverless functions — setup and run guide

Implements `claude/serverless.md`. Six functions from the original spec plus
`samples.mts` (added later, for the console's "Try one" row), four-plus-three
shared libs, zero frontend wiring — see that spec for the full design
rationale. This guide is the practical "how do I run/deploy/test this"
companion.

```
netlify/
  functions/   stt.mts  embed.mts  rerank.mts  search.mts  health.mts
               keepalive.mts  samples.mts
  lib/         sarvam.ts  jina.ts  qdrant.ts  sparse.ts  budget.ts  guardrails.ts  schemas.ts  manifest.ts
  manifest.json  ← real ingestion output (53,444 points, 8 languages)
test/          parity, guardrails, ladder, budget, degrade, schema, lang
netlify.toml
```

`lib/sparse.ts` isn't in the original file list in `claude/serverless.md` —
see the note in that file and in §5 below for why it exists. `samples.mts`
isn't in the spec either — added afterward, documented in §9 below.

---

## 1. One-time setup

`netlify init` is already done — the repo is linked to the `hhg-zenith`
Netlify project (confirmed via `netlify status`).

Install dependencies (already run once, but for a clean clone):

```bash
npm install
```

## 2. Environment variables — set these in the Netlify UI, not in a file

Site configuration → Environment variables → scope **Functions**. Per the
spec, values in `netlify.toml` are invisible to Functions at runtime, and
nothing here should ever be `NEXT_PUBLIC_`-prefixed.

```
SARVAM_API_KEY
JINA_API_KEY
QDRANT_URL
QDRANT_API_KEY
QDRANT_COLLECTION       = msmarco_xi
EMBED_DIM               = 256
JINA_MODEL              = jina-embeddings-v5-text-small
JINA_RERANK_MODEL       = jina-reranker-v2-base-multilingual
TAU_HIGH                = 0.92
TAU_GOOD                = 0.78
TAU_FLOOR                = 0.45
TAU_RERANK_PASS         = 0.35
```

`npx netlify env:list` currently shows **no environment variables set** on
the linked site — none were pushed by this pass, deliberately: they're real
secrets and only the account owner should paste them in. Once set:

```bash
npx netlify env:list                 # confirm they landed
npx netlify build                    # optional: full build sanity check
npx netlify deploy                   # draft deploy — get a preview URL
npx netlify deploy --prod            # when ready to go live
```

None of the four deploy/env-push commands above were run this session —
they either need real secrets or push visible state to the live site, so
they're left for you (or ask me to run them once keys are in hand).

### Local dev — `.env` instead of the UI

For `netlify dev`, a local `.env` file works too (already gitignored via
the existing `.env*` rule). Copy the var names above into a `.env` at the
repo root with real or dummy values.

### Embedding model: switched to `jina-embeddings-v5-text-small`

Both sides — `JINA_MODEL` here and `JINA_MODEL_ID` in
`data_ingestion/ingest_msmarco.ipynb` — were switched together from v3 to
`jina-embeddings-v5-text-small`, since this was decided before any real
ingestion had run (cheap to change now, expensive after). Verified before
switching: same 1024-native dimension (Matryoshka math and the Qdrant
`dense_256`/`dense_1024` schema are unaffected), and the REST API keeps
v3's `task: "retrieval.query"`/`"retrieval.passage"` string convention on
v5 too, so `lib/jina.ts` didn't need a code change beyond the model name.

Local `.encode()` in Colab is a genuinely different call shape on v5,
though — `task="retrieval"` + `prompt_name="query"`/`"document"` instead of
v3's single `task="retrieval.passage"` string — the notebook's `encode()`
helper now maps the (unchanged) `CORPUS_TASK`/`QUERY_TASK` constants to
`prompt_name` via `_PROMPT_NAME`.

**Not yet confirmed: v5-text-small's Indic-language coverage against this
project's actual language set** (Hindi, Kannada, Tamil, Telugu, Malayalam,
Marathi, Odia, Konkani, Bengali). v5's marketing claims 93-language
support but nothing specific to these languages was found. This is exactly
what Phase 0's per-language smoke test (§9 of `claude/ingestion.md`, "print
the retrieved text and read it") and `test/parity.test.ts` exist to catch
— watch both closely on the first real ingestion run, not just the API
response shape.

## 3. `manifest.json` is a placeholder right now

`netlify/manifest.json` currently has `"revision": "PLACEHOLDER_RUN_INGESTION_FIRST"`
and empty `per_language`/`tiers`. `lib/manifest.ts` loads it at module scope
and asserts it against `JINA_MODEL`/`EMBED_DIM`/`query_task` — a mismatch
fails the function at boot rather than serving silently-wrong retrieval.

Once `data_ingestion/ingest_msmarco.ipynb` (see `data_ingestion/guide.md`)
has actually run against the live Qdrant collection, copy its
`manifest.json` output over `netlify/manifest.json`. Field names already
match what the notebook emits (`model`, `revision`, `corpus_task`,
`query_task`, `dims[]`, `per_language`, `tiers`, `projected_points`) — no
translation needed.

## 4. Running functions locally

`netlify dev` OOM'd in this sandbox trying to boot the Next.js dev server
and the functions bundler together (V8 `Fatal process out of memory`) — a
sandbox resource ceiling, not a bug in the functions. It's expected to work
in a normal dev environment; try it there:

```bash
npm run functions:dev        # netlify dev
```

Then, per `claude/serverless.md` §8:

```bash
curl -X POST localhost:8888/fn/stt      -F file=@sample_hi.webm -F language_code=unknown
curl -X POST localhost:8888/fn/embed    -H 'content-type: application/json' -d '{"text":"मुझे बताओ"}'
curl -X POST localhost:8888/fn/search   -H 'content-type: application/json' -d '{"transcript":"..."}'
curl      localhost:8888/fn/health
```

If `netlify dev` isn't practical in your environment either, every function
is a plain `(req: Request) => Promise<Response>` — you can import and call
the default export directly from a Node script for a fast sanity check
without the CLI at all. That's what this session actually used to verify
the six functions, hitting the **real** Jina endpoints with a deliberately
invalid key:

- `/fn/health` → `503 { status: "down", jina: {...}, qdrant: {...}, sarvam: {...} }` — no crash.
- `/fn/embed` with `text: ""` → `400` with the zod error.
- `/fn/rerank` with a bad key → real `401 AUTH_INVALID_API_KEY` from `api.jina.ai`, caught and returned as a typed `{status:"error"}`, not thrown.
- `/fn/search` with `"ab"` → `{status:"refused", reason:"too_short"}` with only a `rag_core` timing — confirming zero API calls were spent.
- `/fn/search` with a real transcript and bad/unreachable creds → embed fails → `degraded:"sparse_only"` path takes over → Qdrant also unreachable → typed `{status:"error", reason:"qdrant_unreachable"}`. The degradation ladder runs exactly as designed, never throwing.

## 5. Design decisions not fully specified in `claude/serverless.md`

Two gaps in the spec had to be resolved with judgment calls — flagging both
so they can be revisited once real ingestion data exists:

**Query-time sparse (BM25) vectors.** The spec's `tier2` builder takes a
`sparse: SparseVec` parameter but never says how the *runtime* produces it
— only how ingestion does (`fastembed`'s `Qdrant/bm25`, with a regex+hash
fallback if Indic tokenization turns out degenerate). There's no reliable
JS port of fastembed's tokenizer, so `lib/sparse.ts` uses the **same**
deterministic regex+md5 fallback scheme ingestion falls back to, on both
sides, so corpus and query sparse indices are guaranteed to line up
regardless of which BM25 path ingestion actually took. **If a future
ingestion run keeps fastembed's real BM25 tokenizer for the corpus (i.e.
the Indic tokenization check in `data_ingestion/ingest_msmarco.ipynb` §6.4
passes and the fallback never triggers), this needs to be revisited** —
the indices won't match a fastembed-tokenized corpus.

**`manifest.json` field names.** `claude/serverless.md` §3.2 sketches
`manifest.dim_primary` / `manifest.total_points`; the ingestion notebook
actually emits `dims: number[]` and `per_language: {lang: {n_points}}`.
`lib/manifest.ts` reconciles this by checking `dims.includes(EMBED_DIM)`
and summing `per_language` for `totalPoints`, rather than assuming the
shorthand keys exist verbatim.

## 6. Verified against live docs this session (not stale training data)

Per `claude/serverless.md` §10:

- **Sarvam STT**: `POST https://api.sarvam.ai/speech-to-text`, header
  `api-subscription-key` (not `Authorization`). Default model is now
  `saaras:v3` (the spec assumed `saarika:v2`, which is legacy).
  `language_code: "unknown"` auto-detect is supported. `lib/sarvam.ts`
  pins `mode: "transcribe"` explicitly so multilingual audio comes back in
  its own script rather than translated to English — `saaras` also
  supports a `translate` mode that would silently break the `lang` filter
  everywhere else in the pipeline if it were ever the default.
- **Jina rerank**: `jina-reranker-v2-base-multilingual` is still live and
  correct. Jina's own docs flag it as superseded by `jina-reranker-v3`
  (newer listwise architecture, larger context) — not required, but worth
  considering as the `JINA_RERANK_MODEL` value during calibration.
- **Netlify Functions sync timeout**: 10s on Free/Personal, 26s on Pro.
  `lib/budget.ts` budgets `search.mts` to 9s, leaving headroom under the
  conservative 10s figure.
- **`@qdrant/js-client-rest`**: pinned to `1.19.0` (current). Nested
  `prefetch` (fusion-of-two-prefetches, rescored by an outer query) is
  Qdrant's documented multi-stage query pattern and is supported — no need
  to split `tier2Query` into two round trips.
- **Netlify Scheduled Functions**: `export const config: Config = { schedule: "..." }`
  is current v2 syntax; cron is UTC. No documented minimum interval was
  found for the free tier — `keepalive.mts`'s `*/4 * * * *` is expected to
  work; confirm by checking the function log after deploy.

## 7. Tests

```bash
npm test          # vitest run — all 7 required test files
```

Current result: **33 passed, 3 skipped** (7 files). The skips are
`lang.test.ts`'s three cases — that test needs a live, populated Qdrant
collection plus real `JINA_API_KEY`, so it self-skips via
`describe.skipIf` until ingestion has actually run and env vars are set.
`parity.test.ts` self-skips the same way until
`test/fixtures/parity_vectors.json` has real Colab-generated reference
vectors (currently an empty placeholder — see the comment in that file).

| Test | What it needs to stop skipping |
|---|---|
| `schema.test.ts` | nothing — always runs |
| `guardrails.test.ts` | nothing — always runs |
| `ladder.test.ts` | nothing — always runs |
| `budget.test.ts` | nothing — always runs |
| `degrade.test.ts` | nothing — always runs (mocks `fetch`) |
| `parity.test.ts` | `JINA_API_KEY` + populated `test/fixtures/parity_vectors.json` |
| `lang.test.ts` | `QDRANT_URL`/`QDRANT_API_KEY`/`JINA_API_KEY` + a populated collection |

## 8. Definition-of-done status (`claude/serverless.md` §11)

Done this session: all six functions written and individually smoke-tested;
`search.mts` performs exactly one Qdrant round trip (`queryBatch`) plus at
most one Jina embed call, and imports `lib/jina.ts`/`lib/qdrant.ts`
directly (no `fetch()` to `/api/*` anywhere — greppable); the four-band
ladder with env-only thresholds; rerank score never compared against a
cosine threshold; `manifest.ts` fails boot on mismatch; `timings_ms` on
every response with `rag_core` excluding STT; no secret in `netlify.toml`
or `NEXT_PUBLIC_`; all 7 test files present and passing (with honest skips).

Still open, and blocked on things outside this pass's scope: a **real**
Netlify deploy + `curl` against it (needs env vars set in the UI first);
keepalive confirmed firing in the deploy log; a measured Jina embed P50
from a *deployed* function recorded in a `docs/latency.md`; the
degradation ladder demoed against a *real* collection by unsetting
`JINA_API_KEY` (this session's version of that check used dummy/unreachable
credentials against a non-existent collection, which is the same code path
but not the real thing).

## 9. `/fn/samples` — random real queries for "Try one"

`GET /fn/samples` — added after the original six, for the console's preset
row (`src/components/RagSampleQuestions.tsx`). Returns up to 5 random real
indexed queries, one per language where possible, so "Try one" is different
on every page load instead of a fixed static list.

**Deliberately not built on Qdrant's native `query: {sample: "random"}`.**
That parameter is real (shipped in Qdrant server 1.11, Aug 2024) but two
things about it couldn't be confirmed against this project's actual
Qdrant Cloud Free cluster: whether the cluster is actually on ≥1.11, and
whether the pinned `@qdrant/js-client-rest@1.19.0`'s generated TS types
cleanly expose the `sample` variant. Given the ask was explicitly "minimum
chance of failure," the function instead:

1. On cold start, runs one `qdrant.scroll()` per language in
   `manifest.languages` (8 calls, `filter: {strategy: "query", lang}`,
   `limit: 20`) — a fully-documented, version-independent primitive with no
   dependency on when random-sampling support landed. Zero calls to Jina or
   Sarvam; this is a pure payload filter, not a similarity search.
2. Caches the resulting per-language pools at module scope (reused across
   warm invocations, 1h TTL as a staleness safety net only — the corpus is
   static, so freshness was never the concern).
3. Does the actual randomization **in-process** via `Math.random()` on every
   request — `scroll()` returns points in ID order, not random order, so
   the randomness has to come from the function itself either way, and this
   sidesteps the whole "does the server/client support native sampling"
   question entirely.
4. Prefers one sample per distinct language before filling any remaining
   slots — otherwise a naive random pick over a pooled list can plausibly
   return 5 queries in the same language.

**Never throws, matches the house style** — a fully-unreachable Qdrant
degrades every per-language scroll to an empty pool and the handler still
returns a clean `200 {status:"ok", samples:[]}`, not a 5xx. The client
(`src/lib/rag-client.ts`'s `samples()`) treats an empty or failed response
as "keep showing the five curated presets" — `RagSampleQuestions.tsx`
never renders an empty "Try one" section, live data or not.
