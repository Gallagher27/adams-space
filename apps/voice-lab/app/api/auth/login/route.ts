import { NextResponse } from "next/server";
import { createSessionCookie, isAccessConfigured, verifyAccessPassword } from "../../../lib/access-auth";

export const runtime = "nodejs";

const attempts = new Map<string, { startedAt: number; count: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function clientId(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  if (!isAccessConfigured()) {
    return NextResponse.json({ error: "VOICE_LAB_ACCESS_PASSWORD is not configured" }, { status: 503 });
  }

  const now = Date.now();
  const id = clientId(request);
  const current = attempts.get(id);
  const record = current && now - current.startedAt < WINDOW_MS ? current : { startedAt: now, count: 0 };
  record.count += 1;
  attempts.set(id, record);
  if (record.count > MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  if (!body?.password || typeof body.password !== "string") {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  if (!(await verifyAccessPassword(body.password))) {
    return NextResponse.json({ error: "密码不正确" }, { status: 401 });
  }

  attempts.delete(id);
  const response = NextResponse.json({ authenticated: true });
  response.headers.set("Set-Cookie", await createSessionCookie(request));
  return response;
}
