import { describe, it, expect, vi } from "vitest";
import { checkQuery } from "../netlify/lib/guardrails.ts";

describe("guardrails.test — pre-retrieval checkQuery refuses garbage with zero API calls", () => {
  it("empty string is refused", () => {
    expect(checkQuery("")).toEqual({ ok: false, reason: "empty" });
    expect(checkQuery("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it("2-char string is refused as too_short", () => {
    expect(checkQuery("hi")).toEqual({ ok: false, reason: "too_short" });
  });

  it("600-char string is refused as too_long", () => {
    expect(checkQuery("a".repeat(600))).toEqual({ ok: false, reason: "too_long" });
  });

  it("emoji-only string is refused as no_content", () => {
    expect(checkQuery("🎉🎉🎉")).toEqual({ ok: false, reason: "no_content" });
  });

  it("a normal question passes", () => {
    expect(checkQuery("how long does caffeine stay in your system")).toEqual({ ok: true });
  });

  it("a Devanagari question passes", () => {
    expect(checkQuery("कैफीन शरीर में कितनी देर रहता है")).toEqual({ ok: true });
  });

  it("never makes a network call", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    checkQuery("");
    checkQuery("hi");
    checkQuery("a".repeat(600));
    checkQuery("normal query text here");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
