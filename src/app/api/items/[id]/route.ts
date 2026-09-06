import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import type { ChecklistItem } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

function canEdit(user: { id: number; role: string }, itemId: number): boolean {
  const row = db
    .prepare(
      `SELECT t.assignee_id, t.created_by FROM checklist_items c
       JOIN tasks t ON t.id = c.task_id WHERE c.id = ?`
    )
    .get(itemId) as
    | { assignee_id: number | null; created_by: number | null }
    | undefined;
  if (!row) return false;
  return (
    user.role === "leader" ||
    user.id === row.assignee_id ||
    user.id === row.created_by
  );
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const { id } = await ctx.params;
  const itemId = Number(id);
  if (!canEdit(user, itemId)) {
    return NextResponse.json({ error: "沒有權限" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as {
    done?: boolean;
    text?: string;
  } | null;
  if (body?.done !== undefined) {
    db.prepare("UPDATE checklist_items SET done = ? WHERE id = ?").run(
      body.done ? 1 : 0,
      itemId
    );
  }
  if (body?.text !== undefined) {
    const text = String(body.text).trim();
    if (!text) return NextResponse.json({ error: "內容不可空白" }, { status: 400 });
    db.prepare("UPDATE checklist_items SET text = ? WHERE id = ?").run(
      text,
      itemId
    );
  }
  const item = db
    .prepare("SELECT * FROM checklist_items WHERE id = ?")
    .get(itemId) as unknown as ChecklistItem;
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const { id } = await ctx.params;
  const itemId = Number(id);
  if (!canEdit(user, itemId)) {
    return NextResponse.json({ error: "沒有權限" }, { status: 403 });
  }
  db.prepare("DELETE FROM checklist_items WHERE id = ?").run(itemId);
  return NextResponse.json({ ok: true });
}
