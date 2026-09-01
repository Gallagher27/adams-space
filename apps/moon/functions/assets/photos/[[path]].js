import { ensureSchema, requireSession, securityHeaders } from "../../../worker/index.js";

export async function onRequest(context) {
  const { request, env, next } = context;
  if (!env.DB) return next();
  try {
    await ensureSchema(env.DB);
    const denied = await requireSession(request, env, env.DB);
    if (denied) return securityHeaders(denied);
    return next();
  } catch (error) {
    console.error("moon_pages_asset_error", error?.message || error);
    return securityHeaders(new Response(JSON.stringify({ error: "服务暂时不可用。" }), { status: 503, headers: { "content-type": "application/json; charset=utf-8" } }));
  }
}
