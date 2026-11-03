import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

async function ownComment(id: number) {
  const [row] = await sql`SELECT user_id, kind FROM task_activity WHERE id = ${id}`;
  return row as { user_id: number | null; kind: string } | undefined;
}

/** Edit a comment (its author only). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const id = Number((await ctx.params).id);
  const row = await ownComment(id);
  if (!row || row.kind !== "comment") return NextResponse.json({ error: "留言不存在" }, { status: 404 });
  if (row.user_id !== user.id) return NextResponse.json({ error: "只能修改自己的留言" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { body?: string } | null;
  const text = String(body?.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "留言不可空白" }, { status: 400 });
  await sql`UPDATE task_activity SET body = ${text}, edited_at = now() WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

/** Delete a comment (its author, or a leader/teacher). */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const id = Number((await ctx.params).id);
  const row = await ownComment(id);
  if (!row || row.kind !== "comment") return NextResponse.json({ error: "留言不存在" }, { status: 404 });
  if (row.user_id !== user.id && !isStaff(user.role)) return NextResponse.json({ error: "沒有權限刪除這則留言" }, { status: 403 });
  await sql`DELETE FROM task_activity WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
