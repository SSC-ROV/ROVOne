import { cookies } from "next/headers";
import db from "./db";
import {
  SESSION_COOKIE,
  newSessionToken,
  sessionExpirySQL,
  sessionMaxAgeSec,
  type SessionUser,
} from "./session";

/** 從請求 cookie 讀出目前登入者；沒有登入回 null */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.role, u.subteam
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .get(token) as unknown as SessionUser | undefined;
  return row ?? null;
}

export function createSession(userId: number): string {
  const token = newSessionToken();
  db.prepare(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ${sessionExpirySQL()})`
  ).run(token, userId);
  return token;
}

export function destroySession(token: string) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export const sessionCookieOptions = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/",
  maxAge: sessionMaxAgeSec(),
};
