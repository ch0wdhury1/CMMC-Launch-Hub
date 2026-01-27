
/**
 * AUDIO UTILITIES FOR GEMINI TTS + RAW PCM
 * ----------------------------------------
 * This file safely decodes audio returned by Gemini models.
 * Gemini may return: raw 16-bit PCM, WAV container, or unknown binary chunks.
 * This util normalizes everything into a playable AudioBuffer.
 */

/* -------------------------------------------------------------
 * Base64 → Uint8Array
 * ------------------------------------------------------------- */
export function decode(base64: string): Uint8Array {
  try {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch (err) {
    console.error("Invalid base64 audio:", err);
    return new Uint8Array();
  }
}

/* -------------------------------------------------------------
 * WAV HEADER DETECTION
 * ------------------------------------------------------------- */
function isWav(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46     // F
  );
}

/* -------------------------------------------------------------
 * WAV DECODER → AudioBuffer
 * ------------------------------------------------------------- */
async function decodeWav(bytes: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
  // Browsers can decode WAV automatically using decodeAudioData
  const arrayBuf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return await ctx.decodeAudioData(arrayBuf);
}

/* -------------------------------------------------------------
 * RAW PCM → AudioBuffer
 * Assumes 16-bit PCM, little-endian, signed.
 * ------------------------------------------------------------- */
async function decodePcm(
  bytes: Uint8Array,
  ctx: AudioContext,
  sampleRate = 24000,
  numChannels = 1
): Promise<AudioBuffer> {
  const pcm = new Int16Array(bytes.buffer);

  const frameCount = Math.floor(pcm.length / numChannels);
  const audioBuffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < frameCount; i++) {
      const sample = pcm[i * numChannels + ch];
      channelData[i] = sample / 32768.0; // convert int16 → float
    }
  }

  return audioBuffer;
}

/* -------------------------------------------------------------
 * AUTO-DETECT AND DECODE AUDIO FROM GEMINI
 * ------------------------------------------------------------- */
export async function decodeAudioData(
  bytes: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  if (!bytes || bytes.length < 4) {
    throw new Error("Audio bytes are empty or corrupted.");
  }

  // 1. WAV?
  if (isWav(bytes)) {
    try {
      return await decodeWav(bytes, ctx);
    } catch (err) {
      console.warn("Failed WAV decode, falling back to PCM:", err);
    }
  }

  // 2. Assume PCM if not WAV
  try {
    return await decodePcm(bytes, ctx, sampleRate, numChannels);
  } catch (err) {
    console.error("PCM decode failed:", err);
    throw new Error("Could not decode Gemini TTS audio.");
  }
}

/* -------------------------------------------------------------
 * OPTIONAL: Generate a WAV Blob URL for downloads/playback
 * ------------------------------------------------------------- */
export function pcmToWav(pcmBytes: Uint8Array, sampleRate = 24000, numChannels = 1): Blob {
  const pcmData = new Int16Array(pcmBytes.buffer);
  const blockAlign = numChannels * 2;
  const byteRate = sampleRate * blockAlign;

  const buffer = new ArrayBuffer(44 + pcmBytes.length);
  const view = new DataView(buffer);

  // Write WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcmBytes.length, true);
  writeString(8, "WAVE");

  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);

  writeString(36, "data");
  view.setUint32(40, pcmBytes.length, true);

  // Copy PCM samples
  new Uint8Array(buffer, 44).set(pcmBytes);

  return new Blob([buffer], { type: "audio/wav" });
}