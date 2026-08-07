export type SpeechHistoryEntry = {
  id: string;
  text: string;
  audioContent?: string;
  mimeType?: string;
  voiceName?: string;
  speakingRate?: number;
  createdAt: string;
};

export const MAX_HISTORY_ENTRIES = 50;

const HISTORY_STORAGE_KEY = "voice-lab:speech-history:v1";

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isHistoryEntry(value: unknown): value is SpeechHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<SpeechHistoryEntry>;
  return typeof entry.id === "string" && typeof entry.text === "string" && typeof entry.createdAt === "string";
}

export function getSpeechHistory(): SpeechHistoryEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isHistoryEntry).slice(0, MAX_HISTORY_ENTRIES) : [];
  } catch {
    return [];
  }
}

export function addSpeechHistory(entry: Omit<SpeechHistoryEntry, "id" | "createdAt">) {
  const nextEntry: SpeechHistoryEntry = {
    ...entry,
    id: createId(),
    createdAt: new Date().toISOString(),
  };
  const next = [nextEntry, ...getSpeechHistory()].slice(0, MAX_HISTORY_ENTRIES);

  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    return { entries: next, audioStored: true };
  } catch {
    const textOnly = next.map((entry) => {
      const copy = { ...entry };
      delete copy.audioContent;
      return copy;
    });
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(textOnly));
    } catch {
      // Keep the in-memory result usable even when browser storage is unavailable.
    }
    return { entries: textOnly, audioStored: false };
  }
}

export function removeSpeechHistory(id: string) {
  const next = getSpeechHistory().filter((entry) => entry.id !== id);
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The UI still removes the item for the current session.
  }
  return next;
}
