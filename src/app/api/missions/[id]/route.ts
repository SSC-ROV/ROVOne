import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以管理比賽任務" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const missionId = Number(id);
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    description?: string;
    points?: number | null;
  } | null;
  if (body?.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return NextResponse.json({ error: "名稱不可空白" }, { status: 400 });
    await sql`UPDATE mission_tasks SET title = ${title} WHERE id = ${missionId}`;
  }
  if (body?.description !== undefined) {
    await sql`UPDATE mission_tasks SET description = ${String(body.description)} WHERE id = ${missionId}`;
  }
  if (body?.points !== undefined) {
    await sql`UPDATE mission_tasks SET points = ${body.points ? Number(body.points) : null} WHERE id = ${missionId}`;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以管理比賽任務" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const info = await sql`DELETE FROM mission_tasks WHERE id = ${Number(id)}`;
  if (info.count === 0) {
    return NextResponse.json({ error: "任務不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
