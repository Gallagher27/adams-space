"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type GateState = "checking" | "locked" | "unconfigured" | "unlocked";

export default function AccessGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session")
      .then(async (response) => ({ response, data: (await response.json().catch(() => ({}))) as { authenticated?: boolean; configured?: boolean } }))
      .then(({ response, data }) => {
        if (!active) return;
        if (data.configured === false) {
          setState("unconfigured");
          setError("请先在服务器环境变量中配置访问密码");
        } else {
          setState(response.ok && data.authenticated ? "unlocked" : "locked");
        }
      })
      .catch(() => {
        if (active) {
          setState("locked");
          setError("无法连接本地服务，请确认 localhost:3000 正在运行");
        }
      });
    return () => { active = false; };
  }, []);

  async function unlock() {
    if (!password) {
      setError("请输入访问密码");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "解锁失败");
        return;
      }
      setPassword("");
      setState("unlocked");
    } catch {
      setError("无法连接本地服务，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (state === "unlocked") return children;

  return (
    <main className="lock-shell">
      <div className="lock-card">
        <div className="simple-brand"><span>V</span>OICE LAB</div>
        <span className="simple-kicker">PRIVATE SPEECH PRACTICE</span>
        <h1>先解锁，<br /><em>再开始练习。</em></h1>
        {state === "checking" ? <p className="lock-lead">正在检查访问权限…</p> : state === "unconfigured" ? <p className="lock-lead">当前站点还没有配置访问密码。请在服务器环境变量中设置 <code>VOICE_LAB_ACCESS_PASSWORD</code>。</p> : <form onSubmit={(event) => { event.preventDefault(); void unlock(); }}>
          <label className="field-label" htmlFor="access-password">访问密码</label>
          <input id="access-password" className="settings-input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入你的站点密码" autoFocus />
          <button className="unlock-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "验证中…" : "解锁 Voice Lab"}<span>→</span></button>
        </form>}
        {error && <p className="lock-error">{error}</p>}
        <p className="lock-note">这是服务器端访问保护，不是只藏住页面的前端密码。语音接口也会单独校验登录会话。</p>
      </div>
    </main>
  );
}
