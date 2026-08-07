import { NextResponse } from "next/server";
import { clearSessionCookie } from "../../../lib/access-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const response = NextResponse.json({ authenticated: false });
  response.headers.set("Set-Cookie", clearSessionCookie(request));
  return response;
}
