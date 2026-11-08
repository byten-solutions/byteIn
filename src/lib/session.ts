import { cookies, headers } from "next/headers";

export const SESSION_COOKIE_NAME = "byteinn_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours

export interface SessionCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  maxAge: number;
  path: string;
}

/**
 * Determines whether the session cookie should include the 'Secure' attribute.
 *
 * Rules:
 * 1. Explicit override: COOKIE_SECURE="false" or "true" env var.
 * 2. Non-production: always false (allows local development over http://localhost).
 * 3. Inspect headers (x-forwarded-proto or host):
 *    - If x-forwarded-proto === "http", false (e.g. reverse proxy without SSL).
 *    - If host is an IP address (e.g. 192.168.x.x, direct VPS IP), false (browsers reject Secure cookies over HTTP).
 *    - If x-forwarded-proto === "https", true.
 * 4. Default: true in production (for domain-based HTTPS deployments).
 */
export async function isSecureCookie(req?: Request): Promise<boolean> {
  if (process.env.COOKIE_SECURE === "false") return false;
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.NODE_ENV !== "production") return false;

  try {
    let proto: string | null = null;
    let host: string | null = null;

    if (req) {
      proto = req.headers.get("x-forwarded-proto");
      host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    } else {
      const headerList = await headers();
      proto = headerList.get("x-forwarded-proto");
      host = headerList.get("x-forwarded-host") || headerList.get("host");
    }

    if (proto) {
      return proto.toLowerCase() === "https";
    }

    if (
      host &&
      (/^(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i.test(host) ||
        /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(host))
    ) {
      return false;
    }
  } catch {
    // Outside active request context (e.g. direct test runner executions)
  }

  return true;
}

export async function getSessionCookieOptions(req?: Request): Promise<SessionCookieOptions> {
  const secure = await isSecureCookie(req);
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  };
}

export async function getSessionCookie(req?: Request): Promise<string | null> {
  if (req) {
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]*)`));
      if (match) return decodeURIComponent(match[1]!);
    }
  }
  try {
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string, req?: Request): Promise<void> {
  try {
    const cookieStore = await cookies();
    const options = await getSessionCookieOptions(req);
    cookieStore.set(SESSION_COOKIE_NAME, token, options);
  } catch {
    // Gracefully ignore in non-request contexts (e.g. direct unit test invocations)
  }
}

export async function deleteSessionCookie(req?: Request): Promise<void> {
  try {
    const cookieStore = await cookies();
    const options = await getSessionCookieOptions(req);
    cookieStore.set(SESSION_COOKIE_NAME, "", {
      ...options,
      maxAge: 0,
    });
  } catch {
    // Gracefully ignore in non-request contexts
  }
}
