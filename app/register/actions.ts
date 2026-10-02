"use server";

import { query, withTransaction } from "@/lib/db";
import bcrypt from "bcryptjs";
import { checkUserLimit, getDefaultCompanyId } from "@/lib/auth";
import { resolveRegistrationAccess } from "@/lib/registration-bootstrap.mjs";

// App-wide advisory lock key that serializes registration bootstrap decisions.
const BOOTSTRAP_LOCK_KEY = 1130409;

export async function registerUser(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!name || !email || !password) {
    return { error: "กรุณากรอกข้อมูลให้ครบทุกช่อง" };
  }

  if (password !== confirmPassword) {
    return { error: "รหัสผ่านไม่ตรงกัน" };
  }

  if (password.length < 6) {
    return { error: "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร" };
  }

  try {
    // Check if user already exists
    const checkRes = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (checkRes.rows.length > 0) {
      return { error: "อีเมลนี้ถูกใช้งานไปแล้ว" };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const companyId = await getDefaultCompanyId();
    const seatCheck = await checkUserLimit(companyId);
    if (!seatCheck.allowed) {
      return { error: "License Limit Reached: Please upgrade to add more users (300 THB/user/month)." };
    }

    // Bootstrap only a genuinely empty installation. If users already exist
    // (even with no active admin), public registration must not become a
    // recovery path that lets an arbitrary visitor claim superadmin.
    //
    // The "does any user exist?" check and the insert MUST be atomic and
    // serialized: with separate queries two simultaneous sign-ups on an empty
    // table could both observe zero users and both become superadmin. A
    // transaction-scoped advisory lock makes concurrent registrations take
    // turns.
    await withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock($1)", [BOOTSTRAP_LOCK_KEY]);

      const userCountRes = await client.query(
        "SELECT EXISTS (SELECT 1 FROM users) AS has_users"
      );
      const access = resolveRegistrationAccess(userCountRes.rows[0]?.has_users === true);

      await client.query(
        "INSERT INTO users (name, email, password, role, status, company_id) VALUES ($1, $2, $3, $4, $5, $6)",
        [name, email, hashedPassword, access.role, access.status, companyId]
      );
    });

    // Redirect to login on success
    // We use a flag via return instead of direct redirect for better client handling
    return { success: true };
  } catch (error: any) {
    console.error("❌ Registration error full details:", {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return { error: `เกิดข้อผิดพลาด: ${error.message || "กรุณาลองใหม่อีกครั้ง"}` };
  }
}
