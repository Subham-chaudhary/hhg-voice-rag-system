export const TARGET_SAMPLE_RATE = 16000;

export interface RecordingResult {
  wav: Blob;
  durationMs: number;
  peak: number;
}

type LevelListener = (level: number) => void;

function getAudioContextClass(): typeof AudioContext {
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!ctor) throw new Error("Web Audio API is not available in this browser.");
  return ctor;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function isRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private frame = 0;
  private startedAt = 0;
  private peak = 0;

  constructor(private onLevel: LevelListener) {}

  async start(): Promise<void> {
    if (!isRecordingSupported()) {
      throw new Error("This browser cannot capture audio. Use the text input instead.");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const Ctx = getAudioContextClass();
    this.context = new Ctx();
    if (this.context.state === "suspended") await this.context.resume();

    const source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.75;
    source.connect(this.analyser);

    this.chunks = [];
    this.peak = 0;
    const mimeType = pickMimeType();
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.recorder.start(100);
    this.startedAt = performance.now();
    this.pollLevel();
  }

  private pollLevel = () => {
    if (!this.analyser) return;
    const buffer = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(buffer);

    let sum = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      const centred = (buffer[i] - 128) / 128;
      sum += centred * centred;
    }
    const rms = Math.sqrt(sum / buffer.length);
    const level = Math.min(1, rms * 3.2);
    this.peak = Math.max(this.peak, level);
    this.onLevel(level);
    this.frame = requestAnimationFrame(this.pollLevel);
  };

  async stop(): Promise<RecordingResult> {
    const recorder = this.recorder;
    if (!recorder) throw new Error("Recorder was never started.");

    const durationMs = performance.now() - this.startedAt;
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" }));
      recorder.stop();
    });

    this.teardown();
    const wav = await toWav16kMono(blob);
    return { wav, durationMs, peak: this.peak };
  }

  cancel(): void {
    try {
      this.recorder?.stop();
    } catch {
      // recorder was already inactive
    }
    this.teardown();
  }

  private teardown(): void {
    cancelAnimationFrame(this.frame);
    this.onLevel(0);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.analyser = null;
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.recorder = null;
  }
}

async function decode(blob: Blob): Promise<AudioBuffer> {
  const Ctx = getAudioContextClass();
  const context = new Ctx();
  const bytes = await blob.arrayBuffer();
  try {
    return await context.decodeAudioData(bytes.slice(0));
  } finally {
    void context.close().catch(() => undefined);
  }
}

export async function toWav16kMono(blob: Blob): Promise<Blob> {
  const decoded = await decode(blob);
  const frames = Math.max(1, Math.ceil((decoded.duration * TARGET_SAMPLE_RATE)));
  const offline = new OfflineAudioContext(1, frames, TARGET_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  return encodeWav(rendered.getChannelData(0), TARGET_SAMPLE_RATE);
}

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}
