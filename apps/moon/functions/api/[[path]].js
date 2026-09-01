import { api, securityHeaders } from "../../worker/index.js";

export async function onRequest({ request, env }) {
  if (!env.DB) return securityHeaders(new Response(JSON.stringify({ error: "数据库尚未配置。" }), { status: 503, headers: { "content-type": "application/json; charset=utf-8" } }));
  try {
    return securityHeaders(await api(request, env, env.DB));
  } catch (error) {
    console.error("moon_pages_api_error", error?.message || error);
    return securityHeaders(new Response(JSON.stringify({ error: "服务暂时不可用。" }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }));
  }
}
