import { useEffect, useMemo, useRef, useState } from "react";
import { loadAsset, removeAsset, saveAsset } from "./storage.js";
import { createRemoteBlessing, createRemoteTimeline, deleteRemoteBlessing, deleteRemoteBlessings, deleteRemoteTimeline, detectRemote, getRemotePassword, loadRemoteState, login, loginAdmin, remoteMediaUrl, uploadRemoteAudio } from "./api.js";

const BIRTH_TIME = new Date("2026-08-25T08:52:00+08:00");
const LOCAL_ADMIN_PIN = "08250852";
const TIMELINE_KEY = "shimuen:timeline:v1";
const BLESSINGS_KEY = "shimuen:blessings:v1";
const BLESSING_OWNERS_KEY = "shimuen:blessing-owners:v1";

const LANGUAGE_COOKIE = "moon_language";

const SEED_TIMELINE = [
  { id: "birth", title: "时光的起点", note: "时沐恩来到这个世界。", occurredAt: "2026-08-25T08:52:00+08:00", kind: "text", system: true },
  { id: "first-meeting", title: "初见", note: "出生后的第一张小小肖像。", occurredAt: "2026-08-25T11:29:00+08:00", kind: "image", assetUrl: "/assets/photos/first-meeting.jpg", system: true },
  { id: "day-six-dream", title: "第六天的梦", note: "睡得很安静的一天。", occurredAt: "2026-08-30T20:36:00+08:00", kind: "image", assetUrl: "/assets/photos/sleeping-day-six.jpg", system: true },
  { id: "day-eight-light", title: "第八天的晨光", note: "阳光落在小手和脸颊上。", occurredAt: "2026-09-01T10:51:00+08:00", kind: "image", assetUrl: "/assets/photos/morning-day-eight.jpg", system: true },
];

const MIC_REQUEST_TIMEOUT_MS = 30_000;
const RECORDING_MIME_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];

const TEXT_PROMPTS = [
  { question: { zh: "想和沐恩说一句什么？", en: "What would you like to say to Mu En?" }, hint: { zh: "不用写得完整，想到什么就写什么。", en: "It does not need to be complete—just write what comes to mind." } },
  { question: { zh: "今天想祝福他什么？", en: "What would you like to wish for him today?" }, hint: { zh: "一句很普通的话也很好。", en: "An ordinary sentence is more than enough." } },
  { question: { zh: "想留下一点小小的期盼吗？", en: "Would you like to leave a small hope for him?" }, hint: { zh: "可以是明天、周末，或很久以后的事。", en: "It can be for tomorrow, this weekend, or much later." } },
  { question: { zh: "以后想和他一起做什么？", en: "What would you like to do together one day?" }, hint: { zh: "去散步、吃顿饭，或做一件小事都可以。", en: "A walk, a meal, or any small thing is perfect." } },
  { question: { zh: "想告诉他今天发生的一件小事吗？", en: "Would you like to tell him one small thing from today?" }, hint: { zh: "不需要特别，只要是你想留下的。", en: "Nothing special is needed—just something you want to keep." } },
];

const VOICE_PROMPTS = [
  { question: { zh: "对沐恩说一句你好吧。", en: "Say a simple hello to Mu En." }, hint: { zh: "像平时和他说话一样就好。", en: "Just speak as you would normally speak to him." } },
  { question: { zh: "叫一次他的名字，再留一句祝福。", en: "Say his name once, then leave a little wish." }, hint: { zh: "几秒钟也可以。", en: "A few seconds is enough." } },
  { question: { zh: "说说今天的天气，或你正在做什么。", en: "Tell him about today’s weather or what you are doing." }, hint: { zh: "让他以后听见今天的一点声音。", en: "Let him hear a little of today someday." } },
  { question: { zh: "告诉他一件以后想一起做的小事。", en: "Tell him one small thing you hope to do together." }, hint: { zh: "散步、看书、吃饭都可以。", en: "A walk, a book, or a meal all count." } },
  { question: { zh: "留一句以后再听，也会觉得安心的话。", en: "Leave a sentence that may feel comforting to hear later." }, hint: { zh: "不用准备，慢慢说就好。", en: "No preparation needed—take your time." } },
];

const TIMELINE_COPY = {
  birth: { zh: { title: "时光的起点", note: "时沐恩来到这个世界。" }, en: { title: "The beginning of time", note: "Shimuen came into the world." } },
  "first-meeting": { zh: { title: "初见", note: "出生后的第一张小小肖像。" }, en: { title: "Our first hello", note: "A tiny portrait from his first day." } },
  "day-six-dream": { zh: { title: "第六天的梦", note: "睡得很安静的一天。" }, en: { title: "A dream on day six", note: "A quiet day of deep sleep." } },
  "day-eight-light": { zh: { title: "第八天的晨光", note: "阳光落在小手和脸颊上。" }, en: { title: "Morning light on day eight", note: "Sunlight rested on his tiny hands and cheeks." } },
};

