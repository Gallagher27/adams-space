import { NextResponse } from "next/server";
import { getRuntimeEnv, hasValidSession } from "../../lib/access-auth";

export const runtime = "nodejs";

type TtsRequest = {
  text?: string;
  apiKey?: string;
  voiceName?: string;
  speakingRate?: number;
  pitch?: number;
};

const MAX_TEXT_CHARACTERS = 20_000;
const MAX_GOOGLE_INPUT_BYTES = 4_800;
const MAX_REQUESTS_PER_MINUTE = 20;
const requestWindows = new Map<string, number[]>();
const textEncoder = new TextEncoder();

function clientId(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function isWithinRateLimit(request: Request) {
  const now = Date.now();
  const recent = (requestWindows.get(clientId(request)) ?? []).filter((timestamp) => now - timestamp < 60_000);
  if (recent.length >= MAX_REQUESTS_PER_MINUTE) return false;
  recent.push(now);
  requestWindows.set(clientId(request), recent);
  return true;
}

function textByteLength(value: string) {
  return textEncoder.encode(value).byteLength;
}

function splitOversizedText(value: string) {
  const pieces: string[] = [];
  let current = "";
  for (const character of Array.from(value)) {
    if (current && textByteLength(current + character) > MAX_GOOGLE_INPUT_BYTES) {
      pieces.push(current);
      current = "";
    }
    current += character;
  }
  if (current) pieces.push(current);
  return pieces;
}

function splitTextForGoogle(text: string) {
  const units: string[] = [];
  let unitStart = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (!/[.!?。！？]/.test(text[index]) && text[index] !== "\n") continue;
    let unitEnd = index + 1;
    while (unitEnd < text.length && /\s/.test(text[unitEnd])) unitEnd += 1;
    units.push(text.slice(unitStart, unitEnd));
    unitStart = unitEnd;
    index = unitEnd - 1;
  }
  if (unitStart < text.length) units.push(text.slice(unitStart));

  const chunks: string[] = [];
  let current = "";
  const appendPiece = (piece: string) => {
    if (!piece) return;
    for (const part of textByteLength(piece) > MAX_GOOGLE_INPUT_BYTES ? splitOversizedText(piece) : [piece]) {
      if (current && textByteLength(current + part) > MAX_GOOGLE_INPUT_BYTES) {
        chunks.push(current);
        current = "";
      }
      current += part;
    }
  };

  units.forEach((unit) => {
    if (textByteLength(unit) <= MAX_GOOGLE_INPUT_BYTES) {
      appendPiece(unit);
      return;
    }
    (unit.match(/\S+\s*/g) ?? [unit]).forEach(appendPiece);
  });
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text];
}

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return btoa(binary);
}

function findWavChunk(bytes: Uint8Array, id: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const chunkId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const size = view.getUint32(offset + 4, true);
    if (chunkId === id) return { offset, dataStart: offset + 8, size };
    offset += 8 + size + (size % 2);
  }
  return null;
}

function combineWavAudio(audioContents: string[]) {
  const wavFiles = audioContents.map(decodeBase64);
  const firstData = findWavChunk(wavFiles[0], "data");
  if (!firstData) throw new Error("Google returned an unsupported LINEAR16 audio format");
  const dataChunks = wavFiles.map((wavFile) => {
    const data = findWavChunk(wavFile, "data");
    if (!data) throw new Error("Google returned an incomplete LINEAR16 audio file");
    return data;
  });
  const totalDataBytes = dataChunks.reduce((total, chunk) => total + chunk.size, 0);
  const combined = new Uint8Array(firstData.dataStart + totalDataBytes);
  combined.set(wavFiles[0].slice(0, firstData.dataStart));
  const combinedView = new DataView(combined.buffer);
  combinedView.setUint32(4, combined.length - 8, true);
  combinedView.setUint32(firstData.offset + 4, totalDataBytes, true);
  let writeOffset = firstData.dataStart;
  dataChunks.forEach((chunk, index) => {
    const data = wavFiles[index].slice(chunk.dataStart, chunk.dataStart + chunk.size);
    combined.set(data, writeOffset);
    writeOffset += data.length;
  });
  return encodeBase64(combined);
}

function googleErrorMessage(errorText: string) {
  try {
    const payload = JSON.parse(errorText) as { error?: { message?: string } };
    return payload.error?.message ?? errorText;
  } catch {
    return errorText;
  }
}

async function synthesizeGoogleChunk({ apiKey, text, voiceName, audioEncoding, speakingRate, pitch }: { apiKey: string; text: string; voiceName: string; audioEncoding: "MP3" | "LINEAR16"; speakingRate: number; pitch: number }) {
  const googleResponse = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: "en-US",
          name: voiceName,
        },
        audioConfig: {
          audioEncoding,
          speakingRate,
          ...(!voiceName.includes("Chirp3-HD") && { pitch }),
        },
      }),
    },
  );
  const responseText = await googleResponse.text();
  if (!googleResponse.ok) return { status: googleResponse.status, details: googleErrorMessage(responseText) };
  const payload = JSON.parse(responseText) as { audioContent?: string };
  if (!payload.audioContent) return { status: 502, details: "Google TTS returned no audio" };
  return { audioContent: payload.audioContent };
}

export async function POST(request: Request) {
  if (!(await hasValidSession(request))) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isWithinRateLimit(request)) {
    return NextResponse.json({ error: "Too many TTS requests. Try again later." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as TtsRequest | null;
  const apiKey = getRuntimeEnv("GOOGLE_TTS_API_KEY").trim() || body?.apiKey?.trim();

  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_TTS_API_KEY is not configured" },
      { status: 503 },
    );
  }

  const text = body?.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_CHARACTERS) {
    return NextResponse.json({ error: `Text is limited to ${MAX_TEXT_CHARACTERS} characters` }, { status: 413 });
  }

  const voiceName = body?.voiceName ?? (getRuntimeEnv("GOOGLE_TTS_VOICE") || "en-US-Chirp3-HD-Achird");

  const chunks = splitTextForGoogle(text);
  const audioEncoding = chunks.length > 1 ? "LINEAR16" : "MP3";
  const speakingRate = Math.min(2, Math.max(0.25, body?.speakingRate ?? 0.93));
  const pitch = Math.min(4, Math.max(-4, body?.pitch ?? -1.2));
  const audioContents: string[] = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const result = await synthesizeGoogleChunk({ apiKey, text: chunks[index], voiceName, audioEncoding, speakingRate, pitch });
    if (!result.audioContent) {
      return NextResponse.json(
        { error: "Google TTS request failed", details: `第 ${index + 1}/${chunks.length} 段：${result.details}` },
        { status: result.status ?? 502 },
      );
    }
    audioContents.push(result.audioContent);
  }

  if (audioEncoding === "LINEAR16") {
    try {
      return NextResponse.json({ audioContent: combineWavAudio(audioContents), mimeType: "audio/wav", chunkCount: chunks.length });
    } catch (error) {
      return NextResponse.json({ error: "Google TTS audio merge failed", details: error instanceof Error ? error.message : "Unknown audio format" }, { status: 502 });
    }
  }
  return NextResponse.json({ audioContent: audioContents[0], mimeType: "audio/mpeg", chunkCount: 1 });
}
