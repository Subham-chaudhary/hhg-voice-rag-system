# Running the MSMARCO-XI ingestion in Colab

Implements `claude/ingestion.md`. Two files matter:

- `config.py` — paste your API keys here.
- `ingest_msmarco.ipynb` — the pipeline, run top to bottom.

## 1. Open in Colab

Easiest: clone the repo from inside Colab so `config.py` sits next to the
notebook automatically.

```
!git clone https://github.com/<your-org>/hhg-voice-rag-system.git
```

Then open `hhg-voice-rag-system/data_ingestion/ingest_msmarco.ipynb` in
Colab (File > Open notebook > GitHub, or upload it manually), or just
`%cd hhg-voice-rag-system/data_ingestion` and continue in a fresh Colab
notebook using this repo copy.

If you'd rather not clone: upload `config.py` and `ingest_msmarco.ipynb`
into the same Colab session folder (the file icon on the left sidebar >
upload) before running anything.

## 2. Set the runtime

Runtime > Change runtime type > **T4 GPU** (or better).

## 3. Paste your keys

Open `config.py` (double-click it in the Colab file browser, or edit it
locally before uploading) and fill in the `CFG = Config(...)` block near
the bottom:

```python
CFG = Config(
    QDRANT_URL="https://xxxxxxxx.us-east.aws.cloud.qdrant.io:6333",
    QDRANT_API_KEY="...",
    HF_TOKEN="",   # only needed if ai4bharat/MSMARCO-XI turns out to be gated
)
```

Leaving a field as `""` falls back to an environment variable of the same
name, if you'd rather set `os.environ["QDRANT_API_KEY"] = "..."` in a cell
or use Colab's Secrets panel instead of editing the file.

## 4. Run the notebook, in order

1. **Setup** — installs deps, mounts Drive, loads `config.py`.
2. **Phase 0 (hard-stop gate)** — streams one row from each language config
   and prints a report: config names, whether a gold-passage signal exists,
   passage container shape, ID stability, gating. **Read the printed
   report.** If there's no gold-passage signal, stop and reconsider —
   there's no Recall@10 ground truth without it.
3. Edit the `FIELD_MAP` cell right after Phase 0 to match what the report
   showed, then set `PHASE0_CONFIRMED = True`. The cell asserts on this —
   it will not let you continue silently.
4. Run the rest top to bottom: matryoshka check, tier resolution, unit
   construction, embedding, Qdrant collection creation, the per-language
   upsert loop, index build + acceptance checks, artifact export.

Total wall-clock: ~2-3 hours on a T4 for the full ~290k-point run.

## 5. Resuming after a Colab disconnect

Everything that matters is written to `CFG.DRIVE_DIR`
(`/content/drive/MyDrive/msmarco_xi_ingestion` by default), which survives
disconnects because it's on mounted Drive, not `/content`:

- `ckpt_msmarco.json` — last language + batch offset upserted.
- `emb_{lang}_{dim}.npy` — embeddings per language, per dimension.
- `sampled_qids_{lang}.json` — held-out benchmark bookkeeping.

Reconnect, re-run the Setup and Phase 0/FIELD_MAP cells (Phase 0 is cheap —
one row per config), then re-run the orchestration cell in section 9.
Point IDs are deterministic (`uuid5` of a stable string key), so re-running
a language that already finished just re-upserts the same points — it does
not duplicate them.

## 6. What you get at the end

In `CFG.DRIVE_DIR`:

| File | Purpose |
|---|---|
| `manifest.json` | model revision, task adapters, dims, per-language point counts — the contract the query-time runtime should assert against |
| `field_map.json` | the Phase 0 discovery result |
| `ingest_report.md` | acceptance-check summary |
| `sampled_qids_{lang}.json` | so a later benchmark can draw from held-out queries |
| `emb_{lang}_{dim}.npy` | raw embeddings, insurance against the Qdrant Free cluster being deleted after 4 weeks idle |

Plus a live `msmarco_xi` collection in Qdrant Cloud with `dense_256` (wide,
quantized, on-disk) + `dense_1024` (rerank-only, `m=0`) + `sparse_bm25`
named vectors, and payload indexes on `lang`, `strategy`, `tier`, `qid`,
`parent_id`, `is_gold`.