const COPY = {
  zh: {
    languageLabel: "语言", languageZh: "中文", languageEn: "English", close: "关闭", busy: "处理中…", local: "本地", remote: "共享", passwordIncorrect: "密码不正确。",
    readingAsset: "正在读取本地素材…", openDocument: "打开文档", unnamedFile: "未命名文件", timeline: "生命时间线", moments: "个片段", viewMoment: "查看这一刻",
    familyBlessings: "家人的祝福", stars: "颗星", starMap: "家人的祝福星图", litStars: (count) => `已点亮 ${count} 颗星`, firstStarWaiting: "第一颗星正在等你",
    litStarHint: "一颗亮星，对应一份祝福。轻触星点，看看是谁留下的。", emptyStarHint: "这里不会有多余的星；第一份留言，会点亮第一颗。", firstStar: "点亮第一颗星", newStar: "点亮一颗新星", firstBlessing: "留下第一句祝福", write: "写句话", voice: "录一段声音", voiceBlessing: "留下了一段声音", mine: "我的", starMessage: (name) => `${name} 的留言`, tapToView: "轻触查看",
    beginning: "THE BEGINNING OF TIME", privateMark: "时沐恩 · 家庭私享纪念页", familyMark: "Shimuen · Family keepsake", manage: "管理", manageEn: "Manage", remoteBanner: "家庭私享入口 · 访问与内容均受保护", localBanner: "本地原型 · 内容仅保存在当前浏览器", birthLine: "2026.08.25 · 08:52 · 时间仍在生长", birthDay: (day) => `来到世界的第 ${day} 天`, breathing: "每一秒，都在成为新的故事", navTimeline: "生命时间线", navBlessings: "家人祝福", counterAria: (d, h, m, s) => `已经来到世界 ${d} 天 ${h} 小时 ${m} 分 ${s} 秒`,
    blessingModal: "留下一颗祝福星", yourName: "你的称呼", namePlaceholder: "例如：外婆", messageMethod: "留言方式", smallQuestion: "一点小问题", shuffle: "换一个问题", freeChoice: "任选一个问题，也可以完全按自己的方式说。", messageToBaby: "想对沐恩说的话", writePlaceholder: "想对沐恩说的话", micWaiting: "正在请求麦克风权限，请留意浏览器提示…", recording: "正在记录这段声音…", audioSaved: "声音已经保存，可以先试听", recordingPrompt: "按下按钮，录一段不超过一分钟的祝福", hearingVoice: "正在听见你的声音", voiceTemperature: "这一段声音的温度", waveformIdle: "波形会随着声音轻轻起伏", waveformRecording: "录音中的声音波形", waveformSaved: "已保存的声音波形", waveformWaiting: "等待录音的声音波形", browserNoWaveform: "你的浏览器暂时无法显示声音波形。", waitPermission: "等待授权…", endRecording: "结束录音", rerecord: "重新录音", startRecording: "开始录音", savingBlessing: "正在保存祝福…", keepOpen: "请保持这个页面打开，无需重复点击。", writingStar: "正在把这句话写进沐恩的星图。", uploading: "上传中，请稍候…", lighting: "正在点亮，请稍候…", finishRecording: "请先完成录音", lightStar: "点亮这颗星", nameRequired: "请先留下你的称呼。", contentRequired: "请写一句话，或者录下一段声音。", finishRecordingError: "请先结束录音，确认声音已经保存后再点亮这颗星。", blessingSaveError: "祝福暂时没有保存成功，请稍后重试。",
    accessEyebrow: "MOON · PRIVATE FAMILY ROOM", accessTitle: "时沐恩的月光房间", accessBody: "这是家人之间的小小入口。输入本月访问密码，去看时间线，也留下你想说的话。", accessPassword: "访问密码", accessPlaceholder: "请输入本月密码", openRoom: "进入月光房间", passwordHint: "密码每月更新一次，请向家人索取最新密码。", moonAnswer: "日月和星辰会给你答案", opening: "正在打开…", checkingTitle: "正在点亮月光房间…", checkingBody: "请稍等，正在确认这是本地预览还是共享入口。",
    managementShared: "共享内容管理", managementLocal: "本地内容管理", enterManagement: "进入管理模式", protectedNote: "这是受保护的管理入口，新增内容会记录到家庭时间线。", adminPassword: "管理员密码", localPin: "管理密码", verify: "正在验证…", enterManage: "进入管理", thisMonth: "THIS MONTH · ACCESS KEY", currentPassword: "本月访问密码", updatedAt: (date) => `更新于 ${date}`, tellFamily: "请妥善转告家人", viewPassword: "查看本月密码", newMoment: "NEW MOMENT", addMoment: "增加一条时间记录", uploadIntro: "把一张照片和几句话留在沐恩的时间线上。", title: "标题", titlePlaceholder: "例如：第一次回到家", occurredAt: "发生时间", timeHint: "可以选择过去、现在或未来的时间，时间线会自动按发生时间排序。", shortNote: "简短说明", notePlaceholder: "留下一点当时的细节", attachment: "图片或其他素材", uploadHint: "可以只写文字，也可以附上一张图片、音视频或文档。", chooseAttachment: "选择一张图片或文件", dropAttachment: "也可以把素材拖到这里", selectedAttachment: "已选素材", removeAttachment: "移除素材", savingRecord: "正在保存这条记录…", uploadDetail: "请保持页面打开，素材上传完成后会自动加入时间线。", savingUpload: "正在上传 / 保存中…", addToTimeline: "加入时间线", localArchive: "LOCAL ARCHIVE", currentTimeline: "当前时间线", delete: "删除", blessings: "BLESSINGS", clearAll: "清空全部祝福", noBlessings: "还没有访客祝福。", remotePasswordError: "暂时无法读取本月访问密码。", protectedRoom: "家庭私享入口 · 访问与内容均受保护",
    detailFrom: (name) => `来自 ${name} 的留言`, litBy: (name) => `这颗星由 ${name} 点亮`, withdraw: "撤回这句祝福", momentLabel: "查看这一刻", confirmDeleteMoment: (title) => `确认删除“${title}”吗？`, confirmDeleteBlessing: (name) => `确认删除 ${name} 留下的祝福吗？`, confirmWithdraw: "确认撤回这句祝福吗？", confirmClear: (count) => `确认清空全部 ${count} 句访客祝福吗？此操作不可恢复。`, savingMoment: "这条记录正在保存，请稍候。", sendingBlessing: "这份祝福正在发送，请稍候。",
  },
  en: {
    languageLabel: "Language", languageZh: "中文", languageEn: "English", close: "Close", busy: "Working…", local: "LOCAL", remote: "SHARED", passwordIncorrect: "The password is incorrect.",
    readingAsset: "Loading local media…", openDocument: "Open document", unnamedFile: "Untitled file", timeline: "Life timeline", moments: "moments", viewMoment: "View this moment",
    familyBlessings: "Family blessings", stars: "stars", starMap: "Family blessing star map", litStars: (count) => `${count} ${count === 1 ? "star" : "stars"} lit`, firstStarWaiting: "The first star is waiting",
    litStarHint: "One bright star, one blessing. Tap a star to see who left it.", emptyStarHint: "No extra stars here; the first message will light the first one.", firstStar: "Light the first star", newStar: "Light a new star", firstBlessing: "Leave the first blessing", write: "Write a note", voice: "Record a voice", voiceBlessing: "Left a voice message", mine: "Mine", starMessage: (name) => `${name}'s message`, tapToView: "Tap to view",
    beginning: "THE BEGINNING OF TIME", privateMark: "时沐恩 · 家庭私享纪念页", familyMark: "Shimuen · Family keepsake", manage: "管理", manageEn: "Manage", remoteBanner: "Private family room · Protected access and content", localBanner: "Local prototype · Content stays in this browser", birthLine: "2026.08.25 · 08:52 · Time keeps growing", birthDay: (day) => `Day ${day} in the world`, breathing: "Every second becomes a new story", navTimeline: "Life timeline", navBlessings: "Family blessings", counterAria: (d, h, m, s) => `${d} days, ${h} hours, ${m} minutes and ${s} seconds in the world`,
    blessingModal: "Leave a blessing star", yourName: "Your name", namePlaceholder: "e.g. Grandma", messageMethod: "Message type", smallQuestion: "A SMALL QUESTION", shuffle: "Try another", freeChoice: "Choose one, or answer in your own way.", messageToBaby: "A note for Mu En", writePlaceholder: "What would you like to say to Mu En?", micWaiting: "Requesting microphone access—watch for the browser prompt…", recording: "Recording your voice…", audioSaved: "Voice saved; you can listen first", recordingPrompt: "Press to record a blessing under one minute", hearingVoice: "Listening to your voice", voiceTemperature: "The warmth in this voice", waveformIdle: "The waveform will gently move with your voice", waveformRecording: "Live voice waveform", waveformSaved: "Saved voice waveform", waveformWaiting: "Waiting for a voice recording", browserNoWaveform: "Your browser cannot display the waveform right now.", waitPermission: "Waiting for permission…", endRecording: "Finish recording", rerecord: "Record again", startRecording: "Start recording", savingBlessing: "Saving this blessing…", keepOpen: "Keep this page open; there is no need to tap again.", writingStar: "Writing this note into Mu En’s star map.", uploading: "Uploading, please wait…", lighting: "Lighting the star, please wait…", finishRecording: "Finish the recording first", lightStar: "Light this star", nameRequired: "Please leave your name first.", contentRequired: "Write a note or record a voice message.", finishRecordingError: "Finish the recording and make sure it is saved before lighting the star.", blessingSaveError: "The blessing was not saved. Please try again.",
    accessEyebrow: "MOON · PRIVATE FAMILY ROOM", accessTitle: "Shimuen’s moon room", accessBody: "A small room for family. Enter this month’s access password to view the timeline and leave a note.", accessPassword: "Access password", accessPlaceholder: "Enter this month’s password", openRoom: "Enter moon space", passwordHint: "The password changes monthly. Ask a family member for the latest one.", moonAnswer: "The sun, moon, and stars will give you the answer", opening: "Opening…", checkingTitle: "Opening moon space…", checkingBody: "Please wait while we check this private room.",
    managementShared: "Shared content management", managementLocal: "Local content management", enterManagement: "Enter management mode", protectedNote: "This protected area adds moments to the family timeline.", adminPassword: "Administrator password", localPin: "Management password", verify: "Verifying…", enterManage: "Enter management", thisMonth: "THIS MONTH · ACCESS KEY", currentPassword: "This month’s access password", updatedAt: (date) => `Updated ${date}`, tellFamily: "Please pass it on to family", viewPassword: "View this month’s password", newMoment: "NEW MOMENT", addMoment: "Add a timeline moment", uploadIntro: "Keep a photo and a few words in Mu En’s timeline.", title: "Title", titlePlaceholder: "e.g. First day back home", occurredAt: "When it happened", timeHint: "Choose a past, present, or future time; the timeline sorts itself by when it happened.", shortNote: "Short note", notePlaceholder: "Leave a small detail from that moment", attachment: "Photo or other media", uploadHint: "A note can stand on its own, or you can add a photo, audio, video, or document.", chooseAttachment: "Choose a photo or file", dropAttachment: "You can also drop it here", selectedAttachment: "Selected media", removeAttachment: "Remove media", savingRecord: "Saving this moment…", uploadDetail: "Keep this page open; the media will join the timeline when ready.", savingUpload: "Uploading / saving…", addToTimeline: "Add to timeline", localArchive: "LOCAL ARCHIVE", currentTimeline: "Current timeline", delete: "Delete", blessings: "BLESSINGS", clearAll: "Clear all blessings", noBlessings: "There are no visitor blessings yet.", remotePasswordError: "We could not load this month’s password.", protectedRoom: "Private family room · Protected access and content",
    detailFrom: (name) => `A message from ${name}`, litBy: (name) => `This star was lit by ${name}`, withdraw: "Withdraw this blessing", momentLabel: "View this moment", confirmDeleteMoment: (title) => `Delete “${title}”?`, confirmDeleteBlessing: (name) => `Delete the blessing left by ${name}?`, confirmWithdraw: "Withdraw this blessing?", confirmClear: (count) => `Clear all ${count} visitor blessings? This cannot be undone.`, savingMoment: "This moment is already being saved. Please wait.", sendingBlessing: "This blessing is already being sent. Please wait.",
  },
};

