/**
 * Deadline propagation. Fixed per-stage timeouts let a slow embed and a slow
 * rerank each pass their own check while the request as a whole arrives far
 * too late. A propagating deadline makes each stage aware of time already
 * spent, so the system degrades deliberately instead of arriving late.
 *
 * Netlify Functions synchronous execution ceiling is 10s on Free/Personal
 * plans (26s on Pro) — verified against current docs. search.mts budgets
 * under the conservative 10s figure with headroom for cold-start + response
 * serialization.
 */

export const NETLIFY_SYNC_TIMEOUT_MS = 10_000;
export const DEFAULT_BUDGET_MS = 9_000;

export class BudgetExhausted extends Error {
  constructor(message = "budget exhausted") {
    super(message);
    this.name = "BudgetExhausted";
  }
}

export class Budget {
  private deadline: number;

  constructor(totalMs: number) {
    this.deadline = Date.now() + totalMs;
  }

  /** Milliseconds remaining before the deadline. Can go negative. */
  left(): number {
    return this.deadline - Date.now();
  }

  /**
   * Reserve `wantMs` for the next stage, keeping `reserveMs` in hand for
   * everything after it. Throws BudgetExhausted if there isn't even enough
   * left to cover the reserve — i.e. don't start a call you can't finish.
   */
  take(wantMs: number, reserveMs: number): number {
    const avail = this.left();
    if (avail < reserveMs) throw new BudgetExhausted();
    return Math.min(wantMs, avail - reserveMs);
  }

  /** An AbortSignal that fires after `ms` — pass straight to fetch(). */
  signal(ms: number): AbortSignal {
    return AbortSignal.timeout(Math.max(1, ms));
  }
}
