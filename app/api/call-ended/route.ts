import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  readSession,
  sessionToken,
} from "@/lib/auth";
import { clientKey } from "@/lib/rate-limit";
import { VOICE_BUDGET_SECONDS, remaining, settle } from "@/lib/voice-budget";

export const runtime = "nodejs";

/*
  The browser tells us a call finished. It does not tell us how long it was:
  the duration is read from Retell. If this request never arrives, because the
  tab was closed, the call is settled on the visitor's next attempt instead.
*/

export async function POST(req: NextRequest) {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "config_missing" }, { status: 500 });
  }

  let callId = "";
  try {
    const body = (await req.json()) as { call_id?: string };
    callId = String(body.call_id ?? "").trim();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!callId) {
    return NextResponse.json({ error: "call_id_required" }, { status: 400 });
  }

  const key = clientKey(req, "voice");
  const session = readSession(req.cookies.get(AUTH_COOKIE_NAME)?.value);

  // Retell finalises a call a moment after it drops, so give it one retry.
  let used = await settle(key, apiKey, callId, session.voiceSeconds);
  if (used === session.voiceSeconds) {
    await new Promise((r) => setTimeout(r, 1500));
    used = await settle(key, apiKey, callId, session.voiceSeconds);
  }

  const res = NextResponse.json({
    usedSeconds: used,
    remainingSeconds: remaining(used),
    budgetSeconds: VOICE_BUDGET_SECONDS,
  });

  res.cookies.set(
    AUTH_COOKIE_NAME,
    await sessionToken({ issuedAt: session.issuedAt, voiceSeconds: used }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE,
    }
  );

  return res;
}
