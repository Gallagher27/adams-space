import { env as cloudflareEnv } from "cloudflare:workers";

const SESSION_COOKIE = "voice-lab-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const encoder = new TextEncoder();

type VoiceLabRuntimeEnv = {
  VOICE_LAB_ACCESS_PASSWORD?: string;
  GOOGLE_TTS_API_KEY?: string;
  GOOGLE_TTS_VOICE?: string;
};

const runtimeEnv = cloudflareEnv as unknown as VoiceLabRuntimeEnv;

export function getRuntimeEnv(name: keyof VoiceLabRuntimeEnv) {
  return runtimeEnv[name] ?? process.env[name] ?? "";
}

function configuredPassword() {
  return getRuntimeEnv("VOICE_LAB_ACCESS_PASSWORD");
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getSigningKey(password: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function isAccessConfigured() {
  return configuredPassword().length >= 12;
}

export async function verifyAccessPassword(password: string) {
  const expected = configuredPassword();
  if (!isAccessConfigured() || password.length === 0) return false;
  const key = await getSigningKey("voice-lab-password-compare");
  const expectedDigest = await crypto.subtle.sign("HMAC", key, encoder.encode(expected));
  const suppliedDigest = await crypto.subtle.sign("HMAC", key, encoder.encode(password));
  if (expectedDigest.byteLength !== suppliedDigest.byteLength) return false;
  const expectedBytes = new Uint8Array(expectedDigest);
  const suppliedBytes = new Uint8Array(suppliedDigest);
  let difference = 0;
  expectedBytes.forEach((byte, index) => { difference |= byte ^ suppliedBytes[index]; });
  return difference === 0;
}

async function createSessionToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = String(expiresAt);
  const key = await getSigningKey(configuredPassword());
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

function readCookie(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}

export async function hasValidSession(request: Request) {
  if (!isAccessConfigured()) return false;
  const token = readCookie(request);
  if (!token) return false;
  const [expiresAtText, signature] = token.split(".");
  const expiresAt = Number(expiresAtText);
  if (!expiresAt || expiresAt <= Math.floor(Date.now() / 1000) || !signature) return false;

  try {
    const key = await getSigningKey(configuredPassword());
    return await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), encoder.encode(expiresAtText));
  } catch {
    return false;
  }
}

export async function createSessionCookie(request: Request) {
  const token = await createSessionToken();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

export function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
