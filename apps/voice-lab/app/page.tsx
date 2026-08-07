"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import AccessGate from "./components/access-gate";
import { addSpeechHistory, getSpeechHistory, MAX_HISTORY_ENTRIES, removeSpeechHistory, type SpeechHistoryEntry } from "./lib/history-storage";
import { getUnlockedApiKey, recordTtsUsage } from "./lib/secure-storage";
import { getVocabularyCache, saveVocabularyNote, type VocabularyNote } from "./lib/vocabulary-storage";

type WordToken = { word: string; start: number; end: number };
type WordTiming = { start: number; end: number };
type ReadingChunk = { startIndex: number; endIndex: number };

const LOCAL_VOCABULARY: Record<string, VocabularyNote> = {
  compounds: { word: "compounds", translation: "逐渐积累；复合", definition: "Small gains build on each other and become larger over time.", source: "local" },
  compound: { word: "compound", translation: "逐渐积累；复合", definition: "To make something stronger or larger by adding parts together.", source: "local" },
  dramatic: { word: "dramatic", translation: "戏剧性的；变化很大的", definition: "Very noticeable, surprising, or exciting.", source: "local" },
  thoughtful: { word: "thoughtful", translation: "经过认真思考的；体贴的", definition: "Showing careful thought or consideration.", source: "local" },
  rehearsal: { word: "rehearsal", translation: "排练；演练", definition: "Practice for a speech, performance, or event.", source: "local" },
  meaningful: { word: "meaningful", translation: "有意义的", definition: "Having an important meaning or purpose.", source: "local" },
  consistent: { word: "consistent", translation: "持续稳定的；一致的", definition: "Doing something in the same reliable way over time.", source: "local" },
  confidence: { word: "confidence", translation: "信心；自信", definition: "The feeling that you can do something successfully.", source: "local" },
  articulation: { word: "articulation", translation: "清晰发音；表达", definition: "The clear pronunciation or expression of words and ideas.", source: "local" },
  opportunity: { word: "opportunity", translation: "机会", definition: "A suitable moment or chance to do something.", source: "local" },
  perspective: { word: "perspective", translation: "观点；看法", definition: "A particular way of thinking about or understanding something.", source: "local" },
  contribution: { word: "contribution", translation: "贡献", definition: "Something that you give or do to help achieve a result.", source: "local" },
  sustainable: { word: "sustainable", translation: "可持续的", definition: "Able to continue for a long time without causing serious harm.", source: "local" },
  responsibility: { word: "responsibility", translation: "责任", definition: "A duty or job that you are expected to take care of.", source: "local" },
  consequence: { word: "consequence", translation: "后果；结果", definition: "A result that happens because of an action or decision.", source: "local" },
  particularly: { word: "particularly", translation: "尤其；特别", definition: "More than usual, or more than other things.", source: "local" },
  communicate: { word: "communicate", translation: "沟通；表达", definition: "To share information, thoughts, or feelings with someone.", source: "local" },
  audience: { word: "audience", translation: "观众；听众", definition: "The people who watch or listen to a speech, performance, or presentation.", source: "local" },
  vulnerable: { word: "vulnerable", translation: "脆弱的；容易受影响的", definition: "Easy to hurt, influence, or damage.", source: "local" },
  authentic: { word: "authentic", translation: "真实的；真诚的", definition: "Real, genuine, and not copied or pretended.", source: "local" },
  influence: { word: "influence", translation: "影响", definition: "The power to change someone or something.", source: "local" },
  resilience: { word: "resilience", translation: "韧性；恢复力", definition: "The ability to recover after difficulty or failure.", source: "local" },
  collaborate: { word: "collaborate", translation: "合作", definition: "To work together with another person or group.", source: "local" },
  innovation: { word: "innovation", translation: "创新", definition: "A new idea, method, or product that improves something.", source: "local" },
  commitment: { word: "commitment", translation: "承诺；投入", definition: "A strong promise or decision to keep doing something.", source: "local" },
  deliberate: { word: "deliberate", translation: "有意的；经过深思的", definition: "Done intentionally and with careful thought.", source: "local" },
  significant: { word: "significant", translation: "重要的；明显的", definition: "Important or large enough to be noticed.", source: "local" },
};

