import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { verifyPassword } from "@/lib/password";
import { createSession, sessionCookieOptions } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getOrCreateDisplayToken } from "@/lib/db";

const MAX_FAILS = 5;
const BLOCK_MINUTES = 15;

async function getAttempt(identifier: string): Promise<{ count: number; window_start: string; blocked_until: string | null } | undefined> {
  const [row] = await sql`
    SELECT count, window_start, blocked_until FROM login_attempts
    WHERE identifier = ${identifier} ORDER BY id DESC LIMIT 1`;
  return row as { count: number; window_start: string; blocked_until: string | null } | undefined;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    username?: string;
    password?: string;
  } | null;
  if (!body?.username || !body?.password) {
    return NextResponse.json({ error: "請輸入帳號與密碼" }, { status: 400 });
  }
  const username = body.username.trim();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const identifier = `${username.toLowerCase()}:${ip}`;

  // ── 登入限流：5 次失敗鎖 15 分鐘 ──
  const attempt = await getAttempt(identifier);
  if (attempt?.blocked_until && new Date(attempt.blocked_until) > new Date()) {
    const mins = Math.ceil(
      (new Date(attempt.blocked_until).getTime() - Date.now()) / 60000
    );
    return NextResponse.json(
      { error: `嘗試次數過多，請 ${mins} 分鐘後再試` },
      { status: 429 }
    );
  }

  const [user] = await sql`
    SELECT id, username, display_name, role, subteam, password_hash, email, login_method, password_changed_at
    FROM users WHERE username = ${username}`;

  if (!user || !verifyPassword(body.password, String(user.password_hash))) {
    // 記錄失敗（5 分鐘窗口；累積 5 次 → 鎖 15 分鐘）
    if (!attempt || new Date(attempt.window_start) < new Date(Date.now() - 5 * 60 * 1000)) {
      await sql`INSERT INTO login_attempts (identifier, count) VALUES (${identifier}, 1)`;
    } else {
      const next = Number(attempt.count) + 1;
      const blocked = next >= MAX_FAILS ? "now() + interval '15 minutes'" : null;
      await sql`
        UPDATE login_attempts SET count = ${next},
          blocked_until = ${blocked ? new Date(Date.now() + BLOCK_MINUTES * 60000) : null}
        WHERE id = (SELECT id FROM login_attempts WHERE identifier = ${identifier} ORDER BY id DESC LIMIT 1)`;
    }
    return NextResponse.json({ error: "帳號或密碼錯誤" }, { status: 401 });
  }

  // 成功：清掉失敗紀錄
  await sql`DELETE FROM login_attempts WHERE identifier = ${identifier}`;

  const token = await createSession(Number(user.id));
  const isHttps = req.nextUrl.origin.startsWith("https:");
  const res = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      subteam: user.subteam,
      email: user.email,
      login_method: user.login_method,
      password_changed_at: user.password_changed_at,
      must_change_password: !user.password_changed_at,
    },
    // 看板專用帳號：登入後直跳看板（深色＋英文）
    ...(user.username === "dashboard"
      ? { redirect: `/display?token=${await getOrCreateDisplayToken()}&theme=dark&lang=en` }
      : {}),
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(isHttps));
  return res;
}