function t(lang, key, ...args) {
  const value = COPY[lang]?.[key] ?? COPY.zh[key] ?? key;
  return typeof value === "function" ? value(...args) : value;
}

function readLanguagePreference() {
  if (typeof document === "undefined") return "zh";
  const cookieValue = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${LANGUAGE_COOKIE}=`))?.split("=")[1];
  if (cookieValue === "en" || cookieValue === "zh") return cookieValue;
  return typeof navigator !== "undefined" && /^en(?:-|$)/i.test(navigator.language || "") ? "en" : "zh";
}

function writeLanguagePreference(lang) {
  if (typeof document !== "undefined") document.cookie = `${LANGUAGE_COOKIE}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function localizedError(error, lang, fallback) {
  const message = String(error?.message || fallback || "");
  if (lang === "zh") return message;
  const translations = {
    "密码不正确。": "The password is incorrect.",
    "登录失败，请稍后再试。": "Login failed. Please try again shortly.",
    "管理入口登录失败，请稍后再试。": "Management login failed. Please try again shortly.",
    "需要访问密码": "An access password is required.",
    "需要管理员权限": "Administrator access is required.",
    "尝试次数过多，请稍后再试。": "Too many attempts. Please try again later.",
    "媒体存储尚未配置。": "Media storage is not configured yet.",
    "祝福暂时没有保存成功。": "The blessing was not saved.",
    "声音上传失败。": "The voice upload failed.",
    "时间记录保存失败。": "The timeline moment was not saved.",
    "祝福删除失败。": "The blessing could not be deleted.",
    "祝福清理失败。": "The blessings could not be cleared.",
    "暂时无法读取共享内容。": "Shared content could not be loaded.",
    "这份祝福正在发送，请稍候。": "This blessing is already being sent. Please wait.",
    "这条记录正在保存，请稍候。": "This moment is already being saved. Please wait.",
  };
  return translations[message] || message;
}

function LanguageSwitch({ lang, onChange }) {
  return (
    <div className="language-switch" role="group" aria-label={t(lang, "languageLabel")}>
      <button type="button" aria-pressed={lang === "zh"} onClick={() => onChange("zh")}>{t(lang, "languageZh")}</button>
      <button type="button" aria-pressed={lang === "en"} onClick={() => onChange("en")}>{t(lang, "languageEn")}</button>
    </div>
  );
}

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function starPlacement(seed, index = 0) {
  let value = hashText(`${seed}:${index}`);
  const next = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
  return { left: `${18 + next() * 64}%`, top: `${28 + next() * 44}%`, size: 25 + Math.round(next() * 21), delay: `${-(next() * 4.6).toFixed(2)}s`, opacity: 0.78 + next() * 0.22 };
}

function createOwnerToken() {
  return `${crypto.randomUUID()}-${crypto.randomUUID()}`;
}

function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value]);
  return [value, setValue];
}

function useElapsedTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const totalSeconds = Math.max(0, Math.floor((now - BIRTH_TIME) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, dayNumber: days + 1 };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(value, lang = "zh") {
  const date = new Date(value);
  const locale = lang === "en" ? "en-GB" : "zh-CN";
  const dateText = new Intl.DateTimeFormat(locale, { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: lang === "en" ? "short" : "2-digit", day: "2-digit" }).format(date).replaceAll("/", ".");
  const timeText = new Intl.DateTimeFormat(locale, { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${dateText} · ${timeText}`;
}

function formatDateTimeLocal(value = new Date()) {
  const date = new Date(value);
  const two = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
}

function localizedTimelineItem(item, lang) {
  const copy = TIMELINE_COPY[item.id]?.[lang];
  return copy ? { ...item, title: copy.title, note: copy.note } : item;
}

function formatDuration(value) {
  const seconds = Math.max(0, Math.floor(value));
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

function classifyFile(file) {
  if (!file) return "text";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

function Modal({ title, children, onClose, wide = false, busy = false, lang = "zh" }) {
  useEffect(() => {
    const onKeyDown = (event) => event.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, busy]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => { if (!busy) onClose(); }}>
      <section className={`modal-panel ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div><p className="eyebrow">MOON · {t(lang, "local")}</p><h2>{title}</h2></div>
          <button className="text-button" type="button" onClick={onClose} disabled={busy}>{busy ? t(lang, "busy") : t(lang, "close")}</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ProcessingNotice({ message, detail }) {
  return (
    <div className="processing-notice" role="status" aria-live="polite">
      <span className="loading-orbit" aria-hidden="true" />
      <span><strong>{message}</strong><small>{detail}</small></span>
    </div>
  );
}

function AssetView({ item, compact = false, lang = "zh" }) {
  const [assetUrl, setAssetUrl] = useState(item.assetUrl ?? remoteMediaUrl(item.assetKey ?? item.audioKey));
  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    if (!item.assetId) {
      setAssetUrl(item.assetUrl ?? remoteMediaUrl(item.assetKey ?? item.audioKey));
      return undefined;
    }
    loadAsset(item.assetId).then((blob) => {
      if (!blob || cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setAssetUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item.assetId, item.assetUrl, item.assetKey, item.audioKey]);

  if (!item.assetId && !item.assetUrl && !item.assetKey && !item.audioKey) return null;
  if (!assetUrl) return <div className="asset-loading">{t(lang, "readingAsset")}</div>;
  if (item.kind === "image") return <img className={compact ? "timeline-thumb" : "detail-image"} src={assetUrl} alt={item.title} />;
  if (item.kind === "audio") return <audio className="media-player" src={assetUrl} controls preload="metadata" />;
  if (item.kind === "video") return <video className="detail-video" src={assetUrl} controls preload="metadata" />;
  return <a className="document-link" href={assetUrl} download={item.fileName ?? t(lang, "unnamedFile")}>{t(lang, "openDocument")} · {item.fileName ?? t(lang, "unnamedFile")}</a>;
}

function Timeline({ items, onOpen, lang }) {
  const sortedItems = useMemo(() => [...items].sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt)), [items]);
  return (
    <section className="timeline-column" id="life-archive" aria-labelledby="timeline-title">
      <div className="section-heading">
        <div><p className="eyebrow">LIFE ARCHIVE</p><h2 id="timeline-title">{t(lang, "timeline")}</h2></div>
        <span>{sortedItems.length} {t(lang, "moments")}</span>
      </div>
      <div className="timeline-list">
        {sortedItems.map((item) => (
          <article className="timeline-item" key={item.id}>
            <img className="timeline-star" src="/assets/art/blessing-star.png" alt="" aria-hidden="true" />
            <button className="timeline-content" type="button" onClick={() => onOpen(localizedTimelineItem(item, lang))}>
              <p className="timeline-date">{formatDate(item.occurredAt, lang)}</p>
              <div className="timeline-row">
                <div><h3>{localizedTimelineItem(item, lang).title}</h3><p>{localizedTimelineItem(item, lang).note}</p><span className="open-hint">{t(lang, "viewMoment")}</span></div>
                {(item.assetId || item.assetUrl) && <AssetView item={item} compact lang={lang} />}
              </div>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function StarMap({ blessings, onOpen, onStart, ownerTokens, lang }) {
  const hasBlessings = blessings.length > 0;
  return (
    <div className="star-map" aria-label={t(lang, "starMap")}>
      <span className="star-map-status">{hasBlessings ? t(lang, "litStars", blessings.length) : t(lang, "firstStarWaiting")}</span>
      <p className="star-map-label">{hasBlessings ? t(lang, "litStarHint") : t(lang, "emptyStarHint")}</p>
      {!hasBlessings ? (
        <button className="empty-star" type="button" onClick={onStart} aria-label={`${t(lang, "firstBlessing")} · ${t(lang, "firstStar")}`}>
          <img src="/assets/art/blessing-star.png" alt="" />
          <strong>{t(lang, "firstStar")}</strong>
          <small>{t(lang, "write")} {lang === "zh" ? "，或" : " or "} {t(lang, "voice")}</small>
        </button>
      ) : blessings.map((blessing, index) => {
        const placement = starPlacement(blessing.id, index);
        const isOwned = Boolean(ownerTokens[blessing.id]);
        return (
          <button className={`blessing-star ${blessing.audioId || blessing.audioKey ? "voice-star" : ""} ${isOwned ? "owned-star" : ""}`} type="button" key={blessing.id} style={{ left: placement.left, top: placement.top, width: placement.size, height: placement.size, animationDelay: placement.delay }} onClick={() => onOpen(blessing)} aria-label={`${t(lang, "openDocument")} ${t(lang, "starMessage", blessing.name)}${isOwned ? ` · ${t(lang, "mine")}` : ""}`}>
            <img src="/assets/art/blessing-star.png" alt="" />
            <span className="star-tooltip" aria-hidden="true"><strong>{t(lang, "starMessage", blessing.name)}</strong><small>{t(lang, "tapToView")}</small></span>
          </button>
        );
      })}
    </div>
  );
}

function BlessingsPanel({ blessings, onOpen, onStart, ownerTokens, lang }) {
  const latest = [...blessings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
  return (
    <aside className="blessings-column" id="family-constellation" aria-labelledby="blessings-title">
      <div className="section-heading">
        <div><p className="eyebrow">FAMILY CONSTELLATION</p><h2 id="blessings-title">{t(lang, "familyBlessings")}</h2></div>
        <span>{blessings.length} {t(lang, "stars")}</span>
      </div>
      <StarMap blessings={blessings} onOpen={onOpen} onStart={onStart} ownerTokens={ownerTokens} lang={lang} />
      <div className="blessing-list">
        {latest.map((blessing) => (
          <button type="button" key={blessing.id} onClick={() => onOpen(blessing)}>
            <span>{blessing.name}{ownerTokens[blessing.id] && <em className="owner-badge">{t(lang, "mine")}</em>}</span><p>{blessing.message || t(lang, "voiceBlessing")}</p><time>{formatDate(blessing.createdAt, lang)}</time>
          </button>
        ))}
      </div>
      <button className="primary-button" type="button" onClick={onStart}>{blessings.length ? t(lang, "newStar") : t(lang, "firstBlessing")}</button>
      <div className="split-actions" aria-hidden="true"><span>{t(lang, "write")}</span><span>{t(lang, "voice")}</span></div>
    </aside>
  );
}

function BlessingDialog({ onClose, onSave, lang }) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState("text");
  const [recording, setRecording] = useState(false);
  const [requestingMic, setRequestingMic] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioPreview, setAudioPreview] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingStatus, setSavingStatus] = useState("");
  const [promptIndex, setPromptIndex] = useState(() => Math.floor(Math.random() * TEXT_PROMPTS.length));
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingTickerRef = useRef(null);
  const recordingStartedAtRef = useRef(0);
  const waveformCanvasRef = useRef(null);
  const waveformSamplesRef = useRef([]);
  const waveformDataRef = useRef(null);
  const waveformLastSampleAtRef = useRef(0);
  const waveformAnimationRef = useRef(null);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const submitLockRef = useRef(false);
  const prompts = mode === "voice" ? VOICE_PROMPTS : TEXT_PROMPTS;
  const activePrompt = prompts[promptIndex % prompts.length];

  function switchMode(nextMode) {
    if (submitting) return;
    setMode(nextMode);
    const nextPrompts = nextMode === "voice" ? VOICE_PROMPTS : TEXT_PROMPTS;
    setPromptIndex(Math.floor(Math.random() * nextPrompts.length));
  }

  function shufflePrompt() {
    if (submitting || prompts.length < 2) return;
    setPromptIndex((current) => {
      const next = Math.floor(Math.random() * (prompts.length - 1));
      return next >= current % prompts.length ? next + 1 : next;
    });
  }

  function paintWaveform(samples = waveformSamplesRef.current, active = false) {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.floor(width * dpr);
    const pixelHeight = Math.floor(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.strokeStyle = "rgba(234, 209, 160, 0.16)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, height / 2 + 0.5);
    context.lineTo(width, height / 2 + 0.5);
    context.stroke();
    const barCount = Math.min(96, Math.max(28, Math.floor(width / 6)));
    const gap = Math.max(2, Math.min(4, width / barCount * 0.28));
    const barWidth = Math.max(1, (width - gap * (barCount - 1)) / barCount);
    const gradient = context.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, active ? "rgba(198, 180, 139, 0.46)" : "rgba(198, 180, 139, 0.28)");
    gradient.addColorStop(0.5, active ? "rgba(255, 240, 207, 0.92)" : "rgba(234, 209, 160, 0.56)");
    gradient.addColorStop(1, active ? "rgba(198, 180, 139, 0.46)" : "rgba(198, 180, 139, 0.28)");
    context.fillStyle = gradient;
    for (let index = 0; index < barCount; index += 1) {
      const sampleIndex = samples.length ? Math.min(samples.length - 1, Math.floor(index / barCount * samples.length)) : -1;
      const amplitude = sampleIndex >= 0 ? Math.min(1, Math.max(0, samples[sampleIndex])) : 0.035;
      const barHeight = Math.max(2, amplitude * height * 0.82);
      const x = index * (barWidth + gap);
      context.fillRect(x, (height - barHeight) / 2, barWidth, barHeight);
    }
  }

  function stopWaveform() {
    if (waveformAnimationRef.current) window.cancelAnimationFrame(waveformAnimationRef.current);
    waveformAnimationRef.current = null;
    analyserRef.current = null;
    waveformDataRef.current = null;
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext) audioContext.close().catch(() => {});
    paintWaveform(waveformSamplesRef.current, false);
  }

  function startWaveform(stream) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      paintWaveform([], true);
      return;
    }
    try {
      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.86;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      waveformDataRef.current = new Uint8Array(analyser.fftSize);
      audioContext.resume?.().catch(() => {});
      const animate = (time) => {
        const currentAnalyser = analyserRef.current;
        const data = waveformDataRef.current;
        if (!currentAnalyser || !data) return;
        currentAnalyser.getByteTimeDomainData(data);
        if (time - waveformLastSampleAtRef.current > 72) {
          let energy = 0;
          for (let index = 0; index < data.length; index += 1) {
            const normalized = (data[index] - 128) / 128;
            energy += normalized * normalized;
          }
          const amplitude = Math.min(1, Math.sqrt(energy / data.length) * 3.6);
          waveformSamplesRef.current = [...waveformSamplesRef.current.slice(-95), amplitude];
          waveformLastSampleAtRef.current = time;
        }
        paintWaveform(waveformSamplesRef.current, true);
        waveformAnimationRef.current = window.requestAnimationFrame(animate);
      };
      waveformAnimationRef.current = window.requestAnimationFrame(animate);
    } catch {
      paintWaveform([], true);
    }
  }

  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    const onResize = () => paintWaveform(waveformSamplesRef.current, recording);
    window.addEventListener("resize", onResize);
    if (canvas && "ResizeObserver" in window) {
      const observer = new ResizeObserver(onResize);
      observer.observe(canvas);
      onResize();
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", onResize);
      };
    }
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [mode, recording]);

  useEffect(() => () => {
    if (recordingTimerRef.current) window.clearTimeout(recordingTimerRef.current);
    if (recordingTickerRef.current) window.clearInterval(recordingTickerRef.current);
    stopWaveform();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => () => {
    if (audioPreview) URL.revokeObjectURL(audioPreview);
  }, [audioPreview]);

  async function startRecording() {
    setError("");
    if (recording || requestingMic) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return setError(lang === "en" ? "This browser cannot record directly. You can leave a written note instead." : "当前浏览器不支持直接录音，可以先使用文字留言。");
    if (!window.isSecureContext) return setError(lang === "en" ? "Recording is available only on a secure page. Open this room through localhost or 127.0.0.1." : "浏览器只允许在安全页面录音，请通过 localhost 或 127.0.0.1 打开此页面。");
    try {
      const permission = await navigator.permissions?.query({ name: "microphone" });
      if (permission?.state === "denied") return setError(lang === "en" ? "The browser blocked microphone access. Allow it from the icon beside the address bar, then refresh." : "浏览器已阻止麦克风。请点地址栏左侧的设置图标，将麦克风改为“允许”，然后刷新页面再试。");
    } catch {
      // Some Safari versions do not expose microphone permission state; getUserMedia remains the source of truth.
    }
    if (audioPreview) URL.revokeObjectURL(audioPreview);
    setAudioBlob(null);
    setAudioPreview("");
    setRecordingSeconds(0);
    waveformSamplesRef.current = [];
    waveformLastSampleAtRef.current = 0;
    paintWaveform([], false);
    setRequestingMic(true);
    let timeoutId;
    let streamClaimed = false;
    let activeStream = null;
    const mediaRequest = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    try {
      const stream = await Promise.race([
        mediaRequest,
        new Promise((_, reject) => {
          timeoutId = window.setTimeout(() => {
            const timeoutError = new Error("麦克风请求超时");
            timeoutError.name = "TimeoutError";
            reject(timeoutError);
          }, MIC_REQUEST_TIMEOUT_MS);
        }),
      ]);
      streamClaimed = true;
      activeStream = stream;
      if (timeoutId) window.clearTimeout(timeoutId);
      const mimeType = RECORDING_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      setRequestingMic(false);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data);
      recorder.onstop = () => {
        stopWaveform();
        if (recordingTickerRef.current) window.clearInterval(recordingTickerRef.current);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioPreview(URL.createObjectURL(blob));
        setRecordingSeconds(Math.min(60, Math.max(0, Math.round((Date.now() - recordingStartedAtRef.current) / 1000))));
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
      };
      recorder.start();
      startWaveform(stream);
      recordingStartedAtRef.current = Date.now();
      recordingTickerRef.current = window.setInterval(() => {
        setRecordingSeconds(Math.min(60, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)));
      }, 500);
      setRecording(true);
      recordingTimerRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") stopRecording();
      }, 60_000);
    } catch (error) {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (!streamClaimed) mediaRequest.then((lateStream) => lateStream.getTracks().forEach((track) => track.stop())).catch(() => {});
      activeStream?.getTracks().forEach((track) => track.stop());
      stopWaveform();
      setRequestingMic(false);
      if (error?.name === "TimeoutError") setError(lang === "en" ? "The microphone permission did not arrive. Allow it in the address bar, or leave a written note instead." : "还没有收到浏览器的麦克风授权。请留意地址栏提示，允许后再试，或改用文字留言。");
      else if (error?.name === "NotFoundError") setError(lang === "en" ? "No microphone was found. Check the device and try again." : "没有找到可用的麦克风，请检查设备后再试。");
      else if (error?.name === "NotAllowedError" || error?.name === "SecurityError") setError(lang === "en" ? "Microphone permission was denied. Allow it in the address bar and check your system settings." : "麦克风权限被拒绝。请在浏览器地址栏允许麦克风，并确认系统设置没有禁止当前浏览器后再试。");
      else setError(lang === "en" ? "Microphone access was not granted. Allow access and try once more." : "没有取得麦克风权限，请允许访问后再试一次。");
    }
  }

  function stopRecording() {
    if (recordingTimerRef.current) window.clearTimeout(recordingTimerRef.current);
    if (recordingTickerRef.current) window.clearInterval(recordingTickerRef.current);
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    else {
      stopWaveform();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    }
    setRecording(false);
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (submitting || submitLockRef.current) return;
    if (!name.trim()) return setError(t(lang, "nameRequired"));
    if (!message.trim() && !audioBlob) return setError(t(lang, "contentRequired"));
    if (recording || requestingMic) return setError(t(lang, "finishRecordingError"));
    submitLockRef.current = true;
    setSubmitting(true);
    setSavingStatus(audioBlob ? (lang === "en" ? "Preparing this voice…" : "正在准备上传这段声音…") : (lang === "en" ? "Lighting this star…" : "正在点亮这颗星…"));
    try {
      await onSave({ id: crypto.randomUUID(), name: name.trim(), message: message.trim(), audioBlob, createdAt: new Date().toISOString() }, setSavingStatus);
    } catch (saveError) {
      setError(localizedError(saveError, lang, t(lang, "blessingSaveError")));
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Modal title={t(lang, "blessingModal")} onClose={onClose} busy={submitting} lang={lang}>
      <form className="form-stack" onSubmit={submit} aria-busy={submitting}>
        <label>{t(lang, "yourName")}<input value={name} onChange={(event) => setName(event.target.value)} placeholder={t(lang, "namePlaceholder")} disabled={submitting} /></label>
        <div className="mode-switch" aria-label={t(lang, "messageMethod")}>
          <button type="button" className={mode === "text" ? "active" : ""} onClick={() => switchMode("text")} disabled={submitting}>{t(lang, "write")}</button>
          <button type="button" className={mode === "voice" ? "active" : ""} onClick={() => switchMode("voice")} disabled={submitting}>{t(lang, "voice")}</button>
        </div>
        <div className="prompt-card" aria-live="polite">
          <div><p className="eyebrow">{t(lang, "smallQuestion")}</p><button type="button" onClick={shufflePrompt} disabled={submitting}>{t(lang, "shuffle")}</button></div>
          <strong>{activePrompt.question[lang]}</strong>
          <span>{activePrompt.hint[lang]}</span>
          <small>{t(lang, "freeChoice")}</small>
        </div>
        {mode === "text" ? (
          <label>{t(lang, "messageToBaby")}<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={activePrompt.question[lang]} rows="5" disabled={submitting} /></label>
        ) : (
          <div className={`recorder-box ${requestingMic ? "is-requesting" : ""} ${submitting ? "is-submitting" : ""}`}>
            <div className="recorder-status-row">
              <p>{requestingMic ? t(lang, "micWaiting") : recording ? t(lang, "recording") : audioBlob ? t(lang, "audioSaved") : t(lang, "recordingPrompt")}</p>
              <span className="recording-duration" aria-label={`${lang === "en" ? "Recording duration" : "录音时长"} ${formatDuration(recordingSeconds)}`}>{formatDuration(recordingSeconds)}</span>
            </div>
            <div className={`waveform-shell ${recording ? "is-live" : ""} ${audioBlob ? "has-sample" : ""}`}>
              <canvas className="waveform-canvas" ref={waveformCanvasRef} role="img" aria-label={recording ? t(lang, "waveformRecording") : audioBlob ? t(lang, "waveformSaved") : t(lang, "waveformWaiting")}>{t(lang, "browserNoWaveform")}</canvas>
              <span className="waveform-caption">{recording ? t(lang, "hearingVoice") : audioBlob ? t(lang, "voiceTemperature") : t(lang, "waveformIdle")}</span>
            </div>
            {audioPreview && <audio className="media-player" controls src={audioPreview} />}
            <button className="secondary-button" type="button" disabled={requestingMic || submitting} onClick={recording ? stopRecording : startRecording}>{requestingMic ? t(lang, "waitPermission") : recording ? t(lang, "endRecording") : audioBlob ? t(lang, "rerecord") : t(lang, "startRecording")}</button>
          </div>
        )}
        {submitting && <ProcessingNotice message={savingStatus || t(lang, "savingBlessing")} detail={audioBlob ? t(lang, "keepOpen") : t(lang, "writingStar")} />}
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit" disabled={submitting || recording || requestingMic}>{submitting ? (audioBlob ? t(lang, "uploading") : t(lang, "lighting")) : recording || requestingMic ? t(lang, "finishRecording") : t(lang, "lightStar")}</button>
      </form>
    </Modal>
  );
}

