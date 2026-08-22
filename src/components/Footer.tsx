export function Footer() {
  return (
    <footer className="relative z-10 mt-16 border-t border-hairline">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div>
          <p className="display text-lg text-ink">Zenith</p>
          <p className="mt-1 text-xs text-ink-secondary">
            Voice RAG console over MSMARCO-XI
          </p>
        </div>

        <div className="sm:text-right">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">Submitted by</p>
          <p className="mt-1 text-sm font-medium text-ink">Team The Higher Celestials</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-ink-muted sm:justify-end">
            <span>Hacker House Goa 2026 · Shortlisting Task 2</span>
            <span
              className="num rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "var(--hhg-pink)", color: "#ffffff" }}
            >
              #RAGInGoa
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
