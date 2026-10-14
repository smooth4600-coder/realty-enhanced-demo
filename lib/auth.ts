const COOKIE_NAME = "realty_enhanced_demo_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET missing or too short. Generate one with `openssl rand -hex 32` and set it in .env.local"
    );
  }
  return secret;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function signToken(payload: string): Promise<string> {
  const secret = getSecret();
  const sig = await hmacSha256Hex(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const idx = token.lastIndexOf(".");
  if (idx < 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  try {
    const secret = getSecret();
    const expected = await hmacSha256Hex(secret, payload);
    return timingSafeEqualStr(sig, expected);
  } catch {
    return false;
  }
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;
export const AUTH_COOKIE_MAX_AGE = COOKIE_MAX_AGE;

/*
  The cookie carries how many voice seconds this browser has already spent.
  It is inside the HMAC-signed payload, so the visitor can read it but cannot
  change it without invalidating the whole token. Clearing the cookie logs
  them out; the in-memory per-IP counter covers that case while it lasts.
*/

export type Session = { issuedAt: number; voiceSeconds: number };

export function newSessionPayload(): string {
  return `v2:${Date.now()}:0`;
}

export function readSession(token: string | undefined): Session {
  const fallback = { issuedAt: 0, voiceSeconds: 0 };
  if (!token) return fallback;
  const payload = token.slice(0, token.lastIndexOf("."));
  const parts = payload.split(":");
  if (parts[0] !== "v2" || parts.length < 3) return fallback;
  const issuedAt = Number.parseInt(parts[1], 10);
  const voiceSeconds = Number.parseInt(parts[2], 10);
  return {
    issuedAt: Number.isFinite(issuedAt) ? issuedAt : 0,
    voiceSeconds: Number.isFinite(voiceSeconds) && voiceSeconds > 0 ? voiceSeconds : 0,
  };
}

export async function sessionToken(s: Session): Promise<string> {
  return signToken(`v2:${s.issuedAt || Date.now()}:${Math.max(0, Math.round(s.voiceSeconds))}`);
}