function AdminDialog({ items, blessings, onClose, onAdd, onDeleteItem, onDeleteBlessing, onDeleteAllBlessings, remote, lang }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingStatus, setSavingStatus] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [passwordUpdatedAt, setPasswordUpdatedAt] = useState("");
  const [attachmentMeta, setAttachmentMeta] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState("");
  const attachmentInputRef = useRef(null);
  const addLockRef = useRef(false);

  useEffect(() => () => {
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
  }, [attachmentPreview]);

  function unlock(event) {
    event.preventDefault();
    if (pin === LOCAL_ADMIN_PIN) { setUnlocked(true); setError(""); } else setError(t(lang, "passwordIncorrect"));
  }

  async function unlockRemote(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await loginAdmin(pin);
      setUnlocked(true);
      setError("");
    } catch (unlockError) {
      setError(localizedError(unlockError, lang));
    } finally {
      setSaving(false);
    }
  }

  function setAttachment(file) {
    if (!(file instanceof File) || !file.size) return;
    setAttachmentMeta({ name: file.name, type: file.type, size: file.size });
    setAttachmentPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : "");
  }

  function handleAttachmentChange(event) {
    setAttachment(event.target.files?.[0]);
  }

  function handleAttachmentDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    setAttachment(file);
    if (attachmentInputRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      attachmentInputRef.current.files = transfer.files;
    }
  }

  function clearAttachment() {
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    setAttachmentMeta(null);
    setAttachmentPreview("");
  }

  async function addItem(event) {
    event.preventDefault();
    if (saving || addLockRef.current) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("attachment");
    const title = String(form.get("title") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();
    const occurredAt = String(form.get("occurredAt") ?? "");
    if (!title || !occurredAt) return;
    const attachment = file instanceof File && file.size ? file : null;
    addLockRef.current = true;
    setSaving(true);
    setError("");
    setSavingStatus(attachment ? (lang === "en" ? "Preparing media upload…" : "正在准备上传素材…") : (lang === "en" ? "Writing to the timeline…" : "正在写入时间线…"));
    try {
      await onAdd({ id: crypto.randomUUID(), title, note, occurredAt: new Date(occurredAt).toISOString(), file: attachment }, setSavingStatus);
      formElement.reset();
      clearAttachment();
    } catch (saveError) {
      setError(localizedError(saveError, lang, lang === "en" ? "This moment was not saved. Please try again." : "这条记录暂时没有保存成功，请稍后重试。"));
    } finally {
      addLockRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal title={unlocked ? (remote ? t(lang, "managementShared") : t(lang, "managementLocal")) : t(lang, "enterManagement")} onClose={onClose} wide={unlocked} lang={lang}>
      {!unlocked ? (
        <form className="form-stack" onSubmit={remote ? unlockRemote : unlock}>
          <p className="local-note">{t(lang, "protectedNote")}</p>
          <label>{remote ? t(lang, "adminPassword") : t(lang, "localPin")}<input type="password" value={pin} onChange={(event) => setPin(event.target.value)} autoFocus autoComplete="current-password" /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit" disabled={saving}>{saving ? t(lang, "verify") : t(lang, "enterManage")}</button>
        </form>
      ) : (
        <div className="admin-layout">
          {remote && <div className="admin-password-card"><p className="eyebrow">{t(lang, "thisMonth")}</p><h3>{t(lang, "currentPassword")}</h3>{currentPassword ? <><code>{currentPassword}</code><span>{passwordUpdatedAt ? t(lang, "updatedAt", formatDate(passwordUpdatedAt, lang)) : t(lang, "tellFamily")}</span></> : <button className="secondary-button" type="button" onClick={async () => { try { const result = await getRemotePassword(); setCurrentPassword(result.password); setPasswordUpdatedAt(result.updatedAt); } catch (error) { setError(localizedError(error, lang)); } }}>{t(lang, "viewPassword")}</button>}</div>}
          <form className="admin-form form-stack timeline-composer" onSubmit={addItem}>
            <div className="composer-heading">
              <div className="composer-orbit" aria-hidden="true"><img src="/assets/art/blessing-star.png" alt="" /></div>
              <div>
                <p className="eyebrow">{t(lang, "newMoment")}</p>
                <h3>{t(lang, "addMoment")}</h3>
                <p className="admin-form-intro">{t(lang, "uploadIntro")}</p>
              </div>
            </div>
            <label>{t(lang, "title")}<input name="title" required placeholder={t(lang, "titlePlaceholder")} /></label>
            <label>{t(lang, "occurredAt")}<input name="occurredAt" type="datetime-local" required defaultValue={formatDateTimeLocal()} /><span className="field-hint">{t(lang, "timeHint")}</span></label>
            <label>{t(lang, "shortNote")}<textarea name="note" rows="3" placeholder={t(lang, "notePlaceholder")} /></label>
            <label className="upload-dropzone" htmlFor="timeline-attachment" onDragOver={(event) => event.preventDefault()} onDrop={handleAttachmentDrop}>
              <span className="upload-dropzone-icon" aria-hidden="true">＋</span>
              <span className="upload-dropzone-copy"><strong>{t(lang, "chooseAttachment")}</strong><small>{t(lang, "dropAttachment")} · {t(lang, "uploadHint")}</small></span>
              <input ref={attachmentInputRef} id="timeline-attachment" name="attachment" type="file" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt,.md" onChange={handleAttachmentChange} />
            </label>
            {attachmentMeta && <div className="attachment-preview">
              {attachmentPreview ? <img src={attachmentPreview} alt={attachmentMeta.name} /> : <span className="attachment-file-icon" aria-hidden="true">FILE</span>}
              <div><strong>{attachmentMeta.name}</strong><small>{t(lang, "selectedAttachment")}</small></div>
              <button type="button" className="danger-button" onClick={clearAttachment} disabled={saving}>{t(lang, "removeAttachment")}</button>
            </div>}
            {saving && <ProcessingNotice message={savingStatus || t(lang, "savingRecord")} detail={t(lang, "uploadDetail")} />}
            <button className="primary-button" type="submit" disabled={saving}>{saving ? t(lang, "savingUpload") : t(lang, "addToTimeline")}</button>
          </form>
          <div className="manage-list">
            <div><p className="eyebrow">{t(lang, "localArchive")}</p><h3>{t(lang, "currentTimeline")}</h3></div>
            {items.map((item) => { const localized = localizedTimelineItem(item, lang); return <div className="manage-row" key={item.id}><div><strong>{localized.title}</strong><span>{formatDate(item.occurredAt, lang)}</span></div><button type="button" onClick={() => onDeleteItem(item)}>{t(lang, "delete")}</button></div>; })}
            <div className="manage-divider" />
            <div className="manage-heading-row"><div><p className="eyebrow">{t(lang, "blessings")}</p><h3>{t(lang, "familyBlessings")}</h3></div>{blessings.length > 0 && <button className="danger-button" type="button" onClick={onDeleteAllBlessings}>{t(lang, "clearAll")}</button>}</div>
            {blessings.length === 0 && <p className="empty-copy">{t(lang, "noBlessings")}</p>}
            {blessings.map((blessing) => <div className="manage-row" key={blessing.id}><div><strong>{blessing.name}</strong><span>{blessing.message || t(lang, "voiceBlessing")}</span></div><button type="button" onClick={() => onDeleteBlessing(blessing)}>{t(lang, "delete")}</button></div>)}
          </div>
        </div>
      )}
    </Modal>
  );
}

function AccessGate({ onSubmit, error, busy, lang, onLanguageChange }) {
  const [password, setPassword] = useState("");
  return (
    <main className="access-gate">
      <div className="access-card">
        <div className="access-topline"><p className="eyebrow">{t(lang, "accessEyebrow")}</p><LanguageSwitch lang={lang} onChange={onLanguageChange} /></div>
        <h1>{t(lang, "accessTitle")}</h1>
        <p>{t(lang, "accessBody")}</p>
        <form className="form-stack" onSubmit={(event) => { event.preventDefault(); onSubmit(password); }}>
          <label>{t(lang, "accessPassword")}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus autoComplete="current-password" placeholder={t(lang, "accessPlaceholder")} /></label>
          <p className="access-hint">{t(lang, "moonAnswer")}</p>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? t(lang, "opening") : t(lang, "openRoom")}</button>
        </form>
        <small>{t(lang, "passwordHint")}</small>
      </div>
    </main>
  );
}

