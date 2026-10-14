/*
  Voice budget.

  A visitor gets a fixed number of voice SECONDS in total, not a number of
  calls, and it does not reset on a timer. Once it is spent the voice tab is
  closed to them until we raise it.

  Two problems this has to solve:

  1. The server mints a token but never learns how long the call actually ran.
     So the real duration is read back from Retell using the call id, rather
     than trusting anything the browser reports.
  2. Serverless memory is wiped whenever the instance recycles, which would
     hand everyone a fresh budget. So the spend is also carried in the signed
     auth cookie, which survives restarts and cannot be edited by the visitor.

  The two are combined by taking whichever is higher, so clearing a cookie
  does not reset the budget while the instance is warm, and an instance
  recycling does not reset it for a visitor who kept their cookie.
*/

export const VOICE_BUDGET_SECONDS = (() => {
  const raw = process.env.RATE_LIMIT_VOICE_TOTAL_MINUTES;
  const parsed = raw ? Number.parseFloat(raw) : Number.NaN;
  return Math.round((Number.isFinite(parsed) && parsed > 0 ? parsed : 5) * 60);
})();

/** Below this there is not enough time left to be worth starting a call. */
export const MIN_USEFUL_SECONDS = 30;

type DeviceState = { usedSeconds: number; pending: Set<string> };

const byDevice = new Map<string, DeviceState>();

function state(key: string): DeviceState {
  let s = byDevice.get(key);
  if (!s) {
    s = { usedSeconds: 0, pending: new Set() };
    byDevice.set(key, s);
  }
  return s;
}

async function callDuration(
  apiKey: string,
  callId: string
): Promise<{ ended: boolean; seconds: number }> {
  try {
    const res = await fetch(`https://api.retellai.com/v2/get-call/${callId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return { ended: false, seconds: 0 };
    const d = (await res.json()) as {
      call_status?: string;
      duration_ms?: number;
      start_timestamp?: number;
      end_timestamp?: number;
    };
    const live = d.call_status === "ongoing" || d.call_status === "registered";
    const ms =
      d.duration_ms ??
      (d.end_timestamp && d.start_timestamp
        ? d.end_timestamp - d.start_timestamp
        : 0);
    return { ended: !live, seconds: Math.max(0, Math.round(ms / 1000)) };
  } catch {
    return { ended: false, seconds: 0 };
  }
}

/**
 * Settle any calls this device started earlier, by asking Retell how long they
 * actually ran. Returns the device's total spend in seconds.
 */
export async function reconcile(
  key: string,
  apiKey: string,
  cookieSeconds: number
): Promise<number> {
  const s = state(key);
  s.usedSeconds = Math.max(s.usedSeconds, cookieSeconds);

  if (s.pending.size > 0) {
    const ids = [...s.pending];
    const results = await Promise.all(ids.map((id) => callDuration(apiKey, id)));
    ids.forEach((id, i) => {
      const r = results[i];
      if (r.ended) {
        s.usedSeconds += r.seconds;
        s.pending.delete(id);
      }
    });
  }

  return s.usedSeconds;
}

/** A call that was never settled, because the visitor closed the tab. */
export function markPending(key: string, callId: string): void {
  state(key).pending.add(callId);
}

/**
 * Charge a call immediately, when the browser tells us it ended. The duration
 * still comes from Retell, never from the browser.
 */
export async function settle(
  key: string,
  apiKey: string,
  callId: string,
  cookieSeconds: number
): Promise<number> {
  const s = state(key);
  s.usedSeconds = Math.max(s.usedSeconds, cookieSeconds);
  if (!s.pending.has(callId)) return s.usedSeconds;

  const r = await callDuration(apiKey, callId);
  if (r.ended) {
    s.usedSeconds += r.seconds;
    s.pending.delete(callId);
  }
  return s.usedSeconds;
}

export function remaining(usedSeconds: number): number {
  return Math.max(0, VOICE_BUDGET_SECONDS - usedSeconds);
}
