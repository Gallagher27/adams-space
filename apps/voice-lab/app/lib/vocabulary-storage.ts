export const VOCABULARY_CACHE_KEY = "voice-lab:vocabulary-cache";
export const MAX_VOCABULARY_CACHE_ENTRIES = 300;

export type VocabularyNote = {
  word: string;
  translation: string;
  definition?: string;
  partOfSpeech?: string;
  example?: string;
  source: "local" | "free-translation" | "dictionary";
};

type VocabularyCache = Record<string, VocabularyNote>;

export function getVocabularyCache(): VocabularyCache {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(VOCABULARY_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as VocabularyCache;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveVocabularyNote(note: VocabularyNote) {
  if (typeof window === "undefined") return;

  try {
    const cache = getVocabularyCache();
    cache[note.word] = note;
    const entries = Object.entries(cache).slice(-MAX_VOCABULARY_CACHE_ENTRIES);
    window.localStorage.setItem(VOCABULARY_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Vocabulary hints are an enhancement; a full localStorage must not break reading.
  }
}