const SAMPLE_TEXT =
  "Good morning, everyone. Today, I want to talk about the kind of progress that compounds quietly. It is not always dramatic, and it rarely arrives all at once. But every thoughtful question, every small rehearsal, and every moment we choose to keep going is building something.";

function getWordTokens(text: string): WordToken[] {
  return Array.from(text.matchAll(/[A-Za-z][A-Za-z'-]*/g)).map((match) => ({
    word: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

function estimateSyllables(word: string) {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!normalized) return 1;
  const groups = normalized.match(/[aeiouy]+/g)?.length ?? 1;
  const adjusted = normalized.endsWith("e") && groups > 1 ? groups - 1 : groups;
  return Math.max(1, adjusted);
}

function buildWordTimings(words: WordToken[], text: string, duration: number): WordTiming[] {
  if (!words.length || !duration) return [];
  const speechWeights = words.map((word) => estimateSyllables(word.word));
  const pauseWeights = words.map((word, index) => {
    const nextStart = words[index + 1]?.start ?? text.length;
    const separator = text.slice(word.end, nextStart);
    if (/[.!?]/.test(separator)) return 0.28;
    if (/[,;:]/.test(separator)) return 0.13;
    return 0.025;
  });
  const rawPauseTotal = pauseWeights.reduce((sum, pause) => sum + pause, 0);
  const pauseScale = rawPauseTotal ? Math.min(1, (duration * 0.18) / rawPauseTotal) : 0;
  const pauseTotal = rawPauseTotal * pauseScale;
  const speechDuration = Math.max(0.01, duration - pauseTotal);
  const totalSpeechWeight = speechWeights.reduce((sum, weight) => sum + weight, 0);
  let cursor = 0;

  return words.map((word, index) => {
    const start = cursor;
    const end = start + (speechWeights[index] / totalSpeechWeight) * speechDuration;
    cursor = end + pauseWeights[index] * pauseScale;
    return { start, end };
  });
}

function buildReadingChunks(words: WordToken[], text: string): ReadingChunk[] {
  if (!words.length) return [];
  const chunks: ReadingChunk[] = [];
  let startIndex = 0;

  words.forEach((word, index) => {
    const nextStart = words[index + 1]?.start ?? text.length;
    const separator = text.slice(word.end, nextStart);
    const sentenceEnd = /[.!?。！？]/.test(separator);
    const paragraphBreak = /\n/.test(separator);

    if (sentenceEnd || paragraphBreak || index === words.length - 1) {
      chunks.push({ startIndex, endIndex: index });
      startIndex = index + 1;
    }
  });

  return chunks;
}

function normalizeVocabularyWord(word: string) {
  return word.toLowerCase().replaceAll("’", "'");
}

function isDifficultWord(word: string) {
  const normalized = normalizeVocabularyWord(word);
  return Boolean(LOCAL_VOCABULARY[normalized]) || normalized.length >= 9;
}

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function PracticeWorkspace() {
  const [text, setText] = useState("");
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [status, setStatus] = useState("Ready to read");
  const [speed, setSpeed] = useState(0.93);
  const [readingFontScale, setReadingFontScale] = useState(1);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [wordTimings, setWordTimings] = useState<WordTiming[]>([]);
  const [parsedSpeechRate, setParsedSpeechRate] = useState<number | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [history, setHistory] = useState<SpeechHistoryEntry[]>([]);
  const [vocabularyNotes, setVocabularyNotes] = useState<Record<string, VocabularyNote>>(() => getVocabularyCache());
  const [openVocabularyWord, setOpenVocabularyWord] = useState<string | null>(null);
  const [vocabularyLoading, setVocabularyLoading] = useState<string | null>(null);
  const [vocabularyError, setVocabularyError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const speechTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressFrame = useRef<number | null>(null);
  const words = useMemo(() => getWordTokens(text), [text]);
  const readingChunks = useMemo(() => buildReadingChunks(words, text), [text, words]);

  useEffect(() => {
    const historyTimer = window.setTimeout(() => setHistory(getSpeechHistory()), 0);
    const timer = speechTimer.current;
    return () => {
      window.clearTimeout(historyTimer);
      window.speechSynthesis?.cancel();
      if (timer) clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!isReading) {
      if (progressFrame.current !== null) window.cancelAnimationFrame(progressFrame.current);
      progressFrame.current = null;
      return;
    }

    const updateProgress = () => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setAudioProgress((current) => Math.abs(audio.currentTime - current) > 0.025 ? audio.currentTime : current);
          setAudioDuration(audio.duration);
        }
      }
      progressFrame.current = window.requestAnimationFrame(updateProgress);
    };

    progressFrame.current = window.requestAnimationFrame(updateProgress);
    return () => {
      if (progressFrame.current !== null) window.cancelAnimationFrame(progressFrame.current);
      progressFrame.current = null;
    };
  }, [isReading]);

  useEffect(() => {
    function resetForNewVisit() {
      window.speechSynthesis?.cancel();
      audioRef.current?.pause();
      setText("");
      setAudioUrl(null);
      setAudioProgress(0);
      setAudioDuration(0);
      setWordTimings([]);
      setParsedSpeechRate(null);
      setIsParsing(false);
      setActiveWordIndex(null);
      setSelectedWordIndex(null);
      setIsReading(false);
      setStatus("Ready to read");
    }

    window.addEventListener("pageshow", resetForNewVisit);
    return () => window.removeEventListener("pageshow", resetForNewVisit);
  }, []);

  function stopPlayback() {
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    if (speechTimer.current) {
      clearInterval(speechTimer.current);
      speechTimer.current = null;
    }
    setIsReading(false);
  }

  function getPlaybackRate(nextSpeed = speed) {
    if (!parsedSpeechRate || !Number.isFinite(parsedSpeechRate)) return 1;
    return Math.min(2, Math.max(0.5, nextSpeed / parsedSpeechRate));
  }

  function syncAudioPlaybackRate(nextSpeed = speed) {
    const audio = audioRef.current;
    if (audio && audioUrl && parsedSpeechRate) audio.playbackRate = getPlaybackRate(nextSpeed);
  }

  function speakSingleWord(index: number) {
    const word = words[index];
    if (!word) return;

    setSelectedWordIndex(index);
    setActiveWordIndex(index);
    stopPlayback();
    if (!window.speechSynthesis) {
      setStatus(`已选中 “${word.word}”，浏览器不支持单词朗读`);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(word.word);
    utterance.lang = "en-US";
    utterance.rate = speed;
    utterance.pitch = 0.86;
    utterance.onstart = () => {
      setIsReading(true);
      setStatus(`单独朗读：${word.word}`);
    };
    utterance.onend = () => {
      setIsReading(false);
      setActiveWordIndex(null);
      setStatus(`已选中 ${word.word}，点击开始朗读将从这里继续`);
    };
    utterance.onerror = () => {
      setIsReading(false);
      setStatus("单词朗读失败，请重试");
    };
    window.speechSynthesis.speak(utterance);
  }

  function seekAudioToWord(index: number, autoplay = true) {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    const word = words[index];
    if (!word) return;

    const seekAndPlay = () => {
      if (Number.isFinite(audio.duration)) {
        const timing = wordTimings[index];
        const ratio = word.start / Math.max(text.length, 1);
        const startTime = timing?.start ?? ratio * audio.duration;
        audio.currentTime = Math.min(audio.duration, Math.max(0, startTime));
      }
      if (autoplay) void audio.play().catch(() => setStatus("已定位，请点击下方播放控件继续"));
    };

    if (audio.readyState >= 1 && Number.isFinite(audio.duration)) {
      seekAndPlay();
      return;
    }
    audio.addEventListener("loadedmetadata", seekAndPlay, { once: true });
    audio.load();
  }

  function handleWordClick(index: number) {
    const word = words[index];
    if (!word) return;
    if (audioUrl) {
      const audio = audioRef.current;
      audio?.pause();
      seekAudioToWord(index, false);
    }
    speakSingleWord(index);
  }

  function replaceText(nextText: string) {
    stopPlayback();
    setText(nextText);
    setAudioUrl(null);
    setAudioProgress(0);
    setAudioDuration(0);
    setWordTimings([]);
    setParsedSpeechRate(null);
    setIsParsing(false);
    setActiveWordIndex(null);
    setSelectedWordIndex(null);
  }

  function handleSpeedChange(nextSpeed: number) {
    setSpeed(nextSpeed);
    if (audioUrl) {
      syncAudioPlaybackRate(nextSpeed);
      setStatus(isReading ? "语速已调整 · 标注保持同步" : "语速已调整 · 可以继续播放");
    }
  }

  async function parseSpeech() {
    if (!text.trim()) {
      setStatus("先输入一段英文");
      return;
    }

    stopPlayback();
    setIsParsing(true);
    setAudioUrl(null);
    setAudioProgress(0);
    setAudioDuration(0);
    setWordTimings([]);
    setParsedSpeechRate(null);
    setActiveWordIndex(null);
    setStatus("正在解析音频…");
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          apiKey: getUnlockedApiKey() ?? undefined,
          voiceName: "en-US-Chirp3-HD-Achird",
          speakingRate: speed,
          pitch: -1.2,
        }),
      });

      if (!response.ok) throw new Error("Google TTS is not configured");
      const data = (await response.json().catch(() => ({}))) as { audioContent?: string; mimeType?: string; error?: string; details?: string; chunkCount?: number };
      if (!response.ok) throw new Error([data.error, data.details].filter(Boolean).join(" · ") || `HTTP ${response.status}`);
      if (!data.audioContent) throw new Error("Google TTS 没有返回音频");
      recordTtsUsage(text.length);
      setAudioUrl(`data:${data.mimeType ?? "audio/mpeg"};base64,${data.audioContent}`);
      setParsedSpeechRate(speed);
      setStatus(data.chunkCount && data.chunkCount > 1 ? `解析成功 · 已自动分段合并 ${data.chunkCount} 段` : "解析成功 · 可以开始播放");
    } catch (error) {
      setAudioUrl(null);
      setParsedSpeechRate(null);
      const message = error instanceof Error ? error.message : "请检查 Google TTS 设置";
      setStatus(`解析失败 · ${message.slice(0, 140)}`);
    } finally {
      setIsParsing(false);
    }
  }

  function readAloud() {
    if (!text.trim()) {
      setStatus("先输入一段英文");
      return;
    }

    if (isParsing) {
      setStatus("正在解析，请稍候");
      return;
    }

    if (isReading) {
      stopPlayback();
      setActiveWordIndex(null);
      setStatus("已暂停");
      return;
    }

    if (!audioUrl || !audioRef.current) {
      setStatus("请先点击解析，再开始播放");
      return;
    }

    const startWordIndex = selectedWordIndex ?? 0;
    syncAudioPlaybackRate();
    setStatus(startWordIndex > 0 ? "从选中的词开始播放" : "开始播放自然语音");
    seekAudioToWord(startWordIndex);
  }

  function saveCurrentSpeech() {
    if (!text.trim()) {
      setStatus("先输入一段英文");
      return;
    }

    const audioMatch = audioUrl?.match(/^data:([^;]+);base64,(.+)$/);
    const result = addSpeechHistory({
      text,
      audioContent: audioMatch?.[2],
      mimeType: audioMatch?.[1],
      voiceName: audioMatch ? "en-US-Chirp3-HD-Achird" : undefined,
      speakingRate: audioMatch ? speed : undefined,
    });
    setHistory(result.entries);
    if (!result.audioStored) {
      setStatus("历史文字已保存，但本地空间不足，音频未保存");
    } else if (audioMatch) {
      setStatus("已保存到历史记录，可反复播放");
    } else {
      setStatus("已保存文字；再次生成 Google 音频后可保留声音");
    }
  }

  function loadHistory(entry: SpeechHistoryEntry) {
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    setIsReading(false);
    setText(entry.text);
    setActiveWordIndex(null);
    setSelectedWordIndex(null);
    setAudioProgress(0);
    setAudioDuration(0);
    setWordTimings([]);
    setParsedSpeechRate(entry.audioContent ? entry.speakingRate ?? 0.93 : null);
    setIsParsing(false);
    if (entry.audioContent) {
      setAudioUrl(`data:${entry.mimeType ?? "audio/mpeg"};base64,${entry.audioContent}`);
      setStatus("已载入历史音频，可以开始播放");
    } else {
      setAudioUrl(null);
      setStatus("已载入历史文本，请先点击解析");
    }
  }

  function deleteHistoryEntry(id: string) {
    setHistory(removeSpeechHistory(id));
  }

  function handleAudioTimeUpdate() {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setAudioProgress(audio.currentTime);
    setAudioDuration(audio.duration);
  }

  function handleAudioLoadedMetadata() {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    setAudioDuration(audio.duration);
    setAudioProgress(audio.currentTime);
    setWordTimings(buildWordTimings(words, text, audio.duration));
    syncAudioPlaybackRate();
  }

  function handleAudioSeek(event: React.ChangeEvent<HTMLInputElement>) {
    const nextTime = Number(event.target.value);
    setAudioProgress(nextTime);
    if (audioRef.current && audioUrl) audioRef.current.currentTime = nextTime;
  }

  function resetAudioPosition() {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    audio.currentTime = 0;
    setAudioProgress(0);
    setActiveWordIndex(null);
    setSelectedWordIndex(null);
    setStatus("已回到开头");
  }

  function downloadAudio() {
    if (!audioUrl) {
      setStatus("先生成一段音频，再下载到本地");
      return;
    }

    const link = document.createElement("a");
    link.href = audioUrl;
    const extension = audioUrl.startsWith("data:audio/wav") ? "wav" : "mp3";
    link.download = `voice-lab-${new Date().toISOString().slice(0, 10)}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setStatus("音频已下载到本地");
  }

  function formatAudioTime(value: number) {
    if (!Number.isFinite(value) || value <= 0) return "0:00";
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function showVocabularyWord(word: string) {
    setOpenVocabularyWord(normalizeVocabularyWord(word));
    setVocabularyError(null);
  }

  async function loadVocabularyNote(word: string) {
    const normalized = normalizeVocabularyWord(word);
    showVocabularyWord(normalized);
    if (LOCAL_VOCABULARY[normalized] || vocabularyNotes[normalized] || vocabularyLoading === normalized) return;

    setVocabularyLoading(normalized);
    try {
      const response = await fetch(`/api/vocabulary?word=${encodeURIComponent(normalized)}`);
      const payload = (await response.json().catch(() => null)) as { note?: VocabularyNote; error?: string } | null;
      if (!response.ok || !payload?.note) throw new Error(payload?.error ?? "Vocabulary lookup failed");
      setVocabularyNotes((current) => ({ ...current, [normalized]: payload.note as VocabularyNote }));
      saveVocabularyNote(payload.note as VocabularyNote);
    } catch {
      setVocabularyError(normalized);
    } finally {
      setVocabularyLoading(null);
    }
  }

  const readingSyncLead = isReading && audioDuration > 0 ? Math.min(0.32, Math.max(0.12, audioDuration * 0.018)) : 0;
  const readingProgress = audioDuration > 0 ? Math.min(1, Math.max(0, (audioProgress + readingSyncLead) / audioDuration)) : 0;

  function getWordProgress(index: number, edge: "start" | "end") {
    const word = words[index];
    const timing = wordTimings[index];
    const value = audioDuration && timing ? timing[edge] / audioDuration : word[edge] / Math.max(text.length, 1);
    return Math.min(1, Math.max(0, value));
  }

  function renderWord(word: WordToken, index: number) {
    const normalized = normalizeVocabularyWord(word.word);
    const isVocabularyWord = isDifficultWord(word.word);
    const note = LOCAL_VOCABULARY[normalized] ?? vocabularyNotes[normalized];
    if (isVocabularyWord) {
      return (
        <span
          className="vocab-word-wrap"
          key={`${word.word}-${word.start}`}
          onMouseEnter={() => showVocabularyWord(word.word)}
          onMouseLeave={() => setOpenVocabularyWord((current) => current === normalized ? null : current)}
        >
          <button
            className={`read-word ${activeWordIndex === index ? "is-speaking" : ""} ${selectedWordIndex === index ? "is-selected" : ""}`}
            type="button"
            data-word-index={index}
            aria-label={`单独朗读 ${word.word}`}
            onClick={() => handleWordClick(index)}
          >
            {word.word}
          </button>
          <button
            className="vocab-marker"
            type="button"
            aria-label={`查看 ${word.word} 的词义`}
            onFocus={() => showVocabularyWord(word.word)}
            onClick={(event) => { event.stopPropagation(); void loadVocabularyNote(word.word); }}
          >
            i
          </button>
          {openVocabularyWord === normalized ? (
            <span className="vocab-popover" role="tooltip">
              <strong>{word.word}</strong>
              {vocabularyLoading === normalized ? <span className="vocab-muted">正在查询…</span> : note ? <>
                <span className="vocab-translation">{note.translation}</span>
                {note.partOfSpeech ? <span className="vocab-part">{note.partOfSpeech}</span> : null}
                {note.definition ? <span className="vocab-definition">{note.definition}</span> : null}
                {note.example ? <span className="vocab-example">“{note.example}”</span> : null}
                <small>{note.source === "local" ? "内置中学生词汇提示" : "已保存在本机，下次不再查询"}</small>
              </> : vocabularyError === normalized ? <span className="vocab-muted">暂时查不到，稍后再试</span> : <span className="vocab-muted">点击 i 获取中文释义</span>}
            </span>
          ) : null}
        </span>
      );
    }
    return (
      <button
        className={`read-word ${activeWordIndex === index ? "is-speaking" : ""} ${selectedWordIndex === index ? "is-selected" : ""}`}
        type="button"
        data-word-index={index}
        aria-label={`单独朗读 ${word.word}`}
        key={`${word.word}-${word.start}`}
        onClick={() => handleWordClick(index)}
      >
        {word.word}
      </button>
    );
  }

  function renderText() {
    if (!text) return <span className="empty-output">输入英文后，这里会显示可跟读文本。</span>;
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    readingChunks.forEach((chunk, chunkIndex) => {
      const firstWord = words[chunk.startIndex];
      const startProgress = getWordProgress(chunk.startIndex, "start");
      const endProgress = Math.max(startProgress + 0.001, getWordProgress(chunk.endIndex, "end"));
      const isRead = readingProgress >= endProgress;
      const isCurrent = !isRead && readingProgress >= startProgress && readingProgress <= endProgress;
      const nextChunk = readingChunks[chunkIndex + 1];
      const chunkTextEnd = nextChunk ? words[nextChunk.startIndex].start : text.length;
      const chunkParts: React.ReactNode[] = [];
      let chunkCursor = firstWord.start;

      for (let index = chunk.startIndex; index <= chunk.endIndex; index += 1) {
        const word = words[index];
        if (word.start > chunkCursor) chunkParts.push(<span key={`chunk-space-${chunkIndex}-${word.start}`}>{text.slice(chunkCursor, word.start)}</span>);
        chunkParts.push(renderWord(word, index));
        chunkCursor = word.end;
      }
      if (chunkCursor < chunkTextEnd) chunkParts.push(<span key={`chunk-tail-${chunkIndex}`}>{text.slice(chunkCursor, chunkTextEnd)}</span>);
      if (firstWord.start > cursor) parts.push(<span key={`space-${firstWord.start}`}>{text.slice(cursor, firstWord.start)}</span>);
      parts.push(
        <span className={`reading-chunk ${isRead ? "is-read" : ""} ${isCurrent ? "is-current" : ""}`} data-chunk-index={chunkIndex} key={`chunk-${chunkIndex}`}>
          {chunkParts}
        </span>,
      );
      cursor = chunkTextEnd;
    });
    if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
    return parts;
  }

  return (
    <main className="prototype-shell">
      <header className="simple-header">
        <div className="simple-brand"><span>V</span>OICE LAB</div>
        <div className="header-right"><span className="local-badge">LOCAL PROTOTYPE</span><Link className="settings-link" href="/settings">API 设置 <span>↗</span></Link></div>
      </header>

      <section className="simple-intro">
        <span className="simple-kicker">SPEECH PRACTICE / 01</span>
        <h1>输入一段英文，<br /><em>开始朗读。</em></h1>
        <p>先把内容读顺，再把声音读得像自己。</p>
      </section>

      <section className="input-panel">
        <div className="panel-topline"><span>YOUR SCRIPT</span><span>{words.length} words</span></div>
        <textarea aria-label="英文演讲稿" value={text} onChange={(event) => replaceText(event.target.value)} placeholder="Paste your English speech here..." />
        <div className="input-actions">
          <button className="sample-button" type="button" onClick={() => replaceText(SAMPLE_TEXT)}>使用示例</button>
          <button className="save-button" type="button" onClick={saveCurrentSpeech}>保存这一段<span>＋</span></button>
          <button className="parse-button" type="button" onClick={() => void parseSpeech()} disabled={isParsing || !text.trim()}>{isParsing ? "解析中…" : "解析"}<span>↗</span></button>
          <div className="workflow-guide" aria-label="使用步骤">
            <span className={`workflow-step ${audioUrl ? "is-complete" : "is-current"}`} aria-current={!audioUrl ? "step" : undefined}><b>1</b><span>第一步：点击解析</span></span>
            <span className="workflow-arrow" aria-hidden="true">→</span>
            <span className={`workflow-step ${audioUrl ? "is-current" : "is-waiting"}`}><b>2</b><span>第二步：点击播放</span></span>
          </div>
          <span className="input-hint">先解析，确认成功后再播放；内容只在当前浏览器内使用</span>
        </div>
      </section>

      <section className="output-panel">
        <div className="panel-topline"><span>READING VIEW</span><span className="status-text"><i />{status}</span></div>
        <div className="reading-text">
          <div className={`reading-copy ${isReading ? "is-reading" : ""}`} style={{ fontSize: `${readingFontScale}em` }} role="progressbar" aria-label="短语级朗读位置" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(readingProgress * 100)}>{renderText()}</div>
        </div>
        <div className="reading-footer">
          <div className="reading-controls">
            <div className="text-size-control" aria-label="文字大小">
              <span>文字</span>
              <button type="button" onClick={() => setReadingFontScale((current) => Math.max(0.8, Number((current - 0.1).toFixed(2))))} aria-label="缩小文字">A−</button>
              <output>{Math.round(readingFontScale * 100)}%</output>
              <button type="button" onClick={() => setReadingFontScale((current) => Math.min(1.4, Number((current + 0.1).toFixed(2))))} aria-label="放大文字">A＋</button>
              <button className="text-size-reset" type="button" onClick={() => setReadingFontScale(1)} aria-label="恢复默认文字大小">默认</button>
            </div>
            <label className="speed-control"><span>语速</span><input aria-label="语速" type="range" min="0.7" max="1.1" step="0.01" value={speed} onChange={(event) => handleSpeedChange(Number(event.target.value))} /><strong>{speed.toFixed(2)}×</strong></label>
          </div>
          <span className="highlight-tip"><b />柔和高亮会跟随当前短语移动</span>
        </div>
        <div className="audio-console">
          <button className="audio-console-play" type="button" onClick={readAloud} aria-label={isReading ? "暂停朗读" : audioUrl ? "开始播放" : "请先解析"} aria-pressed={isReading}>
            <span className={`audio-console-illustration ${isReading ? "is-active" : ""}`} aria-hidden="true"><i /><i /></span>
            <span className="audio-console-label"><small>VOICE PLAYER</small><strong>{isReading ? "暂停朗读" : audioUrl ? "开始播放" : "等待解析"}</strong></span>
          </button>
          <div className="audio-console-track">
            <div className="audio-console-topline"><span>{selectedWordIndex === null ? "准备好后开始播放" : `从第 ${selectedWordIndex + 1} 个词继续`}</span><time>{formatAudioTime(audioProgress)} / {formatAudioTime(audioDuration)}</time></div>
            <input aria-label="音频进度" type="range" min="0" max={audioDuration || 1} step="0.01" value={Math.min(audioProgress, audioDuration || 0)} onChange={handleAudioSeek} disabled={!audioUrl || !audioDuration} />
            <div className={`audio-console-wave ${isReading ? "is-active" : ""}`} aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          </div>
          <button className="audio-console-reset" type="button" onClick={resetAudioPosition} disabled={!audioUrl} aria-label="回到音频开头">从头</button>
          <button className="audio-console-download" type="button" onClick={downloadAudio} disabled={!audioUrl} aria-label="下载音频">下载</button>
        </div>
        <audio ref={audioRef} className="audio-source" src={audioUrl ?? undefined} onLoadedMetadata={handleAudioLoadedMetadata} onTimeUpdate={handleAudioTimeUpdate} onPlay={() => setIsReading(true)} onPause={() => setIsReading(false)} onEnded={() => { setIsReading(false); setAudioProgress(audioRef.current?.duration ?? audioProgress); setActiveWordIndex(null); setStatus("朗读完成"); }} />
      </section>

      <section className="history-panel">
        <div className="panel-topline"><span>HISTORY / {MAX_HISTORY_ENTRIES}</span><span>{history.length} / {MAX_HISTORY_ENTRIES}</span></div>
        {history.length === 0 ? <div className="history-empty">保存一段演讲后，它会出现在这里，最多保留 50 条。</div> : <div className="history-list">{history.map((entry, index) => <article className="history-item" key={entry.id}>
          <div className="history-item-top"><span className="history-order">{String(index + 1).padStart(2, "0")}</span><time>{formatHistoryDate(entry.createdAt)}</time><button className="history-load-button" type="button" onClick={() => loadHistory(entry)}>{entry.audioContent ? "载入并播放" : "载入文本"}<span>{entry.audioContent ? "▶" : "↗"}</span></button></div>
          <p>{entry.text}</p>
          <div className="history-item-meta"><span>{getWordTokens(entry.text).length} words</span><span>{entry.audioContent ? "Google 音频已保存" : "仅保存文字"}</span><button className="history-delete-button" type="button" onClick={() => deleteHistoryEntry(entry.id)}>删除</button></div>
        </article>)}</div>}
      </section>

      <footer className="simple-footer"><span>VOICE LAB / FIRST LOCAL VERSION</span><span>内容与历史仅保存在当前浏览器 · API Key 在服务端调用</span></footer>
    </main>
  );
}

export default function Home() {
  return <AccessGate><PracticeWorkspace /></AccessGate>;
}
