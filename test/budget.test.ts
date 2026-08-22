import { describe, it, expect } from "vitest";
import { Budget, BudgetExhausted } from "../netlify/lib/budget.ts";

describe("budget.test — exhausted budget raises rather than starting a call it cannot finish", () => {
  it("take() returns the requested duration when plenty is left", () => {
    const b = new Budget(5000);
    expect(b.take(1000, 500)).toBe(1000);
  });

  it("take() clamps to what's available minus the reserve", () => {
    const b = new Budget(1000);
    const got = b.take(5000, 200);
    expect(got).toBeLessThanOrEqual(800);
    expect(got).toBeGreaterThan(0);
  });

  it("take() throws BudgetExhausted when even the reserve can't be covered", () => {
    const b = new Budget(100);
    expect(() => b.take(500, 5000)).toThrow(BudgetExhausted);
  });

  it("left() counts down and can go negative once the deadline passes", async () => {
    const b = new Budget(10);
    await new Promise((r) => setTimeout(r, 30));
    expect(b.left()).toBeLessThan(0);
  });

  it("signal() returns an AbortSignal that fires around the given delay", async () => {
    const b = new Budget(5000);
    const signal = b.signal(20);
    await new Promise((r) => setTimeout(r, 60));
    expect(signal.aborted).toBe(true);
  });
});
