"use client";

import { useMemo, useState } from "react";
import { RAG_CORE_BUDGET_MS } from "@/lib/contract";
import { histogram } from "@/lib/format";

interface Marker {
  label: string;
  value: number;
  emphasis?: boolean;
}

export function Histogram({
  samples,
  markers,
  budget = RAG_CORE_BUDGET_MS,
  height = 190,
}: {
  samples: number[];
  markers: Marker[];
  budget?: number | null;
  height?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const { bins, min, max } = useMemo(() => histogram(samples, 28), [samples]);
  const peak = useMemo(() => Math.max(1, ...bins.map((bin) => bin.count)), [bins]);

  if (!samples.length) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-surface-2 text-xs text-ink-muted"
        style={{ height }}
      >
        No samples recorded
      </div>
    );
  }

  const domainMin = Math.min(min, ...markers.map((m) => m.value));
  const domainMax = Math.max(max, budget ?? 0, ...markers.map((m) => m.value)) * 1.02;
  const span = domainMax - domainMin || 1;
  const position = (value: number) => ((value - domainMin) / span) * 100;

  return (
    <figure className="m-0">
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {bins.map((bin, index) => (
            <div
              key={index}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              className="relative flex-1"
              style={{ height: "100%" }}
            >
              <div
                className="absolute bottom-0 left-1/2 w-full max-w-6 -translate-x-1/2 rounded-t-[4px] transition-colors"
                style={{
                  height: `${(bin.count / peak) * 100}%`,
                  background: hovered === index ? "var(--stage-2)" : "var(--stage-4)",
                  minHeight: bin.count > 0 ? 2 : 0,
                }}
              />
              {hovered === index && bin.count > 0 && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-md border border-hairline bg-surface-3 px-2 py-1 text-[11px] text-ink shadow-lg">
                  <span className="num">{Math.round(bin.from)}–{Math.round(bin.to)} ms</span>
                  <span className="text-ink-muted"> · </span>
                  <span className="num">{bin.count}</span>
                  <span className="text-ink-muted"> queries</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {markers.map((marker) => (
          <div
            key={marker.label}
            className="pointer-events-none absolute -top-1 bottom-0"
            style={{ left: `${position(marker.value)}%` }}
          >
            <div
              className="h-full w-px"
              style={{ background: marker.emphasis ? "var(--coral)" : "var(--line-strong)" }}
            />
            <span
              className="absolute -top-1 left-1.5 whitespace-nowrap text-[10px] uppercase tracking-[0.08em]"
              style={{ color: marker.emphasis ? "var(--coral)" : "var(--ink-muted)" }}
            >
              {marker.label}
            </span>
          </div>
        ))}

        {budget !== null && budget <= domainMax && (
          <div
            className="pointer-events-none absolute -top-1 bottom-0"
            style={{ left: `${position(budget)}%` }}
          >
            <div className="h-full w-px" style={{ background: "var(--status-good)", opacity: 0.75 }} />
            <span
              className="absolute -top-1 left-1.5 whitespace-nowrap text-[10px] uppercase tracking-[0.08em]"
              style={{ color: "var(--status-good)" }}
            >
              {budget} ms budget
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 flex justify-between border-t border-hairline pt-1.5 text-[10px] text-ink-muted">
        <span className="num">{Math.round(domainMin)} ms</span>
        <span>latency distribution · {samples.length} queries</span>
        <span className="num">{Math.round(domainMax)} ms</span>
      </div>
    </figure>
  );
}
