export function HhgRibbon() {
  return (
    <div
      className="relative z-30 w-full"
      style={{ background: "var(--hhg-green)", borderBottom: "1px solid var(--hhg-green-deep)" }}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2 sm:px-8">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.18em] sm:text-xs"
          style={{ color: "var(--hhg-yellow)" }}
        >
          Hacker House Goa 2026
        </span>

        <span
          className="num rounded-full px-2.5 py-0.5 text-[10px] font-semibold sm:text-[11px]"
          style={{
            background: "var(--hhg-pink)",
            color: "#ffffff",
            boxShadow: "0 0 0 1px var(--hhg-yellow)",
          }}
        >
          #RAGInGoa
        </span>

        <span
          className="w-full text-[11px] tracking-[0.04em] sm:ml-auto sm:w-auto"
          style={{ color: "var(--hhg-yellow)" }}
        >
          Shortlisting Task 2 · submitted by{" "}
          <strong className="font-semibold">Team The Higher Celestials</strong>
        </span>
      </div>
    </div>
  );
}
