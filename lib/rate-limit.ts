/*
  In-memory rate limiting. Good enough for a password-gated demo on one
  Vercel region. It is not a security control and it resets when the
  serverless instance is recycled, which is why the hard caps below are
  deliberately tight.
*/

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const LIMITS = {
  /** Messages in one conversation. Hitting Reset starts a new one. */
  chatPerSession: () => num("RATE_LIMIT_CHAT_PER_SESSION", 20),
  /** Hard ceiling across resets, so Reset is not an unlimited loophole. */
  chatPerDay: () => num("RATE_LIMIT_CHAT_PER_IP_PER_DAY", 30),
  listingPerDay: () => num("RATE_LIMIT_LISTING_PER_IP_PER_DAY", 2),
  voiceCallsPerDay: () => num("RATE_LIMIT_VOICE_CALLS_PER_IP_PER_DAY", 2),
  voiceMaxMinutes: () => num("RATE_LIMIT_VOICE_MAX_MINUTES", 5),
  maxPhotos: () => num("MAX_PHOTOS_PER_LISTING", 10),
};

export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || "unknown";
  return `${scope}:${ip}`;
}

/** Returns null when allowed, or the seconds until the window resets. */
export function take(key: string, limit: number, windowMs: number): number | null {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (existing.count >= limit) {
    return Math.ceil((existing.resetAt - now) / 1000);
  }

  existing.count += 1;
  return null;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export function limited(retryAfterSec: number, message: string): Response {
  return new Response(
    JSON.stringify({ error: "rate_limited", message, retryAfterSec }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(retryAfterSec),
      },
    }
  );
}
