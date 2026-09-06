import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (me.role !== "leader") {
    return NextResponse.json({ error: "只有隊長可以管理成員" }, { status: 403 });
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
    db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(name, userId);
  }
  if (body.subteam !== undefined) {
    db.prepare("UPDATE users SET subteam = ? WHERE id = ?").run(
      String(body.subteam),
      userId
    );
  }
  if (body.password !== undefined) {
    if (body.password.length < 6) {
      return NextResponse.json({ error: "密碼至少 6 個字" }, { status: 400 });
    }
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      hashPassword(String(body.password)),
      userId
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (me.role !== "leader") {
    return NextResponse.json({ error: "只有隊長可以管理成員" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const userId = Number(id);
  if (userId === me.id) {
    return NextResponse.json({ error: "不能刪除自己" }, { status: 400 });
  }
  const info = db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  if (info.changes === 0) {
    return NextResponse.json({ error: "成員不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
