"use client";

import { useEffect } from "react";
import { lastRequestId } from "@/lib/rag-client";

/**
 * No path renders an unhandled exception — this is the last line of
 * defence if a component crashes anyway. Shows the last request_id this
 * session saw, since that's what reconstructs a trace across function logs.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--coral)" }}>
        Something broke
      </p>
      <h1 className="display text-2xl text-ink">The console hit an unhandled error.</h1>
      <p className="max-w-md text-sm text-ink-secondary">{error.message || "No error message was provided."}</p>
      {lastRequestId && (
        <p className="num rounded-[3px] bg-surface-2 px-2.5 py-1 text-xs text-ink-secondary">
          last request_id: {lastRequestId}
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-lg px-4 py-2 text-sm font-medium"
        style={{ background: "var(--amber)", color: "#1a1400" }}
      >
        Try again
      </button>
    </div>
  );
}
