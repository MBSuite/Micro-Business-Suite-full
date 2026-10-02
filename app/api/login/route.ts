import { query } from "@/lib/db";
import { isActiveStatus } from "@/lib/registration-bootstrap.mjs";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { LoginThrottle } from "@/lib/login-throttle.mjs";

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

// In-memory and process-local; multi-instance deployments need shared storage.
const loginThrottle = new LoginThrottle();

function clientKey(req: Request, email: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return `${ip}:${String(email || "").toLowerCase()}`;
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    const key = clientKey(req, email);
    if (!loginThrottle.isAllowed(key)) {
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
      loginThrottle.recordFailure(key);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const user = res.rows[0];

    // Only active accounts may sign in. Pending (awaiting admin approval) and
    // Inactive accounts are rejected with the same generic message used for bad
    // credentials, to avoid leaking account status. Status is matched
    // case-insensitively via the shared helper (mirrors lower(status) in SQL).
    if (!isActiveStatus(user.status)) {
      loginThrottle.recordFailure(key);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Verify password
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      loginThrottle.recordFailure(key);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    loginThrottle.clear(key);

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
