"use client";

import { useState } from "react";

export function RequestIdBadge({ requestId }: { requestId: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(requestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy request_id — reconstructs this trace across both function logs"
      className="num inline-flex items-center gap-1.5 rounded-[3px] bg-surface-2 px-2 py-0.5 text-[10px] text-ink-secondary transition-colors hover:text-ink"
    >
      {copied ? "copied" : requestId}
    </button>
  );
}
