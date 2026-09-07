import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

async function canEdit(user: { id: number; role: string }, itemId: number): Promise<boolean> {
  const [row] = await sql`
    SELECT t.assignee_id, t.created_by FROM checklist_items c
    JOIN tasks t ON t.id = c.task_id WHERE c.id = ${itemId}`;
  if (!row) return false;
  const r = row as { assignee_id: number | null; created_by: number | null };
  return isStaff(user.role) || user.id === r.assignee_id || user.id === r.created_by;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const { id } = await ctx.params;
  const itemId = Number(id);
  if (!(await canEdit(user, itemId))) {
    return NextResponse.json({ error: "沒有權限" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as {
    done?: boolean;
    text?: string;
  } | null;
  if (body?.done !== undefined) {
    await sql`UPDATE checklist_items SET done = ${body.done ? 1 : 0} WHERE id = ${itemId}`;
  }
  if (body?.text !== undefined) {
    const text = String(body.text).trim();
    if (!text) return NextResponse.json({ error: "內容不可空白" }, { status: 400 });
    await sql`UPDATE checklist_items SET text = ${text} WHERE id = ${itemId}`;
  }
  const [item] = await sql`SELECT * FROM checklist_items WHERE id = ${itemId}`;
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const { id } = await ctx.params;
  const itemId = Number(id);
  if (!(await canEdit(user, itemId))) {
    return NextResponse.json({ error: "沒有權限" }, { status: 403 });
  }
  await sql`DELETE FROM checklist_items WHERE id = ${itemId}`;
  return NextResponse.json({ ok: true });
}
