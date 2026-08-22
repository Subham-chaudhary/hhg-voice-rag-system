import manifest from "../../netlify/manifest.json";
import { languageName } from "@/lib/rag-types";

// Plain JSON import, not netlify/lib/manifest.ts — that file's module-scope
// assertManifest() reads process.env.JINA_MODEL etc. and would throw in a
// browser context where those aren't defined. This is just static corpus
// data with no side effects, safe to bundle client-side.

export function CorpusStats() {
  const languages = Object.entries(manifest.languages).sort(([, a], [, b]) => b - a);

  return (
    <section className="mt-6 rounded-xl border border-hairline bg-surface-1 p-5 sm:p-6">
      <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">Pure retrieval — no LLM</p>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-secondary">
        Every result on this page and on the console comes directly from a Qdrant vector search
        over <code className="num">{manifest.dataset}</code> — nothing here is generated. Each
        retrieved passage traces back to an exact record (<code className="num">qid</code>) in the
        source dataset, not an invented answer. LLM-based generation is a later phase, not part of
        this pipeline today.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] sm:grid-cols-4">
        <div>
          <dt className="text-ink-muted">Total points</dt>
          <dd className="num mt-0.5 text-ink">{manifest.total_points.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Collection</dt>
          <dd className="num mt-0.5 text-ink-secondary">{manifest.collection}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-ink-muted">Strategies</dt>
          <dd className="mt-0.5 text-ink-secondary">{manifest.strategies.join(" · ")}</dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-hairline pt-4">
        <p className="text-[11px] uppercase tracking-[0.12em] text-ink-muted">Points by language</p>
        <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
          {languages.map(([code, count]) => (
            <li key={code} className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="text-ink-secondary">{languageName(code)}</span>
              <span className="num text-ink">{count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
