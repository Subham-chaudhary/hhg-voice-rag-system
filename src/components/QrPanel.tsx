"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const noopSubscribe = () => () => {};

function readTarget(): string | null {
  if (typeof window === "undefined") return null;
  const configured = process.env.NEXT_PUBLIC_PUBLIC_URL?.replace(/\/$/, "");
  return configured
    ? `${configured}${window.location.pathname}`
    : `${window.location.origin}${window.location.pathname}`;
}

function isLocal(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function QrPanel() {
  const target = useSyncExternalStore(noopSubscribe, readTarget, () => null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const local = target ? isLocal(target) : false;

  useEffect(() => {
    if (!target) return;
    QRCode.toDataURL(target, {
      margin: 1,
      width: 320,
      errorCorrectionLevel: "M",
      color: { dark: "#0f0e0d", light: "#f7f2ea" },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [target]);

  const copy = async () => {
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 px-5 py-4 sm:px-6">
      <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">Open on your phone</p>
      <p className="mt-1 text-xs text-ink-secondary">
        Scan to run the same console on a handset — mic capture works there too.
      </p>

      <div className="mt-4 flex items-center gap-4">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={`QR code linking to ${target}`}
            width={112}
            height={112}
            className="h-28 w-28 shrink-0 rounded-lg"
          />
        ) : (
          <div className="h-28 w-28 shrink-0 animate-pulse rounded-lg bg-surface-2" />
        )}

        <div className="min-w-0 flex-1">
          <p className="num break-all text-[11px] leading-relaxed text-ink-secondary">{target ?? "…"}</p>
          <button
            type="button"
            onClick={copy}
            className="mt-2 rounded-md bg-surface-2 px-2.5 py-1 text-[11px] text-ink-secondary transition-colors hover:text-ink"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>

      {local && (
        <p
          className="mt-3 rounded-lg px-3 py-2 text-[11px] leading-relaxed"
          style={{ background: "var(--coral-wash)", color: "var(--ink-secondary)" }}
        >
          This points at localhost, which a phone cannot reach. Set{" "}
          <code className="num">NEXT_PUBLIC_PUBLIC_URL</code> to the deployed address, or run{" "}
          <code className="num">next dev -H 0.0.0.0</code> and use your machine&apos;s LAN IP.
        </p>
      )}
    </section>
  );
}
