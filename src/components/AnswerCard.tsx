"use client";

import { QueryResult, REFUSAL_COPY } from "@/lib/contract";
import { percent } from "@/lib/format";

export function AnswerCard({ result }: { result: QueryResult }) {
  if (result.status === "error") return <ErrorState result={result} />;
  if (result.status === "refused") return <RefusalState result={result} />;
  return <AnsweredState result={result} />;
}

function Shell({
  accent,
  eyebrow,
  children,
}: {
  accent: string;
  eyebrow: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rise relative overflow-hidden rounded-xl border border-hairline bg-surface-1 p-5 sm:p-6"
      style={{ boxShadow: `inset 3px 0 0 0 ${accent}` }}
    >
      <div className="flex flex-wrap items-center gap-2">{eyebrow}</div>
      {children}
    </section>
  );
}

function AnsweredState({ result }: { result: QueryResult }) {
  return (
    <Shell
      accent="var(--amber)"
      eyebrow={
        <>
          <Tag color="var(--amber-bright)" background="var(--amber-wash)">
            Answered
          </Tag>
          <Tag>{result.languageName}</Tag>
          {result.model && <Tag mono>{result.model}</Tag>}
          {result.fallback && <Tag color="var(--coral)" background="var(--coral-wash)">Extractive fallback</Tag>}
        </>
      }
    >
      <p className="mt-4 text-[19px] leading-[1.55] text-ink sm:text-[21px]">{result.answer}</p>

      {result.evidenceIds.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
          <span className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Grounded in</span>
          {result.evidenceIds.map((id) => (
            <span key={id} className="num rounded-[3px] bg-surface-2 px-2 py-0.5 text-[11px] text-ink-secondary">
              {id}
            </span>
          ))}
        </div>
      )}

      <ConfidenceMeter confidence={result.confidence} threshold={result.threshold} />
    </Shell>
  );
}

function RefusalState({ result }: { result: QueryResult }) {
  const copy = result.refusalCode
    ? REFUSAL_COPY[result.refusalCode]
    : { title: "Below the horizon", body: "The pipeline declined to answer this query." };

  return (
    <Shell
      accent="var(--coral)"
      eyebrow={
        <>
          <Tag color="var(--coral)" background="var(--coral-wash)">
            <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden fill="none" className="inline-block">
              <circle cx="6" cy="6" r="4.6" stroke="currentColor" strokeWidth="1.4" />
              <path d="M3.4 8.6L8.6 3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Refused
          </Tag>
          <Tag>{result.languageName}</Tag>
        </>
      }
    >
      <h2 className="display mt-4 text-2xl text-ink">{copy.title}</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-secondary">{copy.body}</p>
      {result.refusalReason && (
        <p className="mt-2 text-xs text-ink-muted">{result.refusalReason}</p>
      )}

      <p className="mt-4 rounded-lg bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-muted">
        This is a deliberate outcome, not a failure. Zenith answers only from retrieved evidence and stays
        silent when the evidence does not support an answer.
      </p>

      <ConfidenceMeter confidence={result.confidence} threshold={result.threshold} failed />
    </Shell>
  );
}

function ErrorState({ result }: { result: QueryResult }) {
  return (
    <Shell
      accent="var(--status-critical)"
      eyebrow={
        <Tag color="var(--status-critical)" background="rgba(208,59,59,0.14)">
          <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden fill="none" className="inline-block">
            <path d="M6 2.6v3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="6" cy="9" r="0.85" fill="currentColor" />
          </svg>
          Pipeline error
        </Tag>
      }
    >
      <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-secondary">
        {result.refusalReason ?? "The pipeline did not return a usable response."}
      </p>
      <p className="mt-4 rounded-lg bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-muted">
        The harness retried once before surfacing this. Switch to mock mode to keep demonstrating the
        interface while the backend is unavailable.
      </p>
    </Shell>
  );
}

function ConfidenceMeter({
  confidence,
  threshold,
  failed = false,
}: {
  confidence: number;
  threshold: number | null;
  failed?: boolean;
}) {
  const width = Math.max(1.5, Math.min(100, confidence * 100));
  const gate = threshold !== null ? Math.min(100, threshold * 100) : null;

  return (
    <div className="mt-5 border-t border-hairline pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Retrieval confidence</span>
        <span className="num text-xs text-ink">
          {percent(confidence)}
          {threshold !== null && <span className="text-ink-muted"> · gate {percent(threshold, 0)}</span>}
        </span>
      </div>

      <div
        className="relative mt-2 h-2 w-full rounded-[2px]"
        style={{ background: failed ? "rgba(251,113,133,0.18)" : "var(--stage-7)" }}
      >
        <div
          className="h-full rounded-[2px]"
          style={{ width: `${width}%`, background: failed ? "var(--coral)" : "var(--amber)" }}
        />
        {gate !== null && (
          <div
            className="absolute inset-y-[-3px] w-px bg-[var(--line-strong)]"
            style={{ left: `${gate}%` }}
            title={`Confidence gate ${percent(threshold ?? 0, 0)}`}
          />
        )}
      </div>
    </div>
  );
}

function Tag({
  children,
  color,
  background,
  mono,
}: {
  children: React.ReactNode;
  color?: string;
  background?: string;
  mono?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[3px] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ${mono ? "num tracking-normal normal-case" : ""}`}
      style={{
        color: color ?? "var(--ink-secondary)",
        background: background ?? "var(--surface-2)",
      }}
    >
      {children}
    </span>
  );
}
