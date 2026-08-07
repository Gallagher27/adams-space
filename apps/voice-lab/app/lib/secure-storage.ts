const STORAGE_KEY = "voice-lab:google-tts-key:v1";
const USAGE_STORAGE_KEY = "voice-lab:tts-usage:v1";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
let unlockedApiKey: string | null = null;

type EncryptedCredential = {
  version: 1;
  algorithm: "AES-GCM";
  salt: string;
  iv: string;
  ciphertext: string;
  updatedAt: string;
};

export type TtsUsage = {
  characters: number;
  requests: number;
  updatedAt: string | null;
};

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function deriveKey(passphrase: string, salt: Uint8Array) {
  const baseKey = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptApiKey(apiKey: string, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(apiKey));
  const credential: EncryptedCredential = {
    version: 1,
    algorithm: "AES-GCM",
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credential));
  return credential;
}

export async function unlockApiKey(passphrase: string) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error("没有找到加密配置");
  const credential = JSON.parse(raw) as EncryptedCredential;
  const key = await deriveKey(passphrase, fromBase64(credential.salt));
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(credential.iv) }, key, fromBase64(credential.ciphertext));
  unlockedApiKey = decoder.decode(plaintext);
  return unlockedApiKey;
}

export function setUnlockedApiKey(apiKey: string) { unlockedApiKey = apiKey; }
export function getUnlockedApiKey() { return unlockedApiKey; }
export function hasStoredCredential() { return Boolean(localStorage.getItem(STORAGE_KEY)); }
export function clearStoredCredential() { localStorage.removeItem(STORAGE_KEY); unlockedApiKey = null; }

export function getTtsUsage(): TtsUsage {
  const fallback: TtsUsage = { characters: 0, requests: 0, updatedAt: null };
  const raw = localStorage.getItem(USAGE_STORAGE_KEY);
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as Partial<TtsUsage>) };
  } catch {
    return fallback;
  }
}

export function recordTtsUsage(characters: number) {
  const current = getTtsUsage();
  const next: TtsUsage = {
    characters: current.characters + Math.max(0, characters),
    requests: current.requests + 1,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(next));
  return next;
}
