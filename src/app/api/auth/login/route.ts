import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
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
  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(body.username.trim()) as
    | {
        id: number;
        username: string;
        display_name: string;
        role: string;
        subteam: string;
        password_hash: string;
      }
    | undefined;
  if (!user || !verifyPassword(body.password, user.password_hash)) {
    return NextResponse.json({ error: "帳號或密碼錯誤" }, { status: 401 });
  }
  const token = createSession(user.id);
  const res = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      subteam: user.subteam,
    },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
