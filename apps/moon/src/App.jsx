import { useEffect, useMemo, useRef, useState } from "react";
import { loadAsset, removeAsset, saveAsset } from "./storage.js";
import { createRemoteBlessing, createRemoteTimeline, deleteRemoteBlessing, deleteRemoteBlessings, deleteRemoteTimeline, detectRemote, getRemotePassword, loadRemoteState, login, loginAdmin, remoteMediaUrl, uploadRemoteAudio } from "./api.js";

const BIRTH_TIME = new Date("2026-08-25T08:52:00+08:00");
const LOCAL_ADMIN_PIN = "08250852";
const TIMELINE_KEY = "shimuen:timeline:v1";
const BLESSINGS_KEY = "shimuen:blessings:v1";
const BLESSING_OWNERS_KEY = "shimuen:blessing-owners:v1";

const SEED_TIMELINE = [
  { id: "birth", title: "时光的起点", note: "时沐恩来到这个世界。", occurredAt: "2026-08-25T08:52:00+08:00", kind: "text", system: true },
  { id: "first-meeting", title: "初见", note: "出生后的第一张小小肖像。", occurredAt: "2026-08-25T11:29:00+08:00", kind: "image", assetUrl: "/assets/photos/first-meeting.jpg", system: true },
  { id: "day-six-dream", title: "第六天的梦", note: "睡得很安静的一天。", occurredAt: "2026-08-30T20:36:00+08:00", kind: "image", assetUrl: "/assets/photos/sleeping-day-six.jpg", system: true },
  { id: "day-eight-light", title: "第八天的晨光", note: "阳光落在小手和脸颊上。", occurredAt: "2026-09-01T10:51:00+08:00", kind: "image", assetUrl: "/assets/photos/morning-day-eight.jpg", system: true },
];

const MIC_REQUEST_TIMEOUT_MS = 30_000;
const RECORDING_MIME_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];

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
  return { left: `${10 + next() * 80}%`, top: `${10 + next() * 76}%`, size: 23 + Math.round(next() * 21), delay: `${-(next() * 4.6).toFixed(2)}s`, opacity: 0.34 + next() * 0.36 };
}

const CONSTELLATION_DUST = Array.from({ length: 15 }, (_, index) => starPlacement(`dust-${index}`, index));

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

function formatDate(value) {
  const date = new Date(value);
  const dateText = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).format(date).replaceAll("/", ".");
  const timeText = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${dateText} · ${timeText}`;
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

function Modal({ title, children, onClose, wide = false }) {
  useEffect(() => {
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className={`modal-panel ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div><p className="eyebrow">MOON · LOCAL</p><h2>{title}</h2></div>
          <button className="text-button" type="button" onClick={onClose}>关闭</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function AssetView({ item, compact = false }) {
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
  if (!assetUrl) return <div className="asset-loading">正在读取本地素材…</div>;
  if (item.kind === "image") return <img className={compact ? "timeline-thumb" : "detail-image"} src={assetUrl} alt={item.title} />;
  if (item.kind === "audio") return <audio className="media-player" src={assetUrl} controls preload="metadata" />;
  if (item.kind === "video") return <video className="detail-video" src={assetUrl} controls preload="metadata" />;
  return <a className="document-link" href={assetUrl} download={item.fileName ?? "时沐恩的记录"}>打开文档 · {item.fileName ?? "未命名文件"}</a>;
}

