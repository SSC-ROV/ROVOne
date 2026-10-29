import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { logAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以刪除日誌" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const info = await sql`DELETE FROM dive_logs WHERE id = ${Number(id)}`;
  if (info.count === 0) {
    return NextResponse.json({ error: "日誌不存在" }, { status: 404 });
  }
  await logAudit(user.id, user.username, "divelog.delete", `log:${id}`);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const { id } = await ctx.params;
  const logId = Number(id);
  const [row] = await sql`SELECT id, created_by FROM dive_logs WHERE id = ${logId}`;
  if (!row) return NextResponse.json({ error: "日誌不存在" }, { status: 404 });
  if (!isStaff(user.role) && Number(row.created_by) !== user.id) {
    return NextResponse.json({ error: "只有作者或幹部可以修改日誌" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const title = String(body?.title ?? "").trim();
  const date = String(body?.date ?? "");
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "請填寫日期與標題" }, { status: 400 });
  }
  await sql`
    UPDATE dive_logs SET
      date = ${date},
      title = ${title},
      participants = ${String(body?.participants ?? "")},
      tested = ${String(body?.tested ?? "")},
      issues = ${String(body?.issues ?? "")},
      fixes = ${String(body?.fixes ?? "")},
      next_steps = ${String(body?.next_steps ?? "")}
    WHERE id = ${logId}`;
  await logAudit(user.id, user.username, "divelog.update", `log:${logId}`, title);
  return NextResponse.json({ ok: true });
}
