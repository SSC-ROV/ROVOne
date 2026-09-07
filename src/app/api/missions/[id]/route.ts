import { isStaff } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長可以管理比賽任務" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    description?: string;
    points?: number | null;
  } | null;
  if (body?.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return NextResponse.json({ error: "名稱不可空白" }, { status: 400 });
    db.prepare("UPDATE mission_tasks SET title = ? WHERE id = ?").run(title, Number(id));
  }
  if (body?.description !== undefined) {
    db.prepare("UPDATE mission_tasks SET description = ? WHERE id = ?").run(
      String(body.description),
      Number(id)
    );
  }
  if (body?.points !== undefined) {
    db.prepare("UPDATE mission_tasks SET points = ? WHERE id = ?").run(
      body.points ? Number(body.points) : null,
      Number(id)
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長可以管理比賽任務" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const info = db.prepare("DELETE FROM mission_tasks WHERE id = ?").run(Number(id));
  if (info.changes === 0) {
    return NextResponse.json({ error: "任務不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
