import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    current?: string;
    next?: string;
  } | null;
  if (!body?.current || !body?.next) {
    return NextResponse.json({ error: "請填寫完整" }, { status: 400 });
  }
  if (body.next.length < 6) {
    return NextResponse.json({ error: "新密碼至少 6 個字" }, { status: 400 });
  }
  const row = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(me.id) as { password_hash: string } | undefined;
  if (!row || !verifyPassword(body.current, row.password_hash)) {
    return NextResponse.json({ error: "目前密碼不正確" }, { status: 400 });
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    hashPassword(body.next),
    me.id
  );
  return NextResponse.json({ ok: true });
}
