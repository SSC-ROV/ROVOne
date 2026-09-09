import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";

/** iPad 殼 App 註冊 APNs 設備令牌（需登入；換帳號登入時自動指向新用戶） */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  const token = String(body?.token ?? "").trim();
  // APNs 設備令牌為 64+ 十六進位字元（新版可能更長），只接受 hex 以防亂灌
  if (!/^[0-9a-fA-F]{64,256}$/.test(token)) {
    return NextResponse.json({ error: "格式錯誤" }, { status: 400 });
  }
  await sql`
    INSERT INTO push_tokens (token, user_id) VALUES (${token}, ${user.id})
    ON CONFLICT (token) DO UPDATE SET user_id = ${user.id}`;
  return NextResponse.json({ ok: true });
}
