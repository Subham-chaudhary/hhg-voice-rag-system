"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { VoiceRecorder, isRecordingSupported } from "@/lib/audio";

const noopSubscribe = () => () => {};

const BAR_COUNT = 44;

interface ComposerProps {
  busy: boolean;
  onText: (transcript: string) => void;
  onAudio: (wav: Blob, durationMs: number) => void;
}

export function Composer({ busy, onText, onAudio }: ComposerProps) {
  const [recording, setRecording] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => new Array(BAR_COUNT).fill(0));
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const supported = useSyncExternalStore(noopSubscribe, isRecordingSupported, () => true);

  const recorderRef = useRef<VoiceRecorder | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pushLevel = useCallback((level: number) => {
    setLevels((current) => [...current.slice(1), level]);
  }, []);

  const start = useCallback(async () => {
    if (busy || recording) return;
    setError(null);
    const recorder = new VoiceRecorder(pushLevel);
    recorderRef.current = recorder;
    try {
      await recorder.start();
      setRecording(true);
    } catch (cause) {
      recorderRef.current = null;
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Microphone permission denied. Use the text input below."
          : cause instanceof Error
            ? cause.message
            : "Could not start the microphone.",
      );
    }
  }, [busy, recording, pushLevel]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || !recording) return;
    setRecording(false);
    recorderRef.current = null;
    try {
      const { wav, durationMs } = await recorder.stop();
      setLevels(new Array(BAR_COUNT).fill(0));
      if (durationMs < 350) {
        setError("That was too short to transcribe. Hold the button while you speak.");
        return;
      }
      onAudio(wav, durationMs);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not encode the recording.");
    }
  }, [recording, onAudio]);

  useEffect(() => {
    const isTyping = () => document.activeElement === inputRef.current;

    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || isTyping()) return;
      event.preventDefault();
      void start();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isTyping()) return;
      event.preventDefault();
      void stop();
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [start, stop]);

  useEffect(() => () => recorderRef.current?.cancel(), []);

  const submitText = (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    onText(value);
    setText("");
  };

  return (
    <div className="rounded-xl border border-hairline bg-surface-1 p-5 sm:p-6">
      <div className="flex items-center gap-4 sm:gap-6">
        <button
          type="button"
          disabled={busy || !supported}
          onPointerDown={(event) => {
            event.preventDefault();
            void start();
          }}
          onPointerUp={() => void stop()}
          onPointerLeave={() => recording && void stop()}
          aria-label={recording ? "Release to send" : "Hold to speak"}
          className="group relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full transition-transform duration-150 disabled:cursor-not-allowed disabled:opacity-40 sm:h-[72px] sm:w-[72px]"
          style={{
            background: recording ? "var(--amber)" : "var(--surface-2)",
            border: `1px solid ${recording ? "var(--amber)" : "var(--line-strong)"}`,
            transform: recording ? "scale(1.04)" : "none",
          }}
        >
          {recording && (
            <span
              aria-hidden
              className="breathe absolute inset-0 rounded-full"
              style={{ boxShadow: "0 0 0 8px rgba(245,158,11,0.14)" }}
            />
          )}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect
              x="9"
              y="3"
              width="6"
              height="11"
              rx="3"
              stroke={recording ? "#1a1400" : "var(--ink-secondary)"}
              strokeWidth="1.7"
            />
            <path
              d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"
              stroke={recording ? "#1a1400" : "var(--ink-secondary)"}
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex h-12 items-center gap-[3px]" aria-hidden>
            {levels.map((level, index) => (
              <span
                key={index}
                className="flex-1 rounded-[2px] transition-[height] duration-75"
                style={{
                  height: `${Math.max(3, level * 46)}px`,
                  background: recording
                    ? `color-mix(in oklab, var(--amber) ${35 + level * 65}%, var(--surface-3))`
                    : "var(--surface-2)",
                }}
              />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">
            {recording ? (
              <span style={{ color: "var(--amber-bright)" }}>Listening — release to send</span>
            ) : supported ? (
              <>
                <span className="sm:hidden">Hold to speak</span>
                <span className="hidden sm:inline">
                  Hold the button or press{" "}
                  <kbd className="num rounded bg-surface-2 px-1.5 py-0.5 text-[10px]">Space</kbd> to speak
                </span>
              </>
            ) : (
              "Microphone capture is unavailable in this browser — use the text input."
            )}
          </p>
        </div>
      </div>

      <form onSubmit={submitText} className="mt-5 flex gap-2 border-t border-hairline pt-5">
        <input
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={busy}
          placeholder="…or type a question in any indexed language"
          className="min-w-0 flex-1 rounded-lg bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:ring-1 focus:ring-[var(--amber)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-35"
          style={{ background: "var(--amber)", color: "#1a1400" }}
        >
          Ask
        </button>
      </form>

      {error && (
        <p className="mt-3 text-xs" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
