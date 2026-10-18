import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthService } from "@/modules/auth/auth.service";
import { loginSchema } from "@/modules/auth/auth.validation";
import { setSessionCookie } from "@/lib/session";
import { loginRateLimiter } from "@/lib/rate-limiter";
import { TRUST_PROXY_HEADERS } from "@/config/security";

function resolveClientIp(req: NextRequest): string {
  if (TRUST_PROXY_HEADERS) {
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
      const parts = forwardedFor.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length > 0) return parts[0]!;
    }
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  }
  return "127.0.0.1";
}

export async function POST(req: NextRequest) {
  const ip = resolveClientIp(req);
  const userAgent = req.headers.get("user-agent") || undefined;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  const isLoopbackOrUntrusted = !TRUST_PROXY_HEADERS || ip === "127.0.0.1";
  const ipRateKey = isLoopbackOrUntrusted && email
    ? `login:ip-account:${ip}:${email}`
    : `login:ip:${ip}`;
  const accountRateKey = email ? `login:email:${email}` : null;

  // 1. Check IP rate limit (max 10 attempts per minute)
  const ipLimit = loginRateLimiter.check(ipRateKey, 10, 60);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      {
        error: `Too many login attempts from this IP address. Please try again in ${ipLimit.retryAfterSeconds} seconds.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(ipLimit.retryAfterSeconds),
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // 2. Check targeted account rate limit (max 5 attempts per minute per account)
  if (accountRateKey) {
    const accountLimit = loginRateLimiter.check(accountRateKey, 5, 60);
    if (!accountLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many failed attempts for this account. Please wait ${accountLimit.retryAfterSeconds} seconds before retrying.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(accountLimit.retryAfterSeconds),
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }
  }

  try {
    const validated = loginSchema.parse(body);
    const { user, token } = await AuthService.login(validated, { ip, userAgent });

    // Reset rate limiter records on successful authentication
    loginRateLimiter.reset(ipRateKey);
    if (accountRateKey) {
      loginRateLimiter.reset(accountRateKey);
    }

    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    // Record failed authentication attempt against IP and targeted email
    loginRateLimiter.recordAttempt(ipRateKey);
    if (accountRateKey) {
      loginRateLimiter.recordAttempt(accountRateKey);
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Authentication failed";

    if (message === "Account is disabled. Please contact an administrator.") {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if (message === "Invalid email or password") {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    console.error("Unhandled login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during authentication" },
      { status: 500 }
    );
  }
}
