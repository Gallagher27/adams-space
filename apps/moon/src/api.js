const jsonHeaders = { "content-type": "application/json" };

export async function detectRemote() {
  try {
    const response = await fetch("/api/session", { credentials: "same-origin" });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return { available: false, authenticated: false };
    return { available: true, authenticated: response.ok };
  } catch {
    return { available: false, authenticated: false };
  }
}

export async function login(password) {
  const response = await fetch("/api/auth/login", { method: "POST", headers: jsonHeaders, credentials: "same-origin", body: JSON.stringify({ password, role: "viewer" }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "登录失败，请稍后再试。");
  return body;
}

export async function loginAdmin(password) {
  const response = await fetch("/api/auth/login", { method: "POST", headers: jsonHeaders, credentials: "same-origin", body: JSON.stringify({ password, role: "admin" }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "管理入口登录失败，请稍后再试。");
  return body;
}

export async function loadRemoteState() {
  const response = await fetch("/api/state", { credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "暂时无法读取共享内容。");
  return body;
}

export async function createRemoteBlessing(blessing) {
  const response = await fetch("/api/blessings", { method: "POST", headers: jsonHeaders, credentials: "same-origin", body: JSON.stringify(blessing) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "祝福暂时没有保存成功。");
  return body;
}

export async function uploadRemoteAudio(blob) {
  const form = new FormData();
  form.set("file", blob, "blessing-audio.webm");
  const response = await fetch("/api/media", { method: "POST", credentials: "same-origin", body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "声音上传失败。");
  return body.key;
}

export async function createRemoteTimeline(formData) {
  const response = await fetch("/api/admin/timeline", { method: "POST", credentials: "same-origin", body: formData });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "时间记录保存失败。");
  return body;
}

export async function deleteRemoteTimeline(id) {
  const response = await fetch(`/api/admin/timeline/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "时间记录删除失败。");
  return body;
}

export async function deleteRemoteBlessing(id, ownerToken) {
  const isOwnerDelete = Boolean(ownerToken);
  const response = await fetch(isOwnerDelete ? `/api/blessings/${encodeURIComponent(id)}` : `/api/admin/blessings/${encodeURIComponent(id)}`, { method: "DELETE", headers: isOwnerDelete ? { "x-moon-owner-token": ownerToken } : undefined, credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "祝福删除失败。");
  return body;
}

export async function deleteRemoteBlessings() {
  const response = await fetch("/api/admin/blessings", { method: "DELETE", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "祝福清理失败。");
  return body;
}

export async function getRemotePassword() {
  const response = await fetch("/api/admin/current-password", { credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "暂时无法读取本月访问密码。");
  return body;
}

export function remoteMediaUrl(key) {
  return key ? `/api/media/${encodeURIComponent(key)}` : "";
}
