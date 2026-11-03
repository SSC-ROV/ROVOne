import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/** Timeline for a task: comments and recorded changes, oldest first, plus the creation entry. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const taskId = Number((await ctx.params).id);
  const [task] = await sql`
    SELECT t.created_at, t.created_by, u.display_name AS created_by_name
    FROM tasks t LEFT JOIN users u ON u.id = t.created_by WHERE t.id = ${taskId}`;
  if (!task) return NextResponse.json({ error: "任務不存在" }, { status: 404 });
  const rows = await sql`
    SELECT a.id, a.kind, a.body, a.meta, a.created_at, a.edited_at, a.user_id, u.display_name AS user_name
    FROM task_activity a LEFT JOIN users u ON u.id = a.user_id
    WHERE a.task_id = ${taskId}
    ORDER BY a.created_at, a.id`;
  return NextResponse.json({
    created: { at: task.created_at, user_id: task.created_by, user_name: task.created_by_name },
    activity: rows,
  });
}

/** Add a comment. Anyone signed in can comment. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const taskId = Number((await ctx.params).id);
  const body = (await req.json().catch(() => null)) as { body?: string } | null;
  const text = String(body?.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "留言不可空白" }, { status: 400 });
  if (text.length > 10000) return NextResponse.json({ error: "留言太長" }, { status: 400 });
  if (!(await sql`SELECT 1 FROM tasks WHERE id = ${taskId}`).length) {
    return NextResponse.json({ error: "任務不存在" }, { status: 404 });
  }
  const [row] = await sql`
    INSERT INTO task_activity (task_id, user_id, kind, body)
    VALUES (${taskId}, ${user.id}, 'comment', ${text})
    RETURNING id, kind, body, meta, created_at, edited_at, user_id`;
  return NextResponse.json({ entry: { ...row, user_name: user.display_name } });
}