function Timeline({ items, onOpen }) {
  const sortedItems = useMemo(() => [...items].sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt)), [items]);
  return (
    <section className="timeline-column" id="life-archive" aria-labelledby="timeline-title">
      <div className="section-heading">
        <div><p className="eyebrow">LIFE ARCHIVE</p><h2 id="timeline-title">生命时间线</h2></div>
        <span>{sortedItems.length} 个片段</span>
      </div>
      <div className="timeline-list">
        {sortedItems.map((item) => (
          <article className="timeline-item" key={item.id}>
            <img className="timeline-star" src="/assets/art/blessing-star.png" alt="" aria-hidden="true" />
            <button className="timeline-content" type="button" onClick={() => onOpen(item)}>
              <p className="timeline-date">{formatDate(item.occurredAt)}</p>
              <div className="timeline-row">
                <div><h3>{item.title}</h3><p>{item.note}</p><span className="open-hint">查看这一刻</span></div>
                {(item.assetId || item.assetUrl) && <AssetView item={item} compact />}
              </div>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function StarMap({ blessings, onOpen, onStart, ownerTokens }) {
  return (
    <div className="star-map" aria-label="家人的祝福星图">
      {CONSTELLATION_DUST.map((dust, index) => <img className="constellation-dust" key={`dust-${index}`} src="/assets/art/blessing-star.png" alt="" aria-hidden="true" style={{ left: dust.left, top: dust.top, width: dust.size, height: dust.size, animationDelay: dust.delay, opacity: dust.opacity }} />)}
      <p className="star-map-label">每一份祝福，都会成为陪伴沐恩的一颗星</p>
      {blessings.length === 0 ? (
        <button className="empty-star" type="button" onClick={onStart}><img src="/assets/art/blessing-star.png" alt="" /><span>点亮第一颗星</span></button>
      ) : blessings.map((blessing, index) => {
        const placement = starPlacement(blessing.id, index);
        const isOwned = Boolean(ownerTokens[blessing.id]);
        return (
          <button className={`blessing-star ${blessing.audioId || blessing.audioKey ? "voice-star" : ""} ${isOwned ? "owned-star" : ""}`} type="button" key={blessing.id} style={{ left: placement.left, top: placement.top, width: placement.size, height: placement.size, animationDelay: placement.delay }} onClick={() => onOpen(blessing)} aria-label={`打开 ${blessing.name} 留下的祝福${isOwned ? " · 我的祝福" : ""}`} title={blessing.name}>
            <img src="/assets/art/blessing-star.png" alt="" />
            <span className="star-tooltip" aria-hidden="true">{blessing.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function BlessingsPanel({ blessings, onOpen, onStart, ownerTokens }) {
  const latest = [...blessings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
  return (
    <aside className="blessings-column" id="family-constellation" aria-labelledby="blessings-title">
      <div className="section-heading">
        <div><p className="eyebrow">FAMILY CONSTELLATION</p><h2 id="blessings-title">家人的祝福</h2></div>
        <span>{blessings.length} 颗星</span>
      </div>
      <StarMap blessings={blessings} onOpen={onOpen} onStart={onStart} ownerTokens={ownerTokens} />
      <div className="blessing-list">
        {latest.map((blessing) => (
          <button type="button" key={blessing.id} onClick={() => onOpen(blessing)}>
            <span>{blessing.name}{ownerTokens[blessing.id] && <em className="owner-badge">我的</em>}</span><p>{blessing.message || "留下了一段声音"}</p><time>{formatDate(blessing.createdAt)}</time>
          </button>
        ))}
      </div>
      <button className="primary-button" type="button" onClick={onStart}>留下祝福</button>
      <div className="split-actions" aria-hidden="true"><span>写句话</span><span>录一段声音</span></div>
    </aside>
  );
}

function BlessingDialog({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState("text");
  const [recording, setRecording] = useState(false);
  const [requestingMic, setRequestingMic] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioPreview, setAudioPreview] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [error, setError] = useState("");
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
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return setError("当前浏览器不支持直接录音，可以先使用文字留言。");
    if (!window.isSecureContext) return setError("浏览器只允许在安全页面录音，请通过 localhost 或 127.0.0.1 打开此页面。");
    try {
      const permission = await navigator.permissions?.query({ name: "microphone" });
      if (permission?.state === "denied") return setError("浏览器已阻止麦克风。请点地址栏左侧的设置图标，将麦克风改为“允许”，然后刷新页面再试。");
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
      if (error?.name === "TimeoutError") setError("还没有收到浏览器的麦克风授权。请留意地址栏提示，允许后再试，或改用文字留言。");
      else if (error?.name === "NotFoundError") setError("没有找到可用的麦克风，请检查设备后再试。");
      else if (error?.name === "NotAllowedError" || error?.name === "SecurityError") setError("麦克风权限被拒绝。请在浏览器地址栏允许麦克风，并确认系统设置没有禁止当前浏览器后再试。");
      else setError("没有取得麦克风权限，请允许访问后再试一次。");
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
    if (!name.trim()) return setError("请先留下你的称呼。");
    if (!message.trim() && !audioBlob) return setError("请写一句话，或者录下一段声音。");
    onSave({ id: crypto.randomUUID(), name: name.trim(), message: message.trim(), audioBlob, createdAt: new Date().toISOString() });
  }

  return (
    <Modal title="留下一颗祝福星" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label>你的称呼<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：外婆" /></label>
        <div className="mode-switch" aria-label="留言方式">
          <button type="button" className={mode === "text" ? "active" : ""} onClick={() => setMode("text")}>写句话</button>
          <button type="button" className={mode === "voice" ? "active" : ""} onClick={() => setMode("voice")}>录一段声音</button>
        </div>
        {mode === "text" ? (
          <label>想对沐恩说的话<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="慢慢长大，我们一直都在。" rows="5" /></label>
        ) : (
          <div className={`recorder-box ${requestingMic ? "is-requesting" : ""}`}>
            <div className="recorder-status-row">
              <p>{requestingMic ? "正在请求麦克风权限，请留意浏览器提示…" : recording ? "正在记录这段声音…" : audioBlob ? "声音已经保存，可以先试听" : "按下按钮，录一段不超过一分钟的祝福"}</p>
              <span className="recording-duration" aria-label={`录音时长 ${formatDuration(recordingSeconds)}`}>{formatDuration(recordingSeconds)}</span>
            </div>
            <div className={`waveform-shell ${recording ? "is-live" : ""} ${audioBlob ? "has-sample" : ""}`}>
              <canvas className="waveform-canvas" ref={waveformCanvasRef} role="img" aria-label={recording ? "录音中的声音波形" : audioBlob ? "已保存的声音波形" : "等待录音的声音波形"}>你的浏览器暂时无法显示声音波形。</canvas>
              <span className="waveform-caption">{recording ? "正在听见你的声音" : audioBlob ? "这一段声音的温度" : "波形会随着声音轻轻起伏"}</span>
            </div>
            {audioPreview && <audio className="media-player" controls src={audioPreview} />}
            <button className="secondary-button" type="button" disabled={requestingMic} onClick={recording ? stopRecording : startRecording}>{requestingMic ? "等待授权…" : recording ? "结束录音" : audioBlob ? "重新录音" : "开始录音"}</button>
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit">点亮这颗星</button>
      </form>
    </Modal>
  );
}

function AdminDialog({ items, blessings, onClose, onAdd, onDeleteItem, onDeleteBlessing, onDeleteAllBlessings, remote }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [passwordUpdatedAt, setPasswordUpdatedAt] = useState("");

  function unlock(event) {
    event.preventDefault();
    if (pin === LOCAL_ADMIN_PIN) { setUnlocked(true); setError(""); } else setError("密码不正确。");
  }

  async function unlockRemote(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await loginAdmin(pin);
      setUnlocked(true);
      setError("");
    } catch (unlockError) {
      setError(unlockError.message);
    } finally {
      setSaving(false);
    }
  }

  async function addItem(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("attachment");
    const title = String(form.get("title") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();
    const occurredAt = String(form.get("occurredAt") ?? "");
    if (!title || !occurredAt) return;
    setSaving(true);
    await onAdd({ id: crypto.randomUUID(), title, note, occurredAt: new Date(occurredAt).toISOString(), file: file instanceof File && file.size ? file : null });
    formElement.reset();
    setSaving(false);
  }

  return (
    <Modal title={unlocked ? (remote ? "共享内容管理" : "本地内容管理") : "进入管理模式"} onClose={onClose} wide={unlocked}>
      {!unlocked ? (
        <form className="form-stack" onSubmit={remote ? unlockRemote : unlock}>
          <p className="local-note">这是受保护的管理入口，新增内容会记录到家庭时间线。</p>
          <label>{remote ? "管理员密码" : "本地演示密码"}<input type="password" value={pin} onChange={(event) => setPin(event.target.value)} autoFocus autoComplete="current-password" /></label>
          {!remote && <p className="helper-text">演示密码：08250852</p>}
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit" disabled={saving}>{saving ? "正在验证…" : "进入管理"}</button>
        </form>
      ) : (
        <div className="admin-layout">
          {remote && <div className="admin-password-card"><p className="eyebrow">THIS MONTH · ACCESS KEY</p><h3>本月访问密码</h3>{currentPassword ? <><code>{currentPassword}</code><span>{passwordUpdatedAt ? `更新于 ${formatDate(passwordUpdatedAt)}` : "请妥善转告家人"}</span></> : <button className="secondary-button" type="button" onClick={async () => { try { const result = await getRemotePassword(); setCurrentPassword(result.password); setPasswordUpdatedAt(result.updatedAt); } catch (error) { setError(error.message); } }}>查看本月密码</button>}</div>}
          <form className="admin-form form-stack" onSubmit={addItem}>
            <div><p className="eyebrow">NEW MOMENT</p><h3>增加一条时间记录</h3></div>
            <label>标题<input name="title" required placeholder="例如：第一次回到家" /></label>
            <label>发生时间<input name="occurredAt" type="datetime-local" required /></label>
            <label>简短说明<textarea name="note" rows="3" placeholder="留下一点当时的细节" /></label>
            <label>图片、音视频或文档<input name="attachment" type="file" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt,.md" /></label>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? "正在保存…" : "加入时间线"}</button>
          </form>
          <div className="manage-list">
            <div><p className="eyebrow">LOCAL ARCHIVE</p><h3>当前时间线</h3></div>
            {items.map((item) => <div className="manage-row" key={item.id}><div><strong>{item.title}</strong><span>{formatDate(item.occurredAt)}</span></div><button type="button" onClick={() => onDeleteItem(item)}>删除</button></div>)}
            <div className="manage-divider" />
            <div className="manage-heading-row"><div><p className="eyebrow">BLESSINGS</p><h3>访客祝福</h3></div>{blessings.length > 0 && <button className="danger-button" type="button" onClick={onDeleteAllBlessings}>清空全部祝福</button>}</div>
            {blessings.length === 0 && <p className="empty-copy">还没有访客祝福。</p>}
            {blessings.map((blessing) => <div className="manage-row" key={blessing.id}><div><strong>{blessing.name}</strong><span>{blessing.message || "语音祝福"}</span></div><button type="button" onClick={() => onDeleteBlessing(blessing)}>删除</button></div>)}
          </div>
        </div>
      )}
    </Modal>
  );
}

function AccessGate({ onSubmit, error, busy }) {
  const [password, setPassword] = useState("");
  return (
    <main className="access-gate">
      <div className="access-card">
        <p className="eyebrow">MOON · PRIVATE FAMILY ROOM</p>
        <h1>时沐恩的月光房间</h1>
        <p>这是家人之间的小小入口。输入本月访问密码，去看时间线，也留下你想说的话。</p>
        <form className="form-stack" onSubmit={(event) => { event.preventDefault(); onSubmit(password); }}>
          <label>访问密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus autoComplete="current-password" placeholder="请输入本月密码" /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "正在打开…" : "进入月光房间"}</button>
        </form>
        <small>密码每月更新一次，请向家人索取最新密码。</small>
      </div>
    </main>
  );
}

export function App() {
  const elapsed = useElapsedTime();
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
        if (!cancelled) { setRemoteError(error.message); setRemoteStatus("locked"); }
      }
    });
    return () => { cancelled = true; };
  }, [setBlessings, setTimeline]);

  async function unlock(password) {
    setLoginBusy(true); setRemoteError("");
    try {
      await login(password);
      const state = await loadRemoteState();
      setTimeline(state.timeline || []); setBlessings(state.blessings || []); setRemoteStatus("remote");
    } catch (error) { setRemoteError(error.message); }
    finally { setLoginBusy(false); }
  }

  async function addBlessing(blessing) {
    const ownerToken = createOwnerToken();
    try {
      if (remoteStatus === "remote") {
        const audioKey = blessing.audioBlob ? await uploadRemoteAudio(blessing.audioBlob) : null;
        await createRemoteBlessing({ id: blessing.id, name: blessing.name, message: blessing.message, audioKey, ownerToken });
        const state = await loadRemoteState(); setTimeline(state.timeline || []); setBlessings(state.blessings || []);
        const created = (state.blessings || []).find((item) => item.id === blessing.id) || { ...blessing, audioKey };
        setActiveBlessing(created);
      } else {
        const audioId = blessing.audioBlob ? await saveAsset(blessing.audioBlob) : null;
        const localBlessing = { id: blessing.id, name: blessing.name, message: blessing.message, audioId, createdAt: blessing.createdAt };
        setBlessings((current) => [...current, localBlessing]); setActiveBlessing(localBlessing);
      }
      setOwnerTokens((current) => ({ ...current, [blessing.id]: ownerToken }));
      setShowBlessingDialog(false);
    } catch (error) { setRemoteError(error.message); }
  }
  async function deleteTimelineItem(item) {
    if (!window.confirm(`确认删除“${item.title}”吗？`)) return;
    try {
      if (remoteStatus === "remote") { await deleteRemoteTimeline(item.id); const state = await loadRemoteState(); setTimeline(state.timeline || []); setBlessings(state.blessings || []); }
      else { if (item.assetId) await removeAsset(item.assetId); setTimeline((current) => current.filter((entry) => entry.id !== item.id)); }
    } catch (error) { setRemoteError(error.message); }
  }
  async function deleteBlessing(blessing) {
    if (!window.confirm(`确认删除 ${blessing.name} 留下的祝福吗？`)) return;
    try {
      if (remoteStatus === "remote") { await deleteRemoteBlessing(blessing.id); const state = await loadRemoteState(); setTimeline(state.timeline || []); setBlessings(state.blessings || []); }
      else { if (blessing.audioId) await removeAsset(blessing.audioId); setBlessings((current) => current.filter((entry) => entry.id !== blessing.id)); }
      setOwnerTokens((current) => { const next = { ...current }; delete next[blessing.id]; return next; });
    } catch (error) { setRemoteError(error.message); }
  }

  async function deleteOwnBlessing(blessing) {
    const ownerToken = ownerTokens[blessing.id];
    if (!ownerToken || !window.confirm("确认撤回这句祝福吗？")) return;
    try {
      if (remoteStatus === "remote") { await deleteRemoteBlessing(blessing.id, ownerToken); const state = await loadRemoteState(); setTimeline(state.timeline || []); setBlessings(state.blessings || []); }
      else { if (blessing.audioId) await removeAsset(blessing.audioId); setBlessings((current) => current.filter((entry) => entry.id !== blessing.id)); }
      setOwnerTokens((current) => { const next = { ...current }; delete next[blessing.id]; return next; });
      setActiveBlessing(null);
    } catch (error) { setRemoteError(error.message); }
  }

  async function deleteAllBlessings() {
    if (!blessings.length || !window.confirm(`确认清空全部 ${blessings.length} 句访客祝福吗？此操作不可恢复。`)) return;
    try {
      if (remoteStatus === "remote") { await deleteRemoteBlessings(); const state = await loadRemoteState(); setTimeline(state.timeline || []); setBlessings(state.blessings || []); }
      else { await Promise.all(blessings.filter((blessing) => blessing.audioId).map((blessing) => removeAsset(blessing.audioId))); setBlessings([]); }
      setOwnerTokens({});
      setActiveBlessing(null);
    } catch (error) { setRemoteError(error.message); }
  }

  async function addTimelineItem(item) {
    try {
      if (remoteStatus === "remote") {
        const form = new FormData(); form.set("id", item.id); form.set("title", item.title); form.set("note", item.note); form.set("occurredAt", item.occurredAt); if (item.file) form.set("attachment", item.file, item.file.name);
        await createRemoteTimeline(form); const state = await loadRemoteState(); setTimeline(state.timeline || []); setBlessings(state.blessings || []);
      } else {
        let assetId = null; let kind = "text"; let fileName = ""; let mimeType = "";
        if (item.file) { assetId = await saveAsset(item.file); kind = classifyFile(item.file); fileName = item.file.name; mimeType = item.file.type; }
        setTimeline((current) => [...current, { ...item, assetId, kind, fileName, mimeType, file: undefined }]);
      }
    } catch (error) { setRemoteError(error.message); }
  }

  if (remoteStatus === "checking") return <main className="access-gate"><div className="access-card"><p className="eyebrow">MOON · PRIVATE FAMILY ROOM</p><h1>正在点亮月光房间…</h1><p>请稍等，正在确认这是本地预览还是共享入口。</p></div></main>;
  if (remoteStatus === "locked") return <AccessGate onSubmit={unlock} error={remoteError} busy={loginBusy} />;

  return (
    <div className="site-shell">
      <picture className="art-layer" aria-hidden="true"><source media="(min-width: 900px)" srcSet="/assets/art/life-art-desktop.png" /><img src="/assets/art/life-art-mobile.png" alt="" /></picture>
      <header className="topbar"><span className="private-mark">时沐恩 · 家庭私享纪念页</span><button className="text-button" type="button" onClick={() => setShowAdmin(true)}>管理</button></header>
      <div className="local-banner">{remoteStatus === "remote" ? "家庭私享入口 · 访问与内容均受保护" : "本地原型 · 内容仅保存在当前浏览器"}</div>
      <main className="experience">
        <section className="identity-column" aria-labelledby="baby-name">
          <div className="identity-copy">
            <p className="eyebrow">THE BEGINNING OF TIME</p><h1 id="baby-name">时沐恩</h1><p className="day-copy">来到世界的第 {elapsed.dayNumber} 天</p>
            <div className="life-counter" aria-label={`已经来到世界 ${elapsed.days} 天 ${elapsed.hours} 小时 ${elapsed.minutes} 分 ${elapsed.seconds} 秒`}>
              <strong>{pad(elapsed.days)}</strong><span>天</span><strong>{pad(elapsed.hours)}</strong><span>:</span><strong>{pad(elapsed.minutes)}</strong><span>:</span><strong className="seconds">{pad(elapsed.seconds)}</strong>
            </div>
            <p className="birth-line">2026.08.25 · 08:52 · 时间仍在生长</p>
          </div>
          <div className="identity-footer">
            <div className="breathing-note" aria-label="生命线正在持续跳动"><img src="/assets/art/blessing-star.png" alt="" /><span>每一秒，都在成为新的故事</span></div>
            <nav className="mobile-journey-nav" aria-label="页面章节">
              <a href="#life-archive"><small>01</small><span>生命时间线</span></a>
              <a href="#family-constellation"><small>02</small><span>家人祝福</span></a>
            </nav>
          </div>
        </section>
        <Timeline items={timeline} onOpen={setActiveEvent} />
        <BlessingsPanel blessings={blessings} ownerTokens={ownerTokens} onOpen={setActiveBlessing} onStart={() => setShowBlessingDialog(true)} />
      </main>
      {showBlessingDialog && <BlessingDialog onClose={() => setShowBlessingDialog(false)} onSave={addBlessing} />}
      {activeEvent && <Modal title={activeEvent.title} onClose={() => setActiveEvent(null)}><div className="detail-stack"><p className="detail-date">{formatDate(activeEvent.occurredAt)}</p><AssetView item={activeEvent} />{activeEvent.note && <p className="detail-note">{activeEvent.note}</p>}</div></Modal>}
      {activeBlessing && <Modal title={`${activeBlessing.name} 留下的祝福`} onClose={() => setActiveBlessing(null)}><div className="detail-stack blessing-detail"><img className="detail-star" src="/assets/art/blessing-star.png" alt="" />{activeBlessing.message && <blockquote>{activeBlessing.message}</blockquote>}{(activeBlessing.audioId || activeBlessing.audioKey) && <AssetView item={{ ...activeBlessing, kind: "audio", assetId: activeBlessing.audioId, audioKey: activeBlessing.audioKey }} />}<div className="blessing-detail-actions">{ownerTokens[activeBlessing.id] && <button className="danger-button" type="button" onClick={() => deleteOwnBlessing(activeBlessing)}>撤回这句祝福</button>}<p className="detail-date">{formatDate(activeBlessing.createdAt)}</p></div></div></Modal>}
      {showAdmin && <AdminDialog items={timeline} blessings={blessings} remote={remoteStatus === "remote"} onClose={() => setShowAdmin(false)} onAdd={addTimelineItem} onDeleteItem={deleteTimelineItem} onDeleteBlessing={deleteBlessing} onDeleteAllBlessings={deleteAllBlessings} />}
    </div>
  );
}
