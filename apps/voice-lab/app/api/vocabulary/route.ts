import { NextResponse } from "next/server";
import { hasValidSession } from "../../lib/access-auth";
import type { VocabularyNote } from "../../lib/vocabulary-storage";

export const runtime = "nodejs";

const MAX_CACHE_ENTRIES = 300;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const vocabularyCache = new Map<string, { expiresAt: number; note: VocabularyNote | null }>();

type MyMemoryResponse = {
  responseData?: { translatedText?: string };
  responseStatus?: number;
};

type DictionaryResponse = Array<{
  phonetic?: string;
  meanings?: Array<{
    partOfSpeech?: string;
    definitions?: Array<{ definition?: string; example?: string }>;
  }>;
}>;

function normalizeWord(value: string) {
  return value.trim().toLowerCase();
}

function isUsableTranslation(value: string | undefined, word: string) {
  if (!value) return false;
  const translation = value.trim();
  if (!translation || translation.length > 120) return false;
  if (/my memory|warning|翻译记忆/i.test(translation)) return false;
  return translation.toLowerCase() !== word.toLowerCase();
}

function getCachedNote(word: string) {
  const cached = vocabularyCache.get(word);
  if (!cached) return undefined;
  if (cached.expiresAt < Date.now()) {
    vocabularyCache.delete(word);
    return undefined;
  }
  return cached.note;
}

function setCachedNote(word: string, note: VocabularyNote | null) {
  vocabularyCache.set(word, { expiresAt: Date.now() + CACHE_TTL_MS, note });
  while (vocabularyCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = vocabularyCache.keys().next().value;
    if (oldestKey) vocabularyCache.delete(oldestKey);
    else break;
  }
}

async function getFreeTranslation(word: string) {
  const response = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh-CN`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) return "";
  const payload = (await response.json()) as MyMemoryResponse;
  const translation = payload.responseData?.translatedText?.trim() ?? "";
  return isUsableTranslation(translation, word) ? translation : "";
}

async function getDictionaryFallback(word: string) {
  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as DictionaryResponse;
  const firstMeaning = payload[0]?.meanings?.find((meaning) => meaning.definitions?.[0]?.definition);
  const firstDefinition = firstMeaning?.definitions?.[0];
  if (!firstDefinition?.definition) return null;
  return {
    definition: firstDefinition.definition,
    example: firstDefinition.example,
    partOfSpeech: firstMeaning.partOfSpeech,
  };
}

export async function GET(request: Request) {
  if (!(await hasValidSession(request))) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const word = normalizeWord(new URL(request.url).searchParams.get("word") ?? "");
  if (!/^[a-z][a-z'-]{1,47}$/u.test(word)) {
    return NextResponse.json({ error: "A single English word is required" }, { status: 400 });
  }

  const cached = getCachedNote(word);
  if (cached) return NextResponse.json({ note: cached, cached: true });

  try {
    const translation = await getFreeTranslation(word);
    let fallback: Awaited<ReturnType<typeof getDictionaryFallback>> = null;
    if (!translation) fallback = await getDictionaryFallback(word);

    const note: VocabularyNote | null = translation || fallback
      ? {
          word,
          translation: translation || "暂时没有中文翻译",
          definition: fallback?.definition,
          example: fallback?.example,
          partOfSpeech: fallback?.partOfSpeech,
          source: translation ? "free-translation" : "dictionary",
        }
      : null;

    setCachedNote(word, note);
    if (!note) return NextResponse.json({ error: "No vocabulary note found" }, { status: 404 });
    return NextResponse.json({ note, cached: false });
  } catch {
    return NextResponse.json({ error: "Vocabulary service unavailable" }, { status: 502 });
  }
}
