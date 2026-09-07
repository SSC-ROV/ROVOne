import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { sql } from "./pg";
import { SESSION_COOKIE, sessionMaxAgeSec, type SessionUser } from "./session";

/** 從請求 cookie 讀出目前登入者；沒有登入回 null */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await sql`
    SELECT u.id, u.username, u.display_name, u.role, u.subteam, u.email, u.login_method
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > now()`;
  return (row as SessionUser) ?? null;
}

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await sql`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${userId}, now() + (${sessionMaxAgeSec()} * interval '1 second'))`;
  return token;
}

export async function destroySession(token: string) {
  await sql`DELETE FROM sessions WHERE token = ${token}`;
}

export const sessionCookieOptions = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/",
  maxAge: sessionMaxAgeSec(),
};
