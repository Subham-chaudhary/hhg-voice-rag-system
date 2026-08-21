/**
 * Sarvam speech-to-text client.
 *
 * Verified against current docs.sarvam.ai (2026-08-22) — the spec's assumed
 * endpoint/header were correct but the model name had moved on:
 *   - endpoint: POST https://api.sarvam.ai/speech-to-text
 *   - auth header: api-subscription-key (NOT Authorization: Bearer)
 *   - multipart/form-data: file (required), model, language_code, mode,
 *     with_timestamps, input_audio_codec
 *   - current model default is saaras:v3 (saarika:v2.5 is the legacy
 *     STT-only family). saaras supports mode=transcribe|translate|verbatim|
 *     translit|codemix — this client pins mode="transcribe" explicitly so a
 *     Hindi/Kannada/etc. utterance comes back in its own script, not
 *     translated to English. Translating here would break the `lang` filter
 *     the rest of the pipeline relies on.
 *   - language_code: "unknown" triggers auto-detect (confirmed supported).
 *   - response: { request_id, transcript, language_code,
 *     language_probability, timestamps? }
 */

const STT_URL = "https://api.sarvam.ai/speech-to-text";
const DEFAULT_MODEL = "saaras:v3";

export class SarvamError extends Error {
  constructor(public status: number, public body: string) {
    super(`Sarvam API error ${status}: ${body.slice(0, 300)}`);
    this.name = "SarvamError";
  }
}

export type SttResult = {
  transcript: string;
  language_code: string;
  language_probability?: number;
};

export async function transcribe(
  audio: Blob,
  languageCode: string | undefined,
  signal: AbortSignal,
): Promise<SttResult> {
  const form = new FormData();
  form.append("file", audio, "audio");
  form.append("model", DEFAULT_MODEL);
  form.append("mode", "transcribe");
  if (languageCode) form.append("language_code", languageCode);

  const r = await fetch(STT_URL, {
    method: "POST",
    headers: { "api-subscription-key": process.env.SARVAM_API_KEY ?? "" },
    body: form,
    signal,
  });
  if (!r.ok) throw new SarvamError(r.status, await r.text());
  const json = (await r.json()) as {
    transcript: string;
    language_code: string;
    language_probability?: number;
  };
  return {
    transcript: json.transcript,
    language_code: json.language_code,
    language_probability: json.language_probability,
  };
}

// Reject before spending an API call: a 200-byte "recording" is a UI bug,
// not speech; anything past ~10MB is not a short voice query.
export const MIN_AUDIO_BYTES = 1_000;
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export function checkAudioSize(bytes: number): { ok: true } | { ok: false; reason: string } {
  if (bytes < MIN_AUDIO_BYTES) return { ok: false, reason: "audio_too_short" };
  if (bytes > MAX_AUDIO_BYTES) return { ok: false, reason: "audio_too_large" };
  return { ok: true };
}
