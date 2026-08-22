"use client";

import { EvidenceList } from "./EvidenceList";
import { RequestIdBadge } from "./RequestIdBadge";
import { DegradedBanner, RerankFailedNote } from "./DegradedBanner";
import type { SearchResponse } from "@/lib/rag-types";

const REFUSAL_COPY: Record<string, { title: string; body: string }> = {
  empty: { title: "Nothing to work with", body: "The query was empty." },
  too_short: { title: "Too short to search", body: "That query is under the minimum length." },
  too_long: { title: "Too long to search", body: "That query is over the maximum length." },
  no_content: { title: "No usable text", body: "The query had no letters or digits to search on." },
  unsafe_content: { title: "Blocked before retrieval", body: "The safety filter rejected this input. It never reached the index." },
};

function Tag({ children, color, background }: { children: React.ReactNode; color?: string; background?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[3px] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]"
      style={{ color: color ?? "var(--ink-secondary)", background: background ?? "var(--surface-2)" }}
    >
      {children}
    </span>
  );
}

function Shell({
  accent,
  eyebrow,
  requestId,
  children,
}: {
  accent: string;
  eyebrow: React.ReactNode;
  requestId: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rise relative overflow-hidden rounded-xl border border-hairline bg-surface-1 p-5 sm:p-6"
      style={{ boxShadow: `inset 3px 0 0 0 ${accent}` }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {eyebrow}
        <span className="ml-auto">
          <RequestIdBadge requestId={requestId} />
        </span>
      </div>
      {children}
    </section>
  );
}

export function ResultCard({ result }: { result: SearchResponse }) {
  const evidence = result.evidence ?? [];

  if (result.status === "refused") {
    const fallbackCopy = { title: "Declined before retrieval", body: result.reason ?? "The guardrail rejected this query." };
    const copy = result.reason ? (REFUSAL_COPY[result.reason] ?? fallbackCopy) : fallbackCopy;
    return (
      <Shell
        accent="var(--ink-muted)"
        requestId={result.request_id}
        eyebrow={<Tag>Refused — a decision, not an error</Tag>}
      >
        <h2 className="display mt-4 text-2xl text-ink">{copy.title}</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-secondary">{copy.body}</p>
        <p className="mt-4 rounded-lg bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-muted">
          Rejected before a single embedding, retrieval, or rerank call — zero API calls spent.
        </p>
      </Shell>
    );
  }

  if (result.status === "error") {
    return (
      <Shell
        accent="var(--status-critical)"
        requestId={result.request_id}
        eyebrow={
          <Tag color="var(--status-critical)" background="rgba(208,59,59,0.14)">
            Pipeline error
          </Tag>
        }
      >
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-secondary">
          {result.reason ?? "The pipeline returned an error."}
        </p>
      </Shell>
    );
  }

  if (result.status === "abstained") {
    return (
      <Shell
        accent="var(--coral)"
        requestId={result.request_id}
        eyebrow={
          <>
            <Tag color="var(--coral)" background="var(--coral-wash)">
              Abstained
            </Tag>
            {result.confidence !== undefined && <Tag>{`confidence ${result.confidence.toFixed(3)}`}</Tag>}
          </>
        }
      >
        {result.degraded && <div className="mt-4"><DegradedBanner reason={result.degraded} /></div>}
        <h2 className="display mt-4 text-2xl text-ink">Below the confidence floor</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-secondary">
          Retrieval returned passages, but none cleared the confidence gate. Answering from them would mean
          guessing — the evidence below is shown anyway, marked insufficient.
        </p>
        <div className="mt-5">
          <EvidenceList evidence={evidence} muted />
        </div>
      </Shell>
    );
  }

  // "answered" (early exit) or "ok" (proceed / rerank)
  const isAnswered = result.status === "answered";
  return (
    <Shell
      accent="var(--amber)"
      requestId={result.request_id}
      eyebrow={
        <>
          <Tag color="var(--amber-bright)" background="var(--amber-wash)">
            {isAnswered ? "Answered — early exit" : "Retrieved"}
          </Tag>
          {result.early_exit && <Tag color="var(--status-good)" background="rgba(12,163,12,0.12)">Early exit</Tag>}
          {result.reranked && <Tag color="var(--stage-5)" background="var(--surface-2)">Reranked</Tag>}
          {result.confidence !== undefined && <Tag>{`confidence ${result.confidence.toFixed(3)}`}</Tag>}
        </>
      }
    >
      {result.degraded && <div className="mt-4"><DegradedBanner reason={result.degraded} /></div>}

      {isAnswered && result.answer ? (
        <p className="mt-4 text-[19px] leading-[1.55] text-ink sm:text-[21px]">{result.answer}</p>
      ) : (
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-secondary">
          Evidence cleared the confidence gate{result.reranked ? " after reranking" : ""}. This phase does not
          generate a free-text answer — that endpoint is next; below is exactly what retrieval found.
        </p>
      )}
      {result.degraded === "rerank_failed" && <RerankFailedNote />}

      <div className="mt-5">
        <EvidenceList evidence={evidence} />
      </div>
    </Shell>
  );
}
