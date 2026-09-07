import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { verifyPassword } from "@/lib/password";
import { createSession, sessionCookieOptions } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    username?: string;
    password?: string;
  } | null;
  if (!body?.username || !body?.password) {
    return NextResponse.json({ error: "請輸入帳號與密碼" }, { status: 400 });
  }
  const [user] = await sql`
    SELECT id, username, display_name, role, subteam, password_hash, email, login_method
    FROM users WHERE username = ${body.username.trim()}`;
  if (!user || !verifyPassword(body.password, String(user.password_hash))) {
    return NextResponse.json({ error: "帳號或密碼錯誤" }, { status: 401 });
  }
  const token = await createSession(Number(user.id));
  const res = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      subteam: user.subteam,
      email: user.email,
      login_method: user.login_method,
    },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
