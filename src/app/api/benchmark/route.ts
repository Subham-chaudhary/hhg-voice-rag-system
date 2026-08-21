import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { StageKey } from "@/lib/contract";
import { summarise } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESULTS_DIR = path.join(process.cwd(), "benchmarks", "results");

interface RawRecord {
  query_id?: string;
  language?: string;
  status?: string;
  rag_core?: number;
  voice_e2e?: number;
  stages?: Partial<Record<StageKey, number>>;
}

interface RawFile {
  label?: string;
  commit?: string;
  measured_at?: string;
  warmups?: number;
  repeats?: number;
  timeouts?: number;
  errors?: number;
  placeholder?: boolean;
  records?: RawRecord[];
}

function medianOf(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function readLatest(): Promise<RawFile | null> {
  let entries: string[];
  try {
    entries = (await fs.readdir(RESULTS_DIR)).filter((name) => name.endsWith(".json"));
  } catch {
    return null;
  }
  if (!entries.length) return null;

  const preferred = entries.find((name) => name.includes("final")) ?? entries.sort().at(-1)!;
  try {
    const raw = await fs.readFile(path.join(RESULTS_DIR, preferred), "utf8");
    return JSON.parse(raw) as RawFile;
  } catch {
    return null;
  }
}

export async function GET() {
  const file = await readLatest();

  if (!file?.records?.length) {
    return NextResponse.json({
      isPlaceholder: true,
      label: "no run recorded",
      commit: null,
      measuredAt: null,
      queryCount: 0,
      warmups: 0,
      repeats: 0,
      timeouts: 0,
      errors: 0,
      ragCore: { p50: 0, p70: 0, p100: 0, mean: 0, stddev: 0 },
      voiceE2E: null,
      stageMedians: {},
      samples: [],
      voiceSamples: [],
      byLanguage: [],
    });
  }

  const records = file.records;
  const core = records.map((r) => r.rag_core ?? 0).filter((v) => v > 0);
  const voice = records.map((r) => r.voice_e2e ?? 0).filter((v) => v > 0);

  const stageKeys: StageKey[] = ["stt", "validate", "embed", "retrieve", "rank", "generate", "ground"];
  const stageMedians: Partial<Record<StageKey, number>> = {};
  for (const key of stageKeys) {
    const values = records.map((r) => r.stages?.[key]).filter((v): v is number => typeof v === "number");
    if (values.length) stageMedians[key] = Math.round(medianOf(values) * 10) / 10;
  }

  const languages = new Map<string, number[]>();
  for (const record of records) {
    const lang = record.language ?? "unknown";
    if (!languages.has(lang)) languages.set(lang, []);
    if (record.rag_core) languages.get(lang)!.push(record.rag_core);
  }

  const byLanguage = [...languages.entries()]
    .map(([language, values]) => {
      const stats = summarise(values);
      return {
        language,
        count: values.length,
        p50: Math.round(stats.p50 * 10) / 10,
        p100: Math.round(stats.p100 * 10) / 10,
      };
    })
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    isPlaceholder: file.placeholder === true,
    label: file.label ?? "benchmark run",
    commit: file.commit ?? null,
    measuredAt: file.measured_at ?? null,
    queryCount: records.length,
    warmups: file.warmups ?? 0,
    repeats: file.repeats ?? 1,
    timeouts: file.timeouts ?? 0,
    errors: file.errors ?? records.filter((r) => r.status === "error").length,
    ragCore: summarise(core),
    voiceE2E: voice.length ? summarise(voice) : null,
    stageMedians,
    samples: core,
    voiceSamples: voice,
    byLanguage,
  });
}
