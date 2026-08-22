import { describe, it, expect } from "vitest";
import { evaluateGate, evaluateRerankGate, type Thresholds } from "../netlify/lib/guardrails.ts";

const T: Thresholds = { TAU_HIGH: 0.92, TAU_GOOD: 0.78, TAU_FLOOR: 0.45, TAU_RERANK_PASS: 0.35 };

function point(id: string, score: number) {
  return { id, score, payload: { text: `doc ${id}` } };
}

describe("ladder.test — each of the four confidence bands routes to the correct action", () => {
  it(">= TAU_HIGH with a clear margin -> early_exit", () => {
    const gate = evaluateGate(point("t1", 0.95), [point("t2a", 0.5), point("t2b", 0.4)], T);
    expect(gate.action).toBe("early_exit");
  });

  it(">= TAU_GOOD, < TAU_HIGH, clear margin -> proceed", () => {
    const gate = evaluateGate(null, [point("a", 0.8), point("b", 0.5)], T);
    expect(gate.action).toBe("proceed");
  });

  it(">= TAU_FLOOR, < TAU_GOOD -> rerank", () => {
    const gate = evaluateGate(null, [point("a", 0.6), point("b", 0.5)], T);
    expect(gate.action).toBe("rerank");
  });

  it("< TAU_FLOOR -> abstain", () => {
    const gate = evaluateGate(null, [point("a", 0.3), point("b", 0.1)], T);
    expect(gate.action).toBe("abstain");
  });

  it("no candidates at all -> abstain", () => {
    const gate = evaluateGate(null, [], T);
    expect(gate.action).toBe("abstain");
    expect(gate.confidence).toBe(0);
  });

  it("high top1 but a thin margin (<0.03) routes to rerank regardless of band", () => {
    const gate = evaluateGate(point("t1", 0.95), [point("t2a", 0.94)], T);
    expect(gate.action).toBe("rerank");
  });

  it("abstain-band top1 is never overridden into rerank by margin", () => {
    const gate = evaluateGate(null, [point("a", 0.2), point("a2", 0.19)], T);
    expect(gate.action).toBe("abstain");
  });

  it("evaluateRerankGate uses TAU_RERANK_PASS, not TAU_GOOD/TAU_HIGH", () => {
    // 0.5 would clear TAU_GOOD on the cosine scale, but rerank scores are a
    // different scale — only TAU_RERANK_PASS (0.35) applies here.
    expect(evaluateRerankGate(0.4, T).ok).toBe(true);
    expect(evaluateRerankGate(0.2, T).ok).toBe(false);
  });
});
