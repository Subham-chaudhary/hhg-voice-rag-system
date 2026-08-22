"use client";

import { RequestIdBadge } from "./RequestIdBadge";
import type { RagError } from "@/lib/use-rag";

/**
 * Hook-level failures — distinct from a typed SearchResponse with
 * status:"error". Per integrate.md §7: a zod parse failure must look
 * different from a plain network error, and neither auto-retries.
 */
export function PipelineErrorCard({ error, onRetryText }: { error: RagError; onRetryText?: () => void }) {
  if (error.kind === "stt") {
    return (
      <Shell accent="var(--coral)" tag="Transcription failed" requestId={error.requestId}>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-secondary">{error.message}</p>
        <p className="mt-3 text-xs text-ink-muted">
          The transcript box below is still open — type the question instead. The function already retried
          once internally; this won&apos;t retry again automatically.
        </p>
      </Shell>
    );
  }

  if (error.kind === "contract") {
    return (
      <Shell accent="var(--hhg-pink)" tag="Contract mismatch" requestId={error.requestId}>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-secondary">
          The function returned a response that doesn&apos;t match the shape this UI expects. That means the
          function changed, not that the network failed.
        </p>
        <p className="mt-2 num text-xs text-ink-muted">{error.message}</p>
      </Shell>
    );
  }

  return (
    <Shell accent="var(--status-critical)" tag="Network error" requestId={error.requestId}>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-secondary">{error.message}</p>
      {onRetryText && (
        <button
          type="button"
          onClick={onRetryText}
          className="mt-3 rounded-lg bg-surface-2 px-3.5 py-1.5 text-xs text-ink-secondary transition-colors hover:text-ink"
        >
          Retry
        </button>
      )}
    </Shell>
  );
}

function Shell({
  accent,
  tag,
  requestId,
  children,
}: {
  accent: string;
  tag: string;
  requestId: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rise relative overflow-hidden rounded-xl border border-hairline bg-surface-1 p-5 sm:p-6"
      style={{ boxShadow: `inset 3px 0 0 0 ${accent}` }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-[3px] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]"
          style={{ color: accent, background: "var(--surface-2)" }}
        >
          {tag}
        </span>
        <span className="ml-auto">
          <RequestIdBadge requestId={requestId} />
        </span>
      </div>
      {children}
    </section>
  );
}
