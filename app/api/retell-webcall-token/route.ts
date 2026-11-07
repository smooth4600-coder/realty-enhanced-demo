import { NextRequest, NextResponse } from "next/server";
import { AGENCY } from "@/content/demo-data";
import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  readSession,
  sessionToken,
} from "@/lib/auth";
import { clientKey } from "@/lib/rate-limit";
import {
  MIN_USEFUL_SECONDS,
  VOICE_BUDGET_SECONDS,
  markPending,
  reconcile,
  remaining,
} from "@/lib/voice-budget";

export const runtime = "nodejs";

/*
  Creates a Retell web call so the visitor can speak to the assistant from the
  browser. No telephone number is involved, so there are no carrier charges,
  but Retell platform minutes are billed, which is what the budget protects.
*/

export async function POST(req: NextRequest) {
  const apiKey = process.env.RETELL_API_KEY;
  const agentId = process.env.RETELL_AGENT_ID;

  if (!apiKey || !agentId) {
    return NextResponse.json(
      {
        error: "config_missing",
        message: "RETELL_API_KEY or RETELL_AGENT_ID is not set",
      },
      { status: 500 }
    );
  }

  const key = clientKey(req, "voice");
  const session = readSession(req.cookies.get(AUTH_COOKIE_NAME)?.value);

  // Settle anything they started earlier before deciding what is left.
  const used = await reconcile(key, apiKey, session.voiceSeconds);
  const left = remaining(used);

  const persist = async (res: NextResponse, seconds: number) => {
    res.cookies.set(
      AUTH_COOKIE_NAME,
      await sessionToken({ issuedAt: session.issuedAt, voiceSeconds: seconds }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: AUTH_COOKIE_MAX_AGE,
      }
    );
    return res;
  };

  if (left < MIN_USEFUL_SECONDS) {
    return persist(
      NextResponse.json(
        {
          error: "voice_budget_spent",
          message: `This demo includes ${Math.round(
            VOICE_BUDGET_SECONDS / 60
          )} minutes of talk time, and you have used them. Ask us if you need more.`,
          usedSeconds: used,
          remainingSeconds: 0,
        },
        { status: 429 }
      ),
      used
    );
  }

  // v2 was retired on 2026-09-30. v3 takes the same body and returns the same fields.
  const res = await fetch("https://api.retellai.com/v3/create-web-call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: agentId,
      retell_llm_dynamic_variables: {
        agency_name: AGENCY.name,
        agent_name: AGENCY.agentName,
        agent_city: AGENCY.city,
        office_hours: AGENCY.hours,
        viewing_policy: AGENCY.viewingPolicy,
        is_demo: "true",
      },
      metadata: { source: "realty-enhanced-demo" },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "retell_error", status: res.status, detail: detail.slice(0, 400) },
      { status: 502 }
    );
  }

  const data = (await res.json()) as {
    access_token?: string;
    call_id?: string;
    // v3 decides the transport per call and hands back the ICE servers for it.
    // The browser SDK still defaults to livekit, so both have to be forwarded.
    transport?: string;
    ice_servers?: unknown[];
  };
  if (!data.access_token || !data.call_id) {
    return NextResponse.json(
      { error: "no_token", message: "Retell returned no access token" },
      { status: 502 }
    );
  }

  // Remember it so the time is charged even if they close the tab mid-call.
  markPending(key, data.call_id);

  return persist(
    NextResponse.json({
      access_token: data.access_token,
      call_id: data.call_id,
      transport: data.transport,
      ice_servers: data.ice_servers,
      // The call cuts off when the remaining budget runs out, not at a fixed length.
      maxSeconds: left,
      remainingSeconds: left,
      budgetSeconds: VOICE_BUDGET_SECONDS,
    }),
    used
  );
}

/*
  Read-only. Lets the page show the real budget, and what a returning visitor
  has left, without minting a call. Settles any unfinished call first so the
  number on screen is the true one.
*/
export async function GET(req: NextRequest) {
  const apiKey = process.env.RETELL_API_KEY;
  const session = readSession(req.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (!apiKey) {
    return NextResponse.json({
      budgetSeconds: VOICE_BUDGET_SECONDS,
      remainingSeconds: remaining(session.voiceSeconds),
      configured: false,
    });
  }

  const used = await reconcile(clientKey(req, "voice"), apiKey, session.voiceSeconds);
  const left = remaining(used);

  const res = NextResponse.json({
    budgetSeconds: VOICE_BUDGET_SECONDS,
    remainingSeconds: left,
    spent: left < MIN_USEFUL_SECONDS,
    configured: true,
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
