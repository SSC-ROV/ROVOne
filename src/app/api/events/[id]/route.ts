import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { logAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以修改活動" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "格式錯誤" }, { status: 400 });
  const [cur] = await sql`SELECT title, type, date, time, location, notes, subteam FROM events WHERE id = ${Number(id)}`;
  if (!cur) return NextResponse.json({ error: "活動不存在" }, { status: 404 });
  const c = cur as { title: string; type: string; date: string; time: string | null; location: string; notes: string; subteam: string | null };
  await sql`
    UPDATE events SET
      title = ${body.title !== undefined ? String(body.title).trim() || c.title : c.title},
      type = ${body.type !== undefined ? String(body.type) : c.type},
      date = ${body.date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(String(body.date)) ? String(body.date) : c.date},
      time = ${body.time !== undefined ? (body.time ? String(body.time) : null) : c.time},
      location = ${body.location !== undefined ? String(body.location) : c.location},
      notes = ${body.notes !== undefined ? String(body.notes) : c.notes},
      subteam = ${body.subteam !== undefined ? (body.subteam ? String(body.subteam) : null) : c.subteam}
    WHERE id = ${Number(id)}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以刪除活動" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const info = await sql`DELETE FROM events WHERE id = ${Number(id)}`;
  if (info.count === 0) {
    return NextResponse.json({ error: "活動不存在" }, { status: 404 });
  }
  await logAudit(user.id, user.username, "event.delete", `event:${id}`);
  return NextResponse.json({ ok: true });
}
