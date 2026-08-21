export function ms(value: number | undefined, digits = 1): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${value.toFixed(digits)} ms`;
}

export function msCompact(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}`;
}

export function percent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  if (p >= 1) return sorted[sorted.length - 1];
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export function summarise(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / (sorted.length || 1);
  const variance =
    sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (sorted.length || 1);
  return {
    p50: percentile(sorted, 0.5),
    p70: percentile(sorted, 0.7),
    p100: percentile(sorted, 1),
    mean,
    stddev: Math.sqrt(variance),
  };
}

export function histogram(samples: number[], binCount = 24) {
  if (!samples.length) return { bins: [], min: 0, max: 0, binWidth: 0 };
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const span = max - min || 1;
  const binWidth = span / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    from: min + index * binWidth,
    to: min + (index + 1) * binWidth,
    count: 0,
  }));
  for (const sample of samples) {
    const index = Math.min(binCount - 1, Math.floor((sample - min) / binWidth));
    bins[index].count += 1;
  }
  return { bins, min, max, binWidth };
}

export function clampText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).trimEnd()}…`;
}

export function relativeTime(timestamp: number): string {
  const delta = Math.max(0, Date.now() - timestamp);
  if (delta < 5000) return "just now";
  if (delta < 60000) return `${Math.round(delta / 1000)}s ago`;
  return `${Math.round(delta / 60000)}m ago`;
}