export function App() {
  const elapsed = useElapsedTime();
  const [lang, setLang] = useState(readLanguagePreference);
  const [timeline, setTimeline] = useStoredState(TIMELINE_KEY, SEED_TIMELINE);
  const [blessings, setBlessings] = useStoredState(BLESSINGS_KEY, []);
  const [ownerTokens, setOwnerTokens] = useStoredState(BLESSING_OWNERS_KEY, {});
  const [remoteStatus, setRemoteStatus] = useState("checking");
  const [remoteError, setRemoteError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const [activeBlessing, setActiveBlessing] = useState(null);
  const [showBlessingDialog, setShowBlessingDialog] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const blessingSaveLockRef = useRef(false);
  const timelineSaveLockRef = useRef(false);

  useEffect(() => {
    writeLanguagePreference(lang);
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    document.title = "moon space";
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    detectRemote().then(async (result) => {
      if (cancelled) return;
      if (!result.available) return setRemoteStatus("local");
      if (!result.authenticated) return setRemoteStatus("locked");
      try {
        const state = await loadRemoteState();
        if (cancelled) return;
        setTimeline(state.timeline || []);
        setBlessings(state.blessings || []);
        setRemoteStatus("remote");
      } catch (error) {
        if (!cancelled) { setRemoteError(localizedError(error, lang)); setRemoteStatus("locked"); }
      }
    });
    return () => { cancelled = true; };
  }, [lang, setBlessings, setTimeline]);

  async function unlock(password) {
    setLoginBusy(true); setRemoteError("");
    try {
      await login(password);
      const state = await loadRemoteState();
      setTimeline(state.timeline || []); setBlessings(state.blessings || []); setRemoteStatus("remote");
    } catch (error) { setRemoteError(localizedError(error, lang)); }
    finally { setLoginBusy(false); }
  }

  async function addBlessing(blessing, onProgress = () => {}) {
    if (blessingSaveLockRef.current) throw new Error("这份祝福正在发送，请稍候。");
    const ownerToken = createOwnerToken();
    blessingSaveLockRef.current = true;
    setRemoteError("");
    try {
      if (remoteStatus === "remote") {
        onProgress(blessing.audioBlob ? t(lang, "uploading") : t(lang, "savingBlessing"));
        const audioKey = blessing.audioBlob ? await uploadRemoteAudio(blessing.audioBlob) : null;
        onProgress(lang === "en" ? "Lighting this blessing as a star…" : "正在把祝福点亮成一颗星…");
        await createRemoteBlessing({ id: blessing.id, name: blessing.name, message: blessing.message, audioKey, ownerToken });
        onProgress(lang === "en" ? "Syncing the family star map…" : "正在同步家人的星图…");
        const state = await loadRemoteState(); setTimeline(state.timeline || []); setBlessings(state.blessings || []);
        const created = (state.blessings || []).find((item) => item.id === blessing.id) || { ...blessing, audioKey };
        setActiveBlessing(created);
      } else {
        onProgress(blessing.audioBlob ? (lang === "en" ? "Saving this voice…" : "正在保存这段声音…") : (lang === "en" ? "Lighting this star…" : "正在点亮这颗星…"));
        const audioId = blessing.audioBlob ? await saveAsset(blessing.audioBlob) : null;
        const localBlessing = { id: blessing.id, name: blessing.name, message: blessing.message, audioId, createdAt: blessing.createdAt };
        setBlessings((current) => [...current, localBlessing]); setActiveBlessing(localBlessing);
      }
      setOwnerTokens((current) => ({ ...current, [blessing.id]: ownerToken }));
      setShowBlessingDialog(false);
    } catch (error) {
      setRemoteError(localizedError(error, lang));
      throw error;
    } finally {
      blessingSaveLockRef.current = false;
    }
  }
  async function deleteTimelineItem(item) {
    if (!window.confirm(t(lang, "confirmDeleteMoment", item.title))) return;
    try {
      if (remoteStatus === "remote") { await deleteRemoteTimeline(item.id); const state = await loadRemoteState(); setTimeline(state.timeline || []); setBlessings(state.blessings || []); }
      else { if (item.assetId) await removeAsset(item.assetId); setTimeline((current) => current.filter((entry) => entry.id !== item.id)); }
    } catch (error) { setRemoteError(localizedError(error, lang)); }
  }
  async function deleteBlessing(blessing) {
    if (!window.confirm(t(lang, "confirmDeleteBlessing", blessing.name))) return;
    try {
      if (remoteStatus === "remote") { await deleteRemoteBlessing(blessing.id); const state = await loadRemoteState(); setTimeline(state.timeline || []); setBlessings(state.blessings || []); }
      else { if (blessing.audioId) await removeAsset(blessing.audioId); setBlessings((current) => current.filter((entry) => entry.id !== blessing.id)); }
      setOwnerTokens((current) => { const next = { ...current }; delete next[blessing.id]; return next; });
    } catch (error) { setRemoteError(localizedError(error, lang)); }
  }

  async function deleteOwnBlessing(blessing) {
    const ownerToken = ownerTokens[blessing.id];
    if (!ownerToken || !window.confirm(t(lang, "confirmWithdraw"))) return;
    try {
      if (remoteStatus === "remote") { await deleteRemoteBlessing(blessing.id, ownerToken); const state = await loadRemoteState(); setTimeline(state.timeline || []); setBlessings(state.blessings || []); }
      else { if (blessing.audioId) await removeAsset(blessing.audioId); setBlessings((current) => current.filter((entry) => entry.id !== blessing.id)); }
      setOwnerTokens((current) => { const next = { ...current }; delete next[blessing.id]; return next; });
      setActiveBlessing(null);
    } catch (error) { setRemoteError(localizedError(error, lang)); }
  }

  async function deleteAllBlessings() {
    if (!blessings.length || !window.confirm(t(lang, "confirmClear", blessings.length))) return;
    try {
      if (remoteStatus === "remote") { await deleteRemoteBlessings(); const state = await loadRemoteState(); setTimeline(state.timeline || []); setBlessings(state.blessings || []); }
      else { await Promise.all(blessings.filter((blessing) => blessing.audioId).map((blessing) => removeAsset(blessing.audioId))); setBlessings([]); }
      setOwnerTokens({});
      setActiveBlessing(null);
    } catch (error) { setRemoteError(localizedError(error, lang)); }
  }

  async function addTimelineItem(item, onProgress = () => {}) {
    if (timelineSaveLockRef.current) throw new Error("这条记录正在保存，请稍候。");
    timelineSaveLockRef.current = true;
    setRemoteError("");
    try {
      if (remoteStatus === "remote") {
        onProgress(item.file ? (lang === "en" ? "Uploading media…" : "正在上传素材…") : (lang === "en" ? "Writing to the timeline…" : "正在写入时间线…"));
        const form = new FormData(); form.set("id", item.id); form.set("title", item.title); form.set("note", item.note); form.set("occurredAt", item.occurredAt); if (item.file) form.set("attachment", item.file, item.file.name);
        await createRemoteTimeline(form);
        onProgress(lang === "en" ? "Syncing the timeline…" : "正在同步时间线…");
        const state = await loadRemoteState(); setTimeline(state.timeline || []); setBlessings(state.blessings || []);
      } else {
        onProgress(item.file ? (lang === "en" ? "Saving media…" : "正在保存素材…") : (lang === "en" ? "Writing to the timeline…" : "正在写入时间线…"));
        let assetId = null; let kind = "text"; let fileName = ""; let mimeType = "";
        if (item.file) { assetId = await saveAsset(item.file); kind = classifyFile(item.file); fileName = item.file.name; mimeType = item.file.type; }
        setTimeline((current) => [...current, { ...item, assetId, kind, fileName, mimeType, file: undefined }]);
      }
    } catch (error) {
      setRemoteError(localizedError(error, lang));
      throw error;
    } finally {
      timelineSaveLockRef.current = false;
    }
  }

  if (remoteStatus === "checking") return <main className="access-gate"><div className="access-card"><div className="access-topline"><p className="eyebrow">{t(lang, "accessEyebrow")}</p><LanguageSwitch lang={lang} onChange={setLang} /></div><h1>{t(lang, "checkingTitle")}</h1><p>{t(lang, "checkingBody")}</p></div></main>;
  if (remoteStatus === "locked") return <AccessGate onSubmit={unlock} error={remoteError} busy={loginBusy} lang={lang} onLanguageChange={setLang} />;

  return (
    <div className="site-shell">
      <picture className="art-layer" aria-hidden="true"><source media="(min-width: 900px)" srcSet="/assets/art/life-art-desktop.png" /><img src="/assets/art/life-art-mobile.png" alt="" /></picture>
      <header className="topbar"><span className="private-mark">{t(lang, lang === "en" ? "familyMark" : "privateMark")}</span><div className="topbar-actions"><LanguageSwitch lang={lang} onChange={setLang} /><button className="text-button" type="button" onClick={() => setShowAdmin(true)}>{t(lang, "manageEn")}</button></div></header>
      <div className="local-banner">{remoteStatus === "remote" ? t(lang, "remoteBanner") : t(lang, "localBanner")}</div>
      <main className="experience">
        <section className="identity-column" aria-labelledby="baby-name">
          <div className="identity-copy">
            <p className="eyebrow">{t(lang, "beginning")}</p><h1 id="baby-name">时沐恩</h1><p className="day-copy">{t(lang, "birthDay", elapsed.dayNumber)}</p>
            <div className="life-counter" aria-label={t(lang, "counterAria", elapsed.days, elapsed.hours, elapsed.minutes, elapsed.seconds)}>
              <strong>{pad(elapsed.days)}</strong><span>{lang === "en" ? "d" : "天"}</span><strong>{pad(elapsed.hours)}</strong><span>:</span><strong>{pad(elapsed.minutes)}</strong><span>:</span><strong className="seconds">{pad(elapsed.seconds)}</strong>
            </div>
            <p className="birth-line">{t(lang, "birthLine")}</p>
          </div>
          <div className="identity-footer">
            <div className="breathing-note" aria-label={t(lang, "breathing")}><img src="/assets/art/blessing-star.png" alt="" /><span>{t(lang, "breathing")}</span></div>
            <nav className="mobile-journey-nav" aria-label={t(lang, "languageLabel")}>
              <a href="#life-archive"><small>01</small><span>{t(lang, "navTimeline")}</span></a>
              <a href="#family-constellation"><small>02</small><span>{t(lang, "navBlessings")}</span></a>
            </nav>
          </div>
        </section>
        <Timeline items={timeline} onOpen={setActiveEvent} lang={lang} />
        <BlessingsPanel blessings={blessings} ownerTokens={ownerTokens} onOpen={setActiveBlessing} onStart={() => setShowBlessingDialog(true)} lang={lang} />
      </main>
      {showBlessingDialog && <BlessingDialog onClose={() => setShowBlessingDialog(false)} onSave={addBlessing} lang={lang} />}
      {activeEvent && <Modal title={activeEvent.title} onClose={() => setActiveEvent(null)} lang={lang}><div className="detail-stack"><p className="detail-date">{formatDate(activeEvent.occurredAt, lang)}</p><AssetView item={activeEvent} lang={lang} />{activeEvent.note && <p className="detail-note">{activeEvent.note}</p>}</div></Modal>}
      {activeBlessing && <Modal title={t(lang, "detailFrom", activeBlessing.name)} onClose={() => setActiveBlessing(null)} lang={lang}><div className="detail-stack blessing-detail"><img className="detail-star" src="/assets/art/blessing-star.png" alt="" /><p className="blessing-byline">{t(lang, "litBy", activeBlessing.name)}</p>{activeBlessing.message && <blockquote>{activeBlessing.message}</blockquote>}{(activeBlessing.audioId || activeBlessing.audioKey) && <AssetView item={{ ...activeBlessing, kind: "audio", assetId: activeBlessing.audioId, audioKey: activeBlessing.audioKey }} lang={lang} />}<div className="blessing-detail-actions">{ownerTokens[activeBlessing.id] && <button className="danger-button" type="button" onClick={() => deleteOwnBlessing(activeBlessing)}>{t(lang, "withdraw")}</button>}<p className="detail-date">{formatDate(activeBlessing.createdAt, lang)}</p></div></div></Modal>}
      {showAdmin && <AdminDialog items={timeline} blessings={blessings} remote={remoteStatus === "remote"} onClose={() => setShowAdmin(false)} onAdd={addTimelineItem} onDeleteItem={deleteTimelineItem} onDeleteBlessing={deleteBlessing} onDeleteAllBlessings={deleteAllBlessings} lang={lang} />}
    </div>
  );
}
