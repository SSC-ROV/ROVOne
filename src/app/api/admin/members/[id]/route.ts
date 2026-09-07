import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { hashPassword } from "@/lib/password";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(me.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以管理成員" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const userId = Number(id);
  const body = (await req.json().catch(() => null)) as {
    display_name?: string;
    subteam?: string;
    password?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "格式錯誤" }, { status: 400 });
  if (body.display_name !== undefined) {
    const name = String(body.display_name).trim();
    if (!name) return NextResponse.json({ error: "名稱不可空白" }, { status: 400 });
    await sql`UPDATE users SET display_name = ${name} WHERE id = ${userId}`;
  }
  if (body.subteam !== undefined) {
    await sql`UPDATE users SET subteam = ${String(body.subteam)} WHERE id = ${userId}`;
  }
  if (body.password !== undefined) {
    if (body.password.length < 6) {
      return NextResponse.json({ error: "密碼至少 6 個字" }, { status: 400 });
    }
    await sql`UPDATE users SET password_hash = ${hashPassword(String(body.password))} WHERE id = ${userId}`;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(me.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以管理成員" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const userId = Number(id);
  if (userId === me.id) {
    return NextResponse.json({ error: "不能刪除自己" }, { status: 400 });
  }
  const info = await sql`DELETE FROM users WHERE id = ${userId}`;
  if (info.count === 0) {
    return NextResponse.json({ error: "成員不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
