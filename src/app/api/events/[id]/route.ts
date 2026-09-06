import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (user.role !== "leader") {
    return NextResponse.json({ error: "只有隊長可以修改活動" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return NextResponse.json({ error: "格式錯誤" }, { status: 400 });
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of ["title", "type", "location", "notes"] as const) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(String(body[key]));
    }
  }
  if (body.date !== undefined) {
    fields.push("date = ?");
    values.push(String(body.date));
  }
  if (body.time !== undefined) {
    fields.push("time = ?");
    values.push(body.time ? String(body.time) : null);
  }
  if (fields.length === 0) {
    return NextResponse.json({ error: "沒有要更新的欄位" }, { status: 400 });
  }
  values.push(Number(id));
  const info = db
    .prepare(`UPDATE events SET ${fields.join(", ")} WHERE id = ?`)
    .run(...(values as never[]));
  if (info.changes === 0) {
    return NextResponse.json({ error: "活動不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (user.role !== "leader") {
    return NextResponse.json({ error: "只有隊長可以刪除活動" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const info = db.prepare("DELETE FROM events WHERE id = ?").run(Number(id));
  if (info.changes === 0) {
    return NextResponse.json({ error: "活動不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
