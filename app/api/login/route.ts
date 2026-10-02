import { query } from "@/lib/db";
import { isActiveStatus } from "@/lib/registration-bootstrap.mjs";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Enforce JWT secret: MUST be set in environment, no fallback allowed
function getJWTSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "FATAL: JWT secret is not configured. Set NEXTAUTH_SECRET or AUTH_SECRET environment variable. " +
      "This is a security-critical requirement to prevent session forgery."
    );
  }
  return new TextEncoder().encode(secret);
}

const SECRET = getJWTSecret();

// Basic in-memory login throttling (per client IP + email).
// NOTE: process-local only — not shared across replicas. A shared store (Redis/
// Upstash) is needed for multi-instance deployments.
type LoginAttempt = { count: number; resetAt: number; lockedUntil: number };
const loginAttempts = new Map<string, LoginAttempt>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

function clientKey(req: Request, email: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return `${ip}:${String(email || "").toLowerCase()}`;
}

function checkLoginThrottle(key: string): { allowed: boolean } {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry) return { allowed: true };
  if (entry.lockedUntil > now) return { allowed: false };
  if (entry.resetAt <= now) return { allowed: true };
  return { allowed: entry.count < LOGIN_MAX_ATTEMPTS };
}

function recordLoginFailure(key: string): void {
  const now = Date.now();
  const entry =
    loginAttempts.get(key) ?? { count: 0, resetAt: now + LOGIN_WINDOW_MS, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOGIN_LOCK_MS;
    entry.count = 0;
    entry.resetAt = now + LOGIN_WINDOW_MS;
  }
  loginAttempts.set(key, entry);
  if (loginAttempts.size > 10000) loginAttempts.clear();
}

function clearLoginAttempts(key: string): void {
  loginAttempts.delete(key);
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    const key = clientKey(req, email);
    if (!checkLoginThrottle(key).allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    // Query user
    const res = await query(
      "SELECT id, email, password, name, role, status FROM users WHERE email = $1",
      [email]
    );

    // Identical response for unknown user, inactive account, and wrong password
    // to prevent account enumeration.
    if (res.rows.length === 0) {
      recordLoginFailure(key);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const user = res.rows[0];

    // Only active accounts may sign in. Pending (awaiting admin approval) and
    // Inactive accounts are rejected with the same generic message used for bad
    // credentials, to avoid leaking account status. Status is matched
    // case-insensitively via the shared helper (mirrors lower(status) in SQL).
    if (!isActiveStatus(user.status)) {
      recordLoginFailure(key);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Verify password
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      recordLoginFailure(key);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    clearLoginAttempts(key);

    // Create JWT
    const token = await new SignJWT({
      id: user.id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1d")
      .sign(SECRET);

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set("session-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400, // 1 day
      path: "/",
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error("[LOGIN API] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
