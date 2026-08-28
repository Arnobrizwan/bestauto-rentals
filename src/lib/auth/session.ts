/**
 * Stateless signed sessions.
 *
 * The cookie carries a small claims payload plus an HMAC-SHA256 signature, so
 * middleware can authorise a request without touching the database — important
 * because middleware runs on every admin navigation. The admin layout still
 * loads the user from the database, so a deleted or demoted account loses
 * access on its next page view rather than at cookie expiry.
 */
export const SESSION_COOKIE = "bestauto_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

export type SessionClaims = {
  /** admin user id */
  sub: string;
  email: string;
  name: string;
  role: "admin" | "viewer";
  /** unix seconds */
  exp: number;
};

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * In production a real secret is mandatory. In development we fall back to a
 * fixed string so `npm run dev` works from a clean checkout — it is namespaced
 * so it can never be mistaken for a production value.
 */
function secret() {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to at least 32 characters in production.");
  }
  return "dev-only-insecure-session-secret-do-not-use-in-production";
}

async function signingKey() {
  return crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function createSessionToken(claims: Omit<SessionClaims, "exp">, ttlSeconds = SESSION_TTL_SECONDS) {
  const payload: SessionClaims = { ...claims, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const encoded = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), encoder.encode(encoded));
  return `${encoded}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function readSessionToken(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  try {
    // crypto.subtle.verify is constant-time, so a forged signature leaks nothing.
    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(),
      base64UrlDecode(signature) as BufferSource,
      encoder.encode(encoded),
    );
    if (!valid) return null;

    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded))) as SessionClaims;
    if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) return null;
    if (!claims.sub || !claims.email) return null;
    return claims;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
