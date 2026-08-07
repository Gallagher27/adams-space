import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the simple Voice Lab reading prototype", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Voice Lab · 演讲训练工作台<\/title>/i);
  assert.match(html, /PRIVATE SPEECH PRACTICE/);
  assert.match(html, /先解锁/);
  assert.match(html, /服务器端访问保护/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/);
});

test("keeps the local TTS adapter and UI metadata in place", async () => {
  const [page, settings, secureStorage, historyStorage, vocabularyStorage, accessAuth, loginRoute, sessionRoute, vocabularyRoute, layout, route, envExample, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/settings/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/secure-storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/history-storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/vocabulary-storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/access-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/vocabulary/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/tts/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /window\.speechSynthesis/);
  assert.match(page, /Chirp3-HD/);
  assert.match(page, /activeWordIndex/);
  assert.match(page, /保存这一段/);
  assert.match(page, /HISTORY \/ \{MAX_HISTORY_ENTRIES\}/);
  assert.match(page, /载入并播放/);
  assert.match(page, /useState\(""\)/);
  assert.match(page, /replaceText/);
  assert.match(page, /resetForNewVisit/);
  assert.match(page, /audio-console/);
  assert.match(page, /音频进度/);
  assert.match(page, /mimeType/);
  assert.match(page, /downloadAudio/);
  assert.match(page, /下载音频/);
  assert.match(page, /parseSpeech/);
  assert.match(page, /解析成功/);
  assert.match(page, /buildWordTimings/);
  assert.match(page, /reading-chunk/);
  assert.match(page, /短语级朗读位置/);
  assert.match(page, /workflow-guide/);
  assert.match(page, /第一步：点击解析/);
  assert.match(page, /第二步：点击播放/);
  assert.match(page, /aria-pressed/);
  assert.match(page, /readingFontScale/);
  assert.match(page, /文字大小/);
  assert.match(page, /恢复默认文字大小/);
  assert.match(page, /parsedSpeechRate/);
  assert.match(page, /playbackRate/);
  assert.doesNotMatch(page, /语速已变化，请重新解析/);
  assert.match(page, /单独朗读/);
  assert.match(page, /selectedWordIndex/);
  assert.match(page, /seekAudioToWord/);
  assert.match(page, /从选中的词开始/);
  assert.match(route, /MAX_GOOGLE_INPUT_BYTES/);
  assert.match(route, /splitTextForGoogle/);
  assert.match(route, /LINEAR16/);
  assert.match(route, /combineWavAudio/);
  assert.match(route, /audio\/wav/);
  assert.match(settings, /加密保存并解锁/);
  assert.match(settings, /测试 Google TTS/);
  assert.match(settings, /本机用量/);
  assert.match(settings, /recordTtsUsage/);
  assert.match(settings, /AES-GCM/);
  assert.match(secureStorage, /PBKDF2/);
  assert.match(secureStorage, /localStorage/);
  assert.match(historyStorage, /MAX_HISTORY_ENTRIES = 50/);
  assert.match(historyStorage, /voice-lab:speech-history/);
  assert.match(historyStorage, /speakingRate/);
  assert.match(page, /vocab-marker/);
  assert.match(page, /点击 i 获取中文释义/);
  assert.match(page, /LOCAL_VOCABULARY/);
  assert.match(vocabularyStorage, /MAX_VOCABULARY_CACHE_ENTRIES = 300/);
  assert.match(vocabularyStorage, /voice-lab:vocabulary-cache/);
  assert.match(accessAuth, /HttpOnly/);
  assert.match(accessAuth, /HMAC/);
  assert.match(loginRoute, /VOICE_LAB_ACCESS_PASSWORD/);
  assert.match(sessionRoute, /hasValidSession/);
  assert.match(vocabularyRoute, /api\.mymemory\.translated\.net/);
  assert.match(vocabularyRoute, /dictionaryapi\.dev/);
  assert.match(vocabularyRoute, /Authentication required/);
  assert.match(layout, /Voice Lab/);
  assert.match(route, /GOOGLE_TTS_API_KEY/);
  assert.match(route, /texttospeech\.googleapis\.com/);
  assert.match(route, /Chirp3-HD-Achird/);
  assert.match(route, /speakingRate/);
  assert.match(envExample, /GOOGLE_TTS_API_KEY/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
