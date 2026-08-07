"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AccessGate from "../components/access-gate";
import { clearStoredCredential, encryptApiKey, getTtsUsage, getUnlockedApiKey, hasStoredCredential, recordTtsUsage, setUnlockedApiKey, unlockApiKey, type TtsUsage } from "../lib/secure-storage";

const TEST_TEXT = "This is a Google Cloud Text-to-Speech connection test.";
const CHIRP3_HD_FREE_CHARACTERS = 1_000_000;
const CHIRP3_HD_PRICE_PER_CHARACTER = 30 / 1_000_000;

function SettingsContent() {
  const [apiKey, setApiKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [hasCredential, setHasCredential] = useState(false);
  const [status, setStatus] = useState("API Key 不会以明文保存在浏览器里");
  const [testStatus, setTestStatus] = useState("尚未测试");
  const [testDetails, setTestDetails] = useState("");
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [usage, setUsage] = useState<TtsUsage>({ characters: 0, requests: 0, updatedAt: null });
  const estimatedCost = Math.max(0, usage.characters - CHIRP3_HD_FREE_CHARACTERS) * CHIRP3_HD_PRICE_PER_CHARACTER;

  useEffect(() => {
    const checkTimer = window.setTimeout(() => {
      setHasCredential(hasStoredCredential());
      setUsage(getTtsUsage());
    }, 0);
    return () => window.clearTimeout(checkTimer);
  }, []);

  async function saveAndUnlock() {
    if (apiKey.trim().length < 10) {
      setStatus("请输入有效的 Google API Key");
      return;
    }
    if (passphrase.length < 8) {
      setStatus("加密密码至少需要 8 位");
      return;
    }
    const trimmedApiKey = apiKey.trim();
    await encryptApiKey(trimmedApiKey, passphrase);
    setUnlockedApiKey(trimmedApiKey);
    setHasCredential(true);
    setStatus("已加密保存，并已解锁当前会话");
    setApiKey("");
    setPassphrase("");
  }

  async function unlock() {
    if (passphrase.length < 8) {
      setStatus("请输入保存配置时使用的加密密码");
      return;
    }
    try {
      await unlockApiKey(passphrase);
      setStatus("已解锁当前会话，可以返回朗读页面");
      setPassphrase("");
    } catch {
      setStatus("解锁失败：密码不正确或配置已损坏");
    }
  }

  async function testGoogleApi() {
    const currentApiKey = getUnlockedApiKey();
    if (!currentApiKey) {
      setTestStatus("请先保存并解锁，或输入密码后点击只解锁");
      setTestDetails("");
      return;
    }

    setIsTesting(true);
    setTestAudioUrl(null);
    setTestStatus("测试中…");
    setTestDetails("");
    const startedAt = performance.now();

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: TEST_TEXT,
          apiKey: currentApiKey,
          voiceName: "en-US-Chirp3-HD-Achird",
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { audioContent?: string; mimeType?: string; error?: string; details?: string; chunkCount?: number };

      if (!response.ok || !data.audioContent) {
        setTestStatus(`失败 · HTTP ${response.status}`);
        setTestDetails(data.details || data.error || "Google 没有返回音频");
        return;
      }

      setUsage(recordTtsUsage(TEST_TEXT.length));
      setTestAudioUrl(`data:${data.mimeType ?? "audio/mpeg"};base64,${data.audioContent}`);
      setTestStatus("成功 · Google 已返回音频");
      setTestDetails(`${Math.round(performance.now() - startedAt)} ms · ${TEST_TEXT.length} characters · ${data.chunkCount ?? 1} segment · en-US-Chirp3-HD-Achird`);
    } catch {
      setTestStatus("失败 · 本地服务不可用");
      setTestDetails("请确认 localhost:3000 正在运行");
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <main className="settings-shell">
      <header className="settings-header"><Link className="back-link" href="/">← 返回朗读</Link><div className="simple-brand"><span>V</span>OICE LAB</div><span className="settings-title">API SETTINGS</span></header>
      <section className="settings-card">
        <span className="simple-kicker">LOCAL CREDENTIAL VAULT</span>
        <h1>Google TTS<br /><em>API 设置</em></h1>
        <p className="settings-lead">这里输入一次即可。浏览器只保存 AES-GCM 加密后的密文；加密密码不会保存。朗读时，Key 只在当前会话内暂时解锁。</p>

        <label className="field-label" htmlFor="api-key">Google Cloud Text-to-Speech API Key</label>
        <input id="api-key" className="settings-input" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="AIza..." />
        <label className="field-label" htmlFor="passphrase">你的加密密码</label>
        <input id="passphrase" className="settings-input" type="password" autoComplete="new-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="至少 8 位，不要忘记它" />

        <div className="settings-actions"><button className="primary-settings-button" type="button" onClick={saveAndUnlock}>加密保存并解锁 <span>→</span></button>{hasCredential && <button className="secondary-settings-button" type="button" onClick={unlock}>只解锁 <span>↗</span></button>}</div>
        <div className="vault-status"><i />{status}</div>
        {hasCredential && <button className="delete-key-button" type="button" onClick={() => { clearStoredCredential(); setHasCredential(false); setStatus("已删除本机加密配置"); }}>删除本机加密配置</button>}

        <section className="api-test-panel">
          <div className="api-test-heading"><div><span className="field-label">CONNECTION TEST</span><h2>测试 Google TTS</h2></div><span className={`test-badge ${testStatus.startsWith("成功") ? "is-success" : testStatus.startsWith("失败") ? "is-error" : ""}`}>{testStatus}</span></div>
          <p>用一小句固定英文直接调用 Google。成功后会出现音频播放器，你可以立刻判断当前是否真的用了 Google voice。</p>
          <button className="test-api-button" type="button" onClick={testGoogleApi} disabled={isTesting}>{isTesting ? "测试中…" : "测试 API"}<span>▶</span></button>
          {testDetails && <div className="test-details">{testDetails}</div>}
          {testAudioUrl && <audio className="test-audio" controls src={testAudioUrl} />}
        </section>

        <section className="usage-panel">
          <div className="api-test-heading"><div><span className="field-label">LOCAL USAGE ESTIMATE</span><h2>本机用量</h2></div><span className="usage-note">只记录本浏览器成功调用</span></div>
          <div className="usage-grid"><div><strong>{usage.requests.toLocaleString()}</strong><span>次请求</span></div><div><strong>{usage.characters.toLocaleString()}</strong><span>字符</span></div><div><strong>${estimatedCost.toFixed(4)}</strong><span>超额估算</span></div></div>
          <p>按 Chirp 3 HD 每月前 1,000,000 字符免费、超出后约 $30 / 1,000,000 字符估算。这里仅统计本机成功请求；Google 账单、免费额度和其他项目用量以 Cloud Console 为准。空格和标点也会计入字符数。</p>
        </section>
      </section>
      <section className="security-note"><strong>原型版安全边界</strong><span>API Key 不会写入代码、URL 或明文 localStorage。当前会话解锁后，浏览器仍需把 Key 发送给本机 `/api/tts` 让服务端调用 Google；正式公网版要改成服务端 Secret Manager。</span></section>
    </main>
  );
}

export default function SettingsPage() {
  return <AccessGate><SettingsContent /></AccessGate>;
}
