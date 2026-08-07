import { NextResponse } from "next/server";
import { hasValidSession, isAccessConfigured } from "../../../lib/access-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAccessConfigured()) {
    return NextResponse.json({ authenticated: false, configured: false }, { status: 503 });
  }
  const authenticated = await hasValidSession(request);
  return NextResponse.json({ authenticated, configured: true }, { status: authenticated ? 200 : 401 });
}
